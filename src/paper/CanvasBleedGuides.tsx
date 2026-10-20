import {useLayoutEffect,useState,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {documentBleed} from '../lib/documentBleed';
import '../styles/canvas-bleed.css';
import {cropMarkSegments,paperSize,type PdfPageSize} from '../lib/pdfPageSize';
export function CanvasBleedGuides({root,bleedMm,bleedCanvas=false,size='a4',pageSelector='.page'}:{root:RefObject<HTMLDivElement|null>;bleedMm?:number;bleedCanvas?:boolean;size?:PdfPageSize;pageSelector?:string}){
 const [pages,setPages]=useState<HTMLElement[]>([]),bleed=documentBleed(bleedMm);
 useLayoutEffect(()=>{
  const host=root.current;if(!host)return;
  const old=host.style.getPropertyValue('--canvas-bleed');host.style.setProperty('--canvas-bleed',`${bleed}mm`);
  if(bleed&&!bleedCanvas)host.dataset.bleedGuides='true';else delete host.dataset.bleedGuides;
  const collect=()=>{const next=[...host.querySelectorAll<HTMLElement>(pageSelector)];setPages(previous=>previous.length===next.length&&previous.every((p,i)=>p===next[i])?previous:next);};
  collect();const observer=new MutationObserver(collect);observer.observe(host,{childList:true,subtree:true});
  return()=>{observer.disconnect();delete host.dataset.bleedGuides;if(old)host.style.setProperty('--canvas-bleed',old);else host.style.removeProperty('--canvas-bleed');};
 },[root,bleed,bleedCanvas,pageSelector]);
 const trim=paperSize(size);
 return bleed?<>{pages.map((page,i)=>createPortal(<><div className="canvas-bleed-guide" data-editor-only="true" aria-hidden="true" style={bleedCanvas?{inset:`${bleed}mm`}:undefined}/>{bleedCanvas&&<svg className="canvas-trim-corners" data-editor-only="true" aria-hidden="true" viewBox={`0 0 ${trim.width+2*bleed} ${trim.height+2*bleed}`} preserveAspectRatio="none">{cropMarkSegments(trim.width,trim.height,bleed).map(([x1,y1,x2,y2],j)=><line key={j} x1={x1} y1={y1} x2={x2} y2={y2}/>)}</svg>}</>,page,String(i)))}</>:null;
}
