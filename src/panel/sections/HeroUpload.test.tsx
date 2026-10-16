import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {emptyDoc,type TemplateId} from '../../schema/document';
import {presetFor} from '../../store/presets';
import {useDoc} from '../../store/useDoc';
import {loadImage,ImageLoadError,type LoadedImage} from '../../lib/loadImage';
import {HeroSection} from './HeroSection';

vi.mock('../../lib/loadImage',async()=>({...await vi.importActual('../../lib/loadImage'),loadImage:vi.fn()}));
let host:HTMLDivElement,root:Root;
const photo:LoadedImage={src:'data:image/png;base64,NEW',naturalWidth:800,naturalHeight:600};
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.mocked(loadImage).mockReset();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();useDoc.getState().load(emptyDoc());vi.unstubAllGlobals();});
const mount=(template:TemplateId='paper-3')=>{
  const doc=presetFor(template);doc.design.showHero=false;doc.design.heroHeight=0;
  act(()=>{useDoc.getState().load(doc);root.render(<HeroSection/>);});return doc;
};
const choose=(label='Choose hero image')=>{
  const input=host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  Object.defineProperty(input,'files',{configurable:true,value:[new File(['photo'],'photo.png',{type:'image/png'})]});
  input.dispatchEvent(new Event('change',{bubbles:true}));
};
describe('hero image upload',()=>{
  it.each(['paper-1','paper-2','paper-3','paper-4','paper-5','paper-6','paper-7','paper-8','magazine-1','magazine-2'] as const)('%s shows the uploaded hero even after it was hidden or its height was zero',async template=>{
    const before=mount(template);vi.mocked(loadImage).mockResolvedValue(photo);
    await act(async()=>choose());
    const saved=useDoc.getState().doc;
    expect(saved.assets[saved.hero.assetId!]).toEqual(photo);expect(saved.design.showHero).toBe(true);expect(saved.design.heroHeight).toBe(95);
    expect(saved.blocks).toEqual(before.blocks);expect(saved.meta).toEqual(before.meta);expect(saved.images).toEqual(before.images);
  });
  it('accepts the photo while retaining text edits made during decoding',async()=>{
    mount();let resolve!:(value:LoadedImage)=>void;vi.mocked(loadImage).mockImplementation(()=>new Promise(r=>{resolve=r;}));
    act(()=>choose());act(()=>useDoc.getState().update(d=>{d.meta.title='Keep my new title';}));
    await act(async()=>resolve(photo));
    expect(useDoc.getState().doc.meta.title).toBe('Keep my new title');
    expect(useDoc.getState().doc.assets[useDoc.getState().doc.hero.assetId!]).toEqual(photo);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
  it('does not insert a late upload into another document',async()=>{
    mount();let resolve!:(value:LoadedImage)=>void;vi.mocked(loadImage).mockImplementation(()=>new Promise(r=>{resolve=r;}));
    act(()=>choose());const next=emptyDoc();next.meta.title='Another article';act(()=>useDoc.getState().load(next));
    await act(async()=>resolve(photo));
    expect(useDoc.getState().doc).toBe(next);expect(next.hero.assetId).toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('document changed');
  });
  it('does not overwrite a newer image in the same document',async()=>{
    mount();let resolve!:(value:LoadedImage)=>void;vi.mocked(loadImage).mockImplementation(()=>new Promise(r=>{resolve=r;}));
    act(()=>choose());act(()=>useDoc.getState().update(d=>{d.hero.assetId='newer';d.assets.newer=photo;}));
    await act(async()=>resolve({...photo,src:'data:image/png;base64,OLD'}));
    expect(useDoc.getState().doc.hero.assetId).toBe('newer');expect(Object.values(useDoc.getState().doc.assets).some(a=>a.src.endsWith('OLD'))).toBe(false);
  });
  it('shows a real decoding error and allows retry',async()=>{
    mount();vi.mocked(loadImage).mockRejectedValueOnce(new ImageLoadError('Unsupported test image.')).mockResolvedValueOnce(photo);
    await act(async()=>choose());expect(host.querySelector('[role="alert"]')?.textContent).toBe('Unsupported test image.');
    await act(async()=>choose());expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(useDoc.getState().doc.assets[useDoc.getState().doc.hero.assetId!]).toEqual(photo);
  });
  it('restores a hidden hero without requiring another upload',()=>{
    mount();const show=[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Show image')!;
    act(()=>show.click());expect(useDoc.getState().doc.design.showHero).toBe(true);expect(useDoc.getState().doc.design.heroHeight).toBeGreaterThan(0);
  });
});
