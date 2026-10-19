import {useLayoutEffect,useState,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {documentBleed} from '../lib/documentBleed';
import '../styles/canvas-bleed.css';
export function CanvasBleedGuides({root,bleedMm}:{root:RefObject<HTMLDivElement|null>;bleedMm?:number}){
 const [pages,setPages]=useState<HTMLElement[]>([]),bleed=documentBleed(bleedMm);
 useLayoutEffect(()=>{
  const host=root.current;if(!host)return;
  const old=host.style.getPropertyValue('--canvas-bleed');host.style.setProperty('--canvas-bleed',`${bleed}mm`);
  if(bleed)host.dataset.bleedGuides='true';else delete host.dataset.bleedGuides;
  const collect=()=>{const next=[...host.querySelectorAll<HTMLElement>('.page')];setPages(previous=>previous.length===next.length&&previous.every((p,i)=>p===next[i])?previous:next);};
  collect();const observer=new MutationObserver(collect);observer.observe(host,{childList:true,subtree:true});
  return()=>{observer.disconnect();delete host.dataset.bleedGuides;if(old)host.style.setProperty('--canvas-bleed',old);else host.style.removeProperty('--canvas-bleed');};
 },[root,bleed]);
 return bleed?<>{pages.map((page,i)=>createPortal(<div className="canvas-bleed-guide" data-editor-only="true" aria-hidden="true"/>,page,String(i)))}</>:null;
}
