import {useEffect,useLayoutEffect,useRef,useState,type RefObject,type PointerEvent as ReactPointerEvent} from 'react';
import {createPortal} from 'react-dom';
import type {Doc} from '../schema/document';
import {canvasElementControls,canvasTextTarget,type ElementControl} from '../lib/canvasElementControls';
import {currentDocumentSession,useDoc} from '../store/useDoc';
import {textStyleSelector} from '../lib/textStyles';
import '../styles/canvas-element-handles.css';
import {canvasToolbarPosition} from '../lib/canvasToolbarPosition';

type Selection={element:HTMLElement;key?:string;page?:number};
type Gesture={control:ElementControl;element:HTMLElement;pointer:number;x:number;y:number;scale:number;leading:number;next:number;session:number;doc:Doc;style:string;moved:boolean};
/** An element-local selection outline; never inserted into measured text flow. */
export function CanvasElementHandles({doc,root}:{doc:Doc;root:RefObject<HTMLDivElement|null>}){
 const [selection,setSelection]=useState<Selection|null>(null),[box,setBox]=useState<DOMRect|null>(null),[draft,setDraft]=useState<string>('');
 const gesture=useRef<Gesture|null>(null);
 const tools=useRef<HTMLDivElement|null>(null);
 const [toolPosition,setToolPosition]=useState({left:12,top:12});
 useLayoutEffect(()=>{
  if(!box||!tools.current)return;
  const measure=()=>{const r=tools.current!.getBoundingClientRect();const next=canvasToolbarPosition(box,r.width,r.height,window.innerWidth,window.innerHeight);setToolPosition(old=>old.left===next.left&&old.top===next.top?old:next);};
  measure();const observer=new ResizeObserver(measure);observer.observe(tools.current);window.addEventListener('resize',measure);return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
 },[box,doc]);
 const cancel=()=>{const state=gesture.current;if(state){state.element.style.cssText=state.style;delete state.element.dataset.layoutDragging;delete state.element.dataset.dragging;}gesture.current=null;setDraft('');};
 useEffect(()=>{
  const choose=(event:MouseEvent)=>{
   if(gesture.current||!(event.target instanceof Element)||event.target.closest('[data-editor-only]'))return;
   const target=event.target;if(!target.closest('.page'))return;
   const explicit=target.closest<HTMLElement>('.header,.article-header-position,.tag-bar,.page-folio,.fm-header,.fm-board-list-header,.news-header,.mag2-head-content,.mag-cover-mid,[data-editor-target="image-hero"],[data-editor-target="image-backcover-qr"],[data-editor-target="image-backcover-logo"],[data-editor-target="image-logo"],[data-editor-target="image-signature"]');
   const text=canvasTextTarget(doc,target);
   const next=text??(explicit?{element:explicit}:undefined);
   setSelection(next&&canvasElementControls(doc,next.element,'key' in next?next.key:undefined).length?{...next,page:[...root.current!.querySelectorAll('.page')].indexOf(next.element.closest('.page')!)}:null);
  };
  const host=root.current;host?.addEventListener('click',choose);return()=>host?.removeEventListener('click',choose);
 },[doc,root]);
 useLayoutEffect(()=>{
  const measure=()=>{if(gesture.current)return;if(!selection?.element.isConnected){
   const selector=selection?.key?textStyleSelector(selection.key):undefined;
   const pages=root.current?.querySelectorAll('.page');const page=pages?.[selection?.page??0];
   const replacement=selector?page?.querySelector<HTMLElement>(selector)??root.current?.querySelector<HTMLElement>(selector):undefined;
   if(replacement){setSelection({...selection!,element:replacement});return;}setBox(null);return;
  }const next=selection.element.getBoundingClientRect();setBox(previous=>previous&&previous.x===next.x&&previous.y===next.y&&previous.width===next.width&&previous.height===next.height?previous:next);};
  measure();window.addEventListener('scroll',measure,true);window.addEventListener('resize',measure);
  const observer=new ResizeObserver(measure);if(selection)observer.observe(selection.element);
  return()=>{observer.disconnect();window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);};
 },[selection,doc,root]);
 useEffect(()=>{cancel();return()=>{const state=gesture.current;if(state){state.element.style.cssText=state.style;delete state.element.dataset.layoutDragging;delete state.element.dataset.dragging;}gesture.current=null;};},[doc,selection]);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){cancel();setSelection(null);}};
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 });
 if(!selection||!box||!selection.element.isConnected)return null;
 const controls=canvasElementControls(doc,selection.element,selection.key);
 const begin=(event:ReactPointerEvent<HTMLButtonElement>,control:ElementControl)=>{
  if(event.button!==0)return;const page=selection.element.closest<HTMLElement>('.page');if(!page)return;
  const physical=parseFloat(getComputedStyle(page).width)/(96/25.4),scale=page.getBoundingClientRect().width/physical;if(!(scale>0))return;
  event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
  const element=control.element??selection.element;
  const css=getComputedStyle(element),leading=parseFloat(css.lineHeight)/parseFloat(css.fontSize)||1.2;
  gesture.current={control,element,pointer:event.pointerId,x:event.clientX,y:event.clientY,scale,leading,next:control.value,session:currentDocumentSession(),doc:useDoc.getState().doc,style:element.style.cssText,moved:false};
  if(control.paint==='gateWidth'||control.paint==='gateInset'){
   const parent=element.offsetParent as HTMLElement|null,origin=parent?.getBoundingClientRect(),r=element.getBoundingClientRect();
   if(origin){const rtl=doc.design.textDirection==='rtl';Object.assign(element.style,{position:'absolute',insetInlineStart:'auto',insetInlineEnd:'auto',left:rtl?'auto':`${(r.left-origin.left)/scale}mm`,right:rtl?`${(origin.right-r.right)/scale}mm`:'auto',top:`${(r.top-origin.top)/scale}mm`,width:`${r.width/scale}mm`,margin:'0'});}
   element.dataset.layoutDragging='true';element.dataset.dragging='true';
  }
 };
 const finish=(event:ReactPointerEvent<HTMLButtonElement>)=>{
  const state=gesture.current;if(!state||state.pointer!==event.pointerId)return;
  const commit=event.type==='pointerup'&&state.moved&&state.session===currentDocumentSession()&&state.doc===useDoc.getState().doc;
  cancel();if(commit)useDoc.getState().update(d=>state.control.save(d,state.next));
 };
 return createPortal(<div className="canvas-element-outline" data-editor-only="true" style={{left:box.left,top:box.top,width:box.width,height:box.height}}>
  <div ref={tools} className="canvas-element-tools" role="group" aria-label="Selected element drag handles" style={toolPosition}>
   {controls.map(control=><button key={control.id} data-drag-axis={control.axis} type="button" aria-label={`Drag ${control.label.toLowerCase()}`} title={`${control.label}: ${control.value.toFixed(2)} ${control.unit} · drag ${control.axis==='x'?'horizontally':'vertically'} · arrows fine-tune · Escape cancels`} onPointerDown={e=>begin(e,control)} onPointerMove={event=>{
    const state=gesture.current;if(!state||state.pointer!==event.pointerId)return;
    const control=state.control;
    const travel=control.axis==='x'?event.clientX-state.x:event.clientY-state.y;if(Math.abs(travel)<3&&!state.moved)return;state.moved=true;
    const delta=travel/state.scale;
    const sign=control.direction??(control.id==='footer'?-1:1);
    state.next=Number((Math.round(Math.max(control.min,Math.min(control.max,control.value+sign*delta))/control.step)*control.step).toFixed(4));
    const el=state.element;
    if(control.paint==='moveY')el.style.transform=`translateY(${sign*(state.next-control.value)}mm)`;
    if(control.paint==='width'||control.paint==='gateWidth')el.style.width=`${state.next}mm`;
    if(control.paint==='gateInset')el.style.transform=`translateX(${sign*(state.next-control.value)}mm)`;
    setDraft(`${control.label}: ${state.next.toFixed(control.step<.1?2:1)} ${control.unit}`);
   }} onPointerUp={finish} onPointerCancel={finish} onClick={e=>e.stopPropagation()} onKeyDown={event=>{
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();const direction=(['ArrowUp','ArrowLeft'].includes(event.key)?-1:1)*(control.direction??(control.id==='footer'?-1:1));
    useDoc.getState().update(d=>control.save(d,Math.max(control.min,Math.min(control.max,control.value+direction*control.step*(event.shiftKey?10:1)))));
   }}><span>{control.id==='gateWidth'?'Width':control.id==='gateInset'?'Inset':control.label}</span><span className="canvas-control-reading">{(gesture.current?.control.id===control.id?gesture.current.next:control.value).toFixed(control.step<.1?2:1)} <small>{control.unit}</small></span></button>)}
   <button type="button" aria-label="Dismiss element handles" onClick={()=>setSelection(null)}>×</button>
  </div>
  {draft&&<output className="canvas-element-value" aria-live="polite">{draft}</output>}
 </div>,document.body);
}
