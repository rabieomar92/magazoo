import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {currentDocumentSession} from '../store/useDoc';
import {draggedNumericValue} from '../lib/canvasNumericValue';
import '../styles/canvas-numeric-adjust.css';

/** A shared canvas scrubber for layout number/range controls, including native
 * template-specific fields. It routes the final input event through the
 * existing control, so its validation and saved-data contract remain intact. */
export function CanvasNumericAdjust(){
 const [input,setInput]=useState<HTMLInputElement|null>(null),[draft,setDraft]=useState<number|null>(null);
 const gesture=useRef<{x:number;value:number;next:number;step:number;min:number;max:number;pointer:number;session:number}|null>(null);
 useEffect(()=>{
  const select=(event:FocusEvent)=>{const node=event.target;if(node instanceof HTMLInputElement&&['number','range'].includes(node.type)&&!node.disabled&&!node.readOnly&&!node.closest('[data-editor-only]')){const label=node.getAttribute('aria-label')||node.labels?.[0]?.textContent||'';const typography=node.closest('[data-style-property="fontSize"],[data-style-property="lineHeight"]')||/(?:font|text|type|caption|title|subtitle|body|reference|highlight|footer).*size|line\s*(?:height|spacing)|leading/i.test(label);setInput(typography?null:node);setDraft(null);}};
  document.addEventListener('focusin',select);return()=>document.removeEventListener('focusin',select);
 },[]);
 useEffect(()=>{
  const cancel=(e:KeyboardEvent)=>{if(e.key==='Escape'){gesture.current=null;setDraft(null);}};
  document.addEventListener('keydown',cancel);return()=>document.removeEventListener('keydown',cancel);
 },[]);
 if(!input||!input.isConnected||input.disabled||input.readOnly)return null;
 const label=input.getAttribute('aria-label')||input.labels?.[0]?.querySelector('.field-label')?.textContent||input.labels?.[0]?.textContent?.slice(0,70)||'Selected value';
 const begin=(event:ReactPointerEvent<HTMLButtonElement>)=>{
  if(event.button!==0||!Number.isFinite(input.valueAsNumber))return;
  event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
  gesture.current={x:event.clientX,value:input.valueAsNumber,next:input.valueAsNumber,step:Math.max(.000001,Number(input.step)||1),min:input.min===''?-Infinity:Number(input.min),max:input.max===''?Infinity:Number(input.max),pointer:event.pointerId,session:currentDocumentSession()};setDraft(input.valueAsNumber);
 };
 const finish=(event:ReactPointerEvent<HTMLButtonElement>)=>{
  const state=gesture.current;gesture.current=null;setDraft(null);
  if(!state||event.type!=='pointerup'||state.session!==currentDocumentSession()||!input.isConnected||input.disabled||input.readOnly||state.next===state.value)return;
  // React's value tracker must see a real native input transition. No store
  // shortcut: this also supports controls owned by covers, news and galleries.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,String(state.next));
  input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
 };
 return <div className="canvas-numeric-adjust" data-editor-only="true" role="group" aria-label="Canvas numeric adjustment">
  <span>{label}</span><button type="button" aria-label={`Drag to adjust ${label}`} title="Drag left or right to adjust · Escape cancels" onPointerDown={begin} onPointerMove={event=>{const state=gesture.current;if(!state||state.pointer!==event.pointerId)return;state.next=draggedNumericValue(state.value,event.clientX-state.x,state.step,state.min,state.max);setDraft(state.next);}} onPointerUp={finish} onPointerCancel={finish}>↔ {draft??input.value}</button>
  <button type="button" aria-label="Close canvas adjustment" onClick={()=>setInput(null)}>×</button>
 </div>;
}
