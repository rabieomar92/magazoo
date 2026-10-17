import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {ImagePanPreview} from './ImagePanControls';
import {type ImageFrame} from '../lib/imageFrame';

beforeEach(()=>vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true));
afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();vi.unstubAllGlobals();});
function fixture(){
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host),change=vi.fn();
  const render=(frame:Partial<ImageFrame>={})=>act(()=>root.render(<ImagePanPreview frame={frame} onChange={change}>{f=><span>{f.panX??0},{f.panY??0}</span>}</ImagePanPreview>));
  render();const surface=host.querySelector<HTMLElement>('[role="group"]')!;
  vi.spyOn(surface,'getBoundingClientRect').mockReturnValue({width:200,height:100,left:0,top:0,right:200,bottom:100,x:0,y:0,toJSON:()=>({})});
  const pointer=(type:string,x:number,y:number)=>act(()=>surface.dispatchEvent(Object.assign(new Event(type,{bubbles:true}),{button:0,pointerId:1,clientX:x,clientY:y})));
  const key=(key:string,shiftKey=false)=>act(()=>surface.dispatchEvent(new KeyboardEvent('keydown',{key,shiftKey,bubbles:true})));
  return{host,root,change,render,surface,pointer,key};
}
describe('lightweight free-pan crop preview',()=>{
  it('previews every move locally and commits only once on release',()=>{
    const f=fixture();try{
      f.pointer('pointerdown',50,50);f.pointer('pointermove',100,75);f.pointer('pointermove',150,100);
      expect(f.change).not.toHaveBeenCalled();expect(f.surface.textContent).toContain('50,50');
      f.pointer('pointerup',150,100);expect(f.change).toHaveBeenCalledExactlyOnceWith({panX:50,panY:50});
    }finally{act(()=>f.root.unmount());}
  });
  it('supports keyboard precision, Shift steps and Home reset',()=>{
    const f=fixture();try{f.key('ArrowLeft');expect(f.change).toHaveBeenLastCalledWith({panX:-1,panY:0});f.key('ArrowDown',true);expect(f.change).toHaveBeenLastCalledWith({panX:0,panY:10});f.key('Home');expect(f.change).toHaveBeenLastCalledWith({panX:0,panY:0});}finally{act(()=>f.root.unmount());}
  });
  it.each(['pointercancel','lostpointercapture'])('discards a %s rather than saving a partial crop',event=>{
    const f=fixture();try{f.pointer('pointerdown',50,50);f.pointer('pointermove',100,75);f.pointer(event,100,75);f.pointer('pointerup',100,75);expect(f.change).not.toHaveBeenCalled();}finally{act(()=>f.root.unmount());}
  });
  it('Escape cancels and external framing changes invalidate a drag',()=>{
    const f=fixture();try{
      f.pointer('pointerdown',50,50);f.pointer('pointermove',100,75);f.key('Escape');f.pointer('pointerup',100,75);expect(f.change).not.toHaveBeenCalled();
      f.pointer('pointerdown',50,50);f.pointer('pointermove',100,75);f.render({scale:2});f.pointer('pointerup',100,75);expect(f.change).not.toHaveBeenCalled();
    }finally{act(()=>f.root.unmount());}
  });
});
