import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {describe,it,expect,vi} from 'vitest';
import {CoverTeasersResize,teaserHeight} from './CoverTeasersResize';
import {PreviewReadOnly} from './PreviewReadOnly';
import {presetFor} from '../store/presets';
import {useDoc} from '../store/useDoc';
import {migrate} from '../schema/document';
import {pageDimensions} from '../lib/pageFormat';

describe('cover teaser height',()=>{
  it('bounds and rounds physical height',()=>{expect(teaserHeight(-10,240)).toBe(12);expect(teaserHeight(500,240)).toBe(240);expect(teaserHeight(48.123,240)).toBe(48.1);});
  it('does not expose a handle in read-only proofs',()=>{
    const host=document.createElement('div'),root=createRoot(host);
    act(()=>root.render(<PreviewReadOnly.Provider value={true}><CoverTeasersResize doc={presetFor('magazine-4')}/></PreviewReadOnly.Provider>));
    expect(host.querySelector('button')).toBeNull();act(()=>root.unmount());
  });
  it('keeps dragging draft-only, cancels cleanly, saves once and persists',()=>{
    const doc=presetFor('magazine-4'),host=document.createElement('div'),root=createRoot(host);document.body.append(host);
    act(()=>{useDoc.getState().load(doc);root.render(<div className="page"><div className="front-cover-teasers"><CoverTeasersResize doc={doc}/></div></div>);});
    const page=host.querySelector<HTMLElement>('.page')!,box=host.querySelector<HTMLElement>('.front-cover-teasers')!,button=host.querySelector('button')!;
    page.getBoundingClientRect=()=>({width:pageDimensions(doc.design).width*4,top:0} as DOMRect);box.getBoundingClientRect=()=>({height:160,bottom:900} as DOMRect);
    button.setPointerCapture=vi.fn();button.releasePointerCapture=vi.fn();
    const pointer=(type:string,y:number)=>act(()=>{const event=new Event(type,{bubbles:true});Object.assign(event,{pointerId:1,button:0,clientY:y});button.dispatchEvent(event);});
    pointer('pointerdown',100);pointer('pointermove',60);
    expect(useDoc.getState().doc.design.frontCover?.teaserHeight).toBeUndefined();expect(box.style.getPropertyValue('--front-teasers-height')).toBe('50mm');
    pointer('pointercancel',60);expect(box.style.getPropertyValue('--front-teasers-height')).toBe('');
    pointer('pointerdown',100);pointer('pointermove',60);pointer('pointerup',60);
    expect(useDoc.getState().doc.design.frontCover?.teaserHeight).toBe(50);
    expect(migrate(JSON.parse(JSON.stringify(useDoc.getState().doc))).design.frontCover?.teaserHeight).toBe(50);
    act(()=>button.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})));expect(useDoc.getState().doc.design.frontCover?.teaserHeight).toBeUndefined();
    act(()=>root.unmount());host.remove();
  });
});
