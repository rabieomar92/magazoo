import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {CanvasImageResize,resizedVerticalFrame} from './CanvasImageResize';
import {presetFor} from '../store/presets';
import type {TemplateId} from '../schema/document';
const state=vi.hoisted(()=>({update:vi.fn(),session:1}));
vi.mock('../store/useDoc',()=>({currentDocumentSession:()=>state.session,useDoc:{getState:()=>({update:state.update})}}));
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);state.update.mockReset();state.session=1;});
afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();vi.unstubAllGlobals();});
function fixture(kind:'image'|'hero'='image',bottom=false,template:TemplateId='paper-8'){
 const doc=presetFor(template);doc.design.heroAtBottom=bottom;doc.design.heroHeight=40;
 doc.images=[{id:'one',assetId:'asset',heightMm:40,widthCols:2,caption:'Keep caption',anchor:{page:1,column:0,y:50},frame:{scale:1.4,offsetX:2,offsetY:3,panX:10,panY:20},wrapShape:'polygon',wrapPolygon:[{x:0,y:0},{x:100,y:30},{x:20,y:100}]}];
 const pages=document.createElement('div');pages.innerHTML=`<div class="page"><figure ${kind==='image'?'data-image-id="one"':'data-editor-target="image-hero"'} style="top:50mm;--placed-image-h:40mm"><div style="height:40mm"><img class="framed-image"></div></figure></div>`;document.body.append(pages);
 const page=pages.firstElementChild as HTMLElement,frame=pages.querySelector('img')!.parentElement!;
 vi.spyOn(page,'getBoundingClientRect').mockReturnValue({width:420,height:594,top:0,left:0,bottom:594,right:420,x:0,y:0,toJSON:()=>({})});
 Object.defineProperty(page,'offsetHeight',{value:1123});
 vi.spyOn(frame,'getBoundingClientRect').mockReturnValue({width:200,height:80,top:100,left:0,bottom:180,right:200,x:0,y:100,toJSON:()=>({})});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);act(()=>root.render(<CanvasImageResize doc={doc} root={{current:pages}}/>));
 const handle=(side='bottom')=>pages.querySelector<HTMLButtonElement>(`[aria-label$="from ${side}"]`)!;
 const start=(side='bottom')=>act(()=>handle(side).dispatchEvent(Object.assign(new Event('pointerdown',{bubbles:true}),{button:0,pointerId:1,clientY:100})));
 const pointer=(type:string,y:number)=>act(()=>window.dispatchEvent(Object.assign(new Event(type,{bubbles:true}),{pointerId:1,clientY:y})));
 return {doc,root,frame,pages,handle,start,pointer};
}
it('resizes in millimetres at zoom, commits once and preserves crop, contour and caption',()=>{
 const f=fixture();try{const before=structuredClone(f.doc.images[0]);f.start();f.pointer('pointermove',140);expect(f.frame.style.height).toBe('60mm');expect(state.update).not.toHaveBeenCalled();f.pointer('pointerup',140);expect(state.update).toHaveBeenCalledTimes(1);state.update.mock.calls[0][0](f.doc);expect(f.doc.images[0]).toEqual({...before,heightMm:60});}finally{act(()=>f.root.unmount());}
});
it('top-edge resize holds the bottom fixed and moves the image anchor',()=>{
 const f=fixture();try{f.start('top');f.pointer('pointermove',120);f.pointer('pointerup',120);state.update.mock.calls[0][0](f.doc);expect(f.doc.images[0].heightMm).toBe(30);expect(f.doc.images[0].anchor.y).toBe(60);}finally{act(()=>f.root.unmount());}
});
it.each(['escape','cancel','session'] as const)('%s cancels without changing the document',mode=>{
 const f=fixture();try{const before=f.frame.style.cssText;f.start();f.pointer('pointermove',140);if(mode==='escape')act(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})));else if(mode==='cancel')f.pointer('pointercancel',140);else{state.session++;f.pointer('pointerup',140);}expect(state.update).not.toHaveBeenCalled();expect(f.frame.style.cssText).toBe(before);}finally{act(()=>f.root.unmount());}
});
it.each([false,true])('hero resize uses the existing height setting, bottom anchored=%s',bottom=>{
 const f=fixture('hero',bottom);try{expect(f.pages.querySelectorAll('.canvas-height-handle')).toHaveLength(1);f.start(bottom?'top':'bottom');f.pointer('pointermove',bottom?80:120);f.pointer('pointerup',bottom?80:120);state.update.mock.calls[0][0](f.doc);expect(f.doc.design.heroHeight).toBe(50);}finally{act(()=>f.root.unmount());}
});
it('bounds heights and top anchors at physical page edges',()=>{
 expect(resizedVerticalFrame(40,50,900,'bottom',297)).toEqual({height:247,top:50});
 expect(resizedVerticalFrame(40,50,-900,'top',297)).toEqual({height:90,top:0});
 expect(resizedVerticalFrame(40,50,900,'top',297)).toEqual({height:1,top:89});
});
it.each(['paper-1','paper-2','paper-3','paper-4','paper-5','paper-6','paper-7','paper-8','magazine-1','magazine-2','magazine-3'] as const)('%s exposes both page-image edges and keyboard resize',template=>{
 const f=fixture('image',false,template);try{
  expect(f.pages.querySelectorAll('.canvas-height-handle')).toHaveLength(2);
  act(()=>f.handle().dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'ArrowDown',shiftKey:true})));
  state.update.mock.calls[0][0](f.doc);expect(f.doc.images[0].heightMm).toBe(45);
 }finally{act(()=>f.root.unmount());}
});
it.each(['magazine-2','magazine-3','magazine-4','backcover-1'] as const)('%s does not pretend a fixed full-page picture has an independent height',template=>{
 const f=fixture('hero',false,template);try{expect(f.pages.querySelector('.canvas-height-handle')).toBeNull();}finally{act(()=>f.root.unmount());}
});
