import {useEffect,useRef,type PointerEvent as ReactPointerEvent} from 'react';
import type {Doc} from '../schema/document';
import {pageDimensions} from '../lib/pageFormat';
import {marginTextSettings} from '../lib/pageMarginText';
import {currentDocumentSession,useDoc} from '../store/useDoc';
import {usePreviewReadOnly} from './PreviewReadOnly';

export function marginTextDragPosition(edge:number,bottom:number,_dx:number,dy:number,_right:boolean,pageHeight:number){
 const round=(n:number)=>Math.round(n*10)/10;
 return {edgeOffset:edge,bottomOffset:round(Math.max(0,Math.min(pageHeight,bottom-dy)))};
}
export function useMarginTextDrag(doc:Doc,right:boolean,displayedBottom?:number){
 const readOnly=usePreviewReadOnly(),cleanup=useRef(()=>{}),suppressClick=useRef(false);
 useEffect(()=>()=>cleanup.current(),[doc]);
 const onPointerDown=(event:ReactPointerEvent<HTMLElement>)=>{
  if(readOnly||event.button!==0)return;
  const text=event.currentTarget,rail=text.parentElement!,page=text.closest<HTMLElement>('.page');if(!page)return;
  const dimensions=pageDimensions(doc.design),css=getComputedStyle(page),width=parseFloat(css.width)/(96/25.4)||dimensions.width;
  const scale=page.getBoundingClientRect().width/width,height=page.getBoundingClientRect().height/scale;if(!(scale>0))return;
  event.stopPropagation();cleanup.current();suppressClick.current=false;
  const startX=event.clientX,startY=event.clientY,settings={...marginTextSettings(doc),...(displayedBottom===undefined?{}:{bottomOffset:displayedBottom})},session=currentDocumentSession(),pointer=event.pointerId;
  let moved=false,next={edgeOffset:settings.edgeOffset,bottomOffset:settings.bottomOffset};
  const reset=()=>{rail.style.transform='';text.style.cursor='';window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',finish,true);window.removeEventListener('pointercancel',finish,true);window.removeEventListener('keydown',key,true);};
  const move=(e:PointerEvent)=>{
   if(e.pointerId!==pointer)return;
   const dx=e.clientX-startX,dy=e.clientY-startY;if(!moved&&Math.abs(dy)<4)return;
   moved=true;e.preventDefault();e.stopPropagation();text.style.cursor='grabbing';
   next=marginTextDragPosition(settings.edgeOffset,settings.bottomOffset,dx/scale,dy/scale,right,Math.max(0,height-text.getBoundingClientRect().height/scale));
   rail.style.transform=`translateY(${settings.bottomOffset-next.bottomOffset}mm)`;
  };
  const finish=(e:PointerEvent)=>{
   if(e.pointerId!==pointer)return;reset();
   if(moved){suppressClick.current=true;e.stopPropagation();if(e.type==='pointerup'&&session===currentDocumentSession())useDoc.getState().update(d=>{d.marginText={...d.marginText,bottomOffset:next.bottomOffset,avoidImages:false};});}
  };
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){reset();suppressClick.current=true;}};
  cleanup.current=reset;
  window.addEventListener('pointermove',move,{capture:true,passive:false});window.addEventListener('pointerup',finish,true);window.addEventListener('pointercancel',finish,true);window.addEventListener('keydown',key,true);
 };
 return {onPointerDown,consumeClick:()=>{const value=suppressClick.current;suppressClick.current=false;return value;},readOnly};
}
