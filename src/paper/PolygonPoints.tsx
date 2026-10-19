import {useLayoutEffect,useRef,useState,type PointerEvent} from 'react';
import type {CropPoint} from '../lib/imageCrop';
/** Render every edge before every vertex: a wide edge hit target must never
 * cover a vertex. Capture on the vertex itself so double-click stays there. */
export function PolygonPoints({points,onChange,rectangle=false}:{points:CropPoint[];onChange:(p:CropPoint[])=>void;rectangle?:boolean}){
 const [selected,setSelected]=useState(0),[size,setSize]=useState({width:400,height:300});
 const svg=useRef<SVGSVGElement>(null);
 const drag=useRef<{id:number;index:number;before:CropPoint[];target:Element}|null>(null);
 useLayoutEffect(()=>{const el=svg.current;if(!el)return;const measure=()=>{const width=el.clientWidth,height=el.clientHeight;if(width&&height)setSize({width,height});};measure();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);observer?.observe(el);return()=>observer?.disconnect();},[]);
 const x=(value:number)=>value*size.width/100,y=(value:number)=>value*size.height/100;
 const point=(e:{clientX:number;clientY:number})=>{const r=svg.current!.getBoundingClientRect();return{x:Math.max(0,Math.min(100,(e.clientX-r.left)/(r.width||1)*100)),y:Math.max(0,Math.min(100,(e.clientY-r.top)/(r.height||1)*100))};};
 const remove=(index:number)=>{if(points.length<=3)return;onChange(points.filter((_,i)=>i!==index));setSelected(Math.max(0,index-1));};
 const finish=(e:PointerEvent<SVGSVGElement>,cancel=false)=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;drag.current=null;if(cancel)onChange(d.before);if(d.target.hasPointerCapture?.(e.pointerId))d.target.releasePointerCapture(e.pointerId);};
 return <svg ref={svg} viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-label="Edit polygon points" role="group"
 onPointerDown={e=>{const target=(e.target as Element).closest<SVGGraphicsElement>('[data-vertex]');if(e.button!==0||!target)return;e.preventDefault();e.stopPropagation();const index=Number(target.dataset.vertex);setSelected(index);target.focus();drag.current={id:e.pointerId,index,before:points,target};target.setPointerCapture?.(e.pointerId);}}
 onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();const p=point(e);if(rectangle&&points.length===4){const opposite=d.before[(d.index+2)%4];onChange([{x:Math.min(p.x,opposite.x),y:Math.min(p.y,opposite.y)},{x:Math.max(p.x,opposite.x),y:Math.min(p.y,opposite.y)},{x:Math.max(p.x,opposite.x),y:Math.max(p.y,opposite.y)},{x:Math.min(p.x,opposite.x),y:Math.max(p.y,opposite.y)}]);}else onChange(points.map((old,i)=>i===d.index?p:old));}}
 onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={()=>{drag.current=null;}}>
 <polygon points={points.map(p=>`${x(p.x)},${y(p.y)}`).join(' ')} fillRule="evenodd"/>
 {points.map((p,i)=>{const next=points[(i+1)%points.length];return <line key={`edge-${i}`} className="polygon-edge" x1={x(p.x)} y1={y(p.y)} x2={x(next.x)} y2={y(next.y)} onClick={e=>{if(points.length>=128)return;e.stopPropagation();onChange([...points.slice(0,i+1),point(e),...points.slice(i+1)]);setSelected(i+1);}}><title>Click edge to add a point</title></line>;})}
 {points.map((p,i)=><g key={`point-${i}`} data-vertex={i} className={`polygon-point${selected===i?' is-selected':''}`} tabIndex={0} role="button" aria-label={`Point ${i+1}; arrows move, Delete removes`} aria-pressed={selected===i} onFocus={()=>setSelected(i)} onClick={e=>{e.stopPropagation();setSelected(i);e.currentTarget.focus();}} onDoubleClick={e=>{e.preventDefault();e.stopPropagation();remove(i);}} onKeyDown={e=>{
 if(['Delete','Backspace'].includes(e.key)){e.preventDefault();e.stopPropagation();remove(i);}
 if(e.key.startsWith('Arrow')){e.preventDefault();e.stopPropagation();const n=e.shiftKey?5:1;onChange(points.map((q,j)=>i===j?{x:Math.max(0,Math.min(100,q.x+(e.key==='ArrowRight'?n:e.key==='ArrowLeft'?-n:0))),y:Math.max(0,Math.min(100,q.y+(e.key==='ArrowDown'?n:e.key==='ArrowUp'?-n:0)))}:q));}
 }}><title>Drag point · double-click or Delete to remove</title><circle className="polygon-point-hit" cx={x(p.x)} cy={y(p.y)} r={9}/><circle className="polygon-point-visible" cx={x(p.x)} cy={y(p.y)} r={4}/></g>)}
 </svg>;
}
