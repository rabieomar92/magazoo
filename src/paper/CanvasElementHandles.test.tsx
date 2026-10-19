import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {CanvasElementHandles} from './CanvasElementHandles';
import {presetFor} from '../store/presets';
import {useDoc} from '../store/useDoc';

function fixture(){
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 const doc=presetFor('paper-8');useDoc.getState().load(doc);
 const pages=document.createElement('div');pages.innerHTML='<div class="page" style="width:687.874px"><div class="header"><h1 class="title" style="font-size:24px;line-height:26px">Title</h1></div></div>';document.body.append(pages);
 const page=pages.firstElementChild as HTMLElement;page.getBoundingClientRect=()=>({width:343.937,height:485,top:0,left:0,right:343.937,bottom:485,x:0,y:0,toJSON:()=>({})});
 const title=pages.querySelector('h1')!;title.getBoundingClientRect=()=>({width:100,height:20,top:40,left:10,right:110,bottom:60,x:10,y:40,toJSON:()=>({})});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);act(()=>root.render(<CanvasElementHandles doc={doc} root={{current:pages}}/>));act(()=>title.click());
 const button=document.querySelector<HTMLButtonElement>('[aria-label="Drag heading position"]')!;button.setPointerCapture=()=>{};
 const send=(type:string,x:number)=>act(()=>button.dispatchEvent(Object.assign(new Event(type,{bubbles:true}),{pointerId:1,button:0,clientX:20,clientY:x})));
 return{doc,title,button,send,cleanup:()=>{act(()=>root.unmount());host.remove();pages.remove();vi.unstubAllGlobals();}};
}
it('moves the heading without changing typography',()=>{
 const f=fixture();try{const before=useDoc.getState().doc;f.send('pointerdown',10);f.send('pointermove',26);expect(useDoc.getState().doc).toBe(before);f.send('pointerup',26);expect(useDoc.getState().doc.design.firstPageTopMargin).toBeGreaterThan(0);expect(f.title.style.fontSize).toBe('24px');expect(f.title.style.lineHeight).toBe('26px');expect(document.querySelector('[aria-label="Drag text size"]')).toBeNull();expect(document.querySelector('[aria-label="Drag line spacing"]')).toBeNull();}finally{f.cleanup();}
});
it.each(['escape','pointercancel','new-document'] as const)('%s cancels safely without a saved edit',mode=>{
 const f=fixture();try{const before=useDoc.getState().doc;f.send('pointerdown',10);f.send('pointermove',26);if(mode==='escape')act(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})));else if(mode==='new-document'){act(()=>useDoc.getState().load(presetFor('paper-1')));f.send('pointerup',26);}else f.send('pointercancel',26);expect(useDoc.getState().doc.design.textStyles?.title?.fontSize).toBeUndefined();if(mode!=='new-document')expect(useDoc.getState().doc).toBe(before);expect(f.title.style.fontSize).toBe('24px');}finally{f.cleanup();}
});
