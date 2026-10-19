import {useRef,useState,type PointerEvent} from 'react';
import type {CropPoint} from '../lib/imageCrop';
/** Vertex gestures only: dragging empty space never draws a freehand path. */
export function PolygonPoints({points,onChange,rectangle=false}:{points:CropPoint[];onChange:(p:CropPoint[])=>void;rectangle?:boolean}){
 const [selected,setSelected]=useState(0);
 const drag=useRef<{id:number;index:number;before:CropPoint[]}|null>(null);
 const position=(e:PointerEvent<SVGSVGElement>)=>{const r=e.currentTarget.getBoundingClientRect();return {x:Math.max(0,Math.min(100,(e.clientX-r.left)/(r.width||1)*100)),y:Math.max(0,Math.min(100,(e.clientY-r.top)/(r.height||1)*100))};};
 return <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Edit polygon points" role="group"
 onPointerDown={e=>{const index=(e.target as SVGElement).getAttribute('data-vertex');if(e.button!==0||index===null)return;e.preventDefault();e.stopPropagation();setSelected(Number(index));drag.current={id:e.pointerId,index:Number(index),before:points};e.currentTarget.setPointerCapture?.(e.pointerId);}}
 onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;e.preventDefault();const p=position(e);if(rectangle&&points.length===4){const opposite=d.before[(d.index+2)%4];const x0=Math.min(p.x,opposite.x),x1=Math.max(p.x,opposite.x),y0=Math.min(p.y,opposite.y),y1=Math.max(p.y,opposite.y);onChange([{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}]);}else onChange(points.map((old,i)=>i===d.index?p:old));}}
 onPointerUp={()=>{drag.current=null;}}
 onPointerCancel={()=>{if(drag.current)onChange(drag.current.before);drag.current=null;}}
 onLostPointerCapture={()=>{drag.current=null;}}>
 <polygon points={points.map(p=>`${p.x},${p.y}`).join(' ')} fillRule="evenodd"/>
 {points.map((p,i)=>{const next=points[(i+1)%points.length];return <g key={i}>
 <line className="polygon-edge" x1={p.x} y1={p.y} x2={next.x} y2={next.y} onClick={e=>{if(points.length>=128)return;e.stopPropagation();const r=e.currentTarget.ownerSVGElement!.getBoundingClientRect();const added={x:(e.clientX-r.left)/r.width*100,y:(e.clientY-r.top)/r.height*100};onChange([...points.slice(0,i+1),added,...points.slice(i+1)]);setSelected(i+1);}}><title>Click edge to add a point</title></line>
 <circle data-vertex={i} cx={p.x} cy={p.y} r="1.1" className={`polygon-point${selected===i?' is-selected':''}`} tabIndex={0} role="button" aria-label={`Point ${i+1}; arrows move, Delete removes`} onFocus={()=>setSelected(i)} onDoubleClick={()=>{if(points.length>3)onChange(points.filter((_,j)=>i!==j));}} onKeyDown={e=>{
 if((e.key==='Delete'||e.key==='Backspace')&&points.length>3){e.preventDefault();onChange(points.filter((_,j)=>i!==j));}
 if(e.key.startsWith('Arrow')){e.preventDefault();const n=e.shiftKey?5:1;onChange(points.map((q,j)=>i===j?{x:Math.max(0,Math.min(100,q.x+(e.key==='ArrowRight'?n:e.key==='ArrowLeft'?-n:0))),y:Math.max(0,Math.min(100,q.y+(e.key==='ArrowDown'?n:e.key==='ArrowUp'?-n:0)))}:q));}
 }}><title>Drag point · double-click to remove</title></circle></g>;})}
 </svg>;
}
