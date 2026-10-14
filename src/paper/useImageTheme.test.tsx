import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Doc } from '../schema/document';
import { presetFor } from '../store/presets';
import { useImageTheme } from './useImageTheme';

afterEach(()=> {vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('shared image themes',()=> {
  it.each(['paper-4','paper-5','paper-6','paper-7','paper-8'] as const)('%s opts into image colours and restores manual settings without mutating the source',template=> {
    const images: {onload:(()=>void)|null}[]=[];
    vi.stubGlobal('Image',class {
      onload:(()=>void)|null=null;naturalHeight=100;naturalWidth=200;
      constructor(){images.push(this);}
      set src(_v:string){ /* Trigger load explicitly under act. */ }
    });
    const drawImage=vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage,getImageData:()=>({data:[16,32,48,255]})} as unknown as CanvasRenderingContext2D);
    let rendered:Doc|undefined;
    function Probe({source}:{source:Doc}) {rendered=useImageTheme(source);return null;}
    const host=document.createElement('div');const root=createRoot(host);
    const source=presetFor(template);source.design.pageBackgroundAssetId='keep-background';source.design.subtitleColor='#f0a030';
    const before=JSON.stringify(source);
    act(()=>root.render(<Probe source={source}/>));
    expect(images).toHaveLength(0);
    const enabled={...source,design:{...source.design,imageTheme:true}};
    act(()=>root.render(<Probe source={enabled}/>));
    act(()=>images[0].onload?.());
    expect(rendered!.design.paperBg).toBe('#102030');
    expect(rendered!.design.colors.ink).toBe('#ffffff');
    expect(rendered!.design.colors.accentSoft).toBe('#102030');
    expect(rendered!.design.subtitleColor).toBe('#f0a030');
    expect(rendered!.design.pageBackgroundAssetId).toBe('keep-background');
    act(()=>root.render(<Probe source={{...enabled,design:{...enabled.design,heroAtBottom:true}}}/>));
    act(()=>images[1].onload?.());
    expect(drawImage.mock.calls[1][2]).toBe(0);
    act(()=>root.render(<Probe source={source}/>));
    expect(rendered!.design.colors).toEqual(source.design.colors);
    expect(rendered!.design.paperBg).toBe(source.design.paperBg);
    expect(JSON.stringify(source)).toBe(before);
    act(()=>root.unmount());
  });
});
