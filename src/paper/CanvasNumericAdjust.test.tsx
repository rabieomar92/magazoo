import {act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {CanvasNumericAdjust} from './CanvasNumericAdjust';
import {draggedNumericValue} from '../lib/canvasNumericValue';
it('quantizes fine values and respects both bounds',()=>{
 expect(draggedNumericValue(8.8,16,.1,5,12)).toBe(9);
 expect(draggedNumericValue(8.8,-500,.1,5,12)).toBe(5);
 expect(draggedNumericValue(8.8,500,.1,5,12)).toBe(12);
});
it('routes one committed drag through the existing React number control',()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const changed=vi.fn();function Fixture(){const [value,setValue]=useState(8.8);return <><label>Page margin<input type="number" step="0.1" min="5" max="12" value={value} onChange={e=>{changed(Number(e.target.value));setValue(Number(e.target.value));}}/></label><CanvasNumericAdjust/></>;}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  act(()=>root.render(<Fixture/>));const input=host.querySelector('input')!;act(()=>input.focus());
  const handle=host.querySelector<HTMLButtonElement>('[aria-label^="Drag to adjust"]')!;handle.setPointerCapture=()=>{};
  const event=(type:string,x:number)=>Object.assign(new Event(type,{bubbles:true}),{button:0,pointerId:1,clientX:x});
  act(()=>handle.dispatchEvent(event('pointerdown',10)));act(()=>handle.dispatchEvent(event('pointermove',26)));
  expect(changed).not.toHaveBeenCalled();act(()=>handle.dispatchEvent(event('pointerup',26)));
  expect(changed).toHaveBeenCalledExactlyOnceWith(9);expect(input.value).toBe('9');
  act(()=>handle.dispatchEvent(event('pointerdown',10)));act(()=>handle.dispatchEvent(event('pointermove',50)));
  act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  act(()=>handle.dispatchEvent(event('pointerup',50)));
  expect(changed).toHaveBeenCalledTimes(1);expect(input.value).toBe('9');
 }finally{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
