import {useLayoutEffect,useRef,useState} from 'react';
import type {Doc} from '../schema/document';
import {pageDimensions} from '../lib/pageFormat';
import {marginTextPlacement} from '../lib/marginTextPlacement';

export function useMarginTextPlacement(doc:Doc,text:string,right:boolean,edge:number,bottom:number){
 const rail=useRef<HTMLDivElement>(null);
 const [placement,setPlacement]=useState({right,bottom,blocked:false});
 useLayoutEffect(()=>{
  const host=rail.current,page=host?.closest<HTMLElement>('.page'),label=host?.querySelector<HTMLElement>('.page-margin-text');
  if(!host||!page||!label)return;
  let frame=0;
  const measure=()=>{
   frame=0;const bounds=page.getBoundingClientRect(),dimensions=pageDimensions(doc.design),scale=bounds.width/dimensions.width;
   if(!(scale>0)){setPlacement(previous=>previous.right===right&&previous.bottom===bottom&&!previous.blocked?previous:{right,bottom,blocked:false});return;}
   const labelBox=label.getBoundingClientRect();
   const images=[...page.querySelectorAll<HTMLElement>('*')].filter(el=>!host.contains(el)&&(el.tagName==='IMG'||getComputedStyle(el).backgroundImage.includes('url('))).map(el=>el.getBoundingClientRect()).filter(box=>box.width>1&&box.height>1&&(box.left<=bounds.left+(doc.design.bleedMm??0)*scale+1||box.right>=bounds.right-(doc.design.bleedMm??0)*scale-1)).map(box=>({left:(box.left-bounds.left)/scale,right:(box.right-bounds.left)/scale,top:(box.top-bounds.top)/scale,bottom:(box.bottom-bounds.top)/scale}));
   const next=marginTextPlacement(dimensions.width,dimensions.height,labelBox.width/scale,labelBox.height/scale,edge,bottom,right,images);
   setPlacement(previous=>previous.right===next.right&&Math.abs(previous.bottom-next.bottom)<.05&&previous.blocked===next.blocked?previous:next);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
  measure();
  const resize=typeof ResizeObserver==='undefined'?null:new ResizeObserver(schedule);resize?.observe(page);resize?.observe(label);
  const mutations=new MutationObserver(records=>{if(records.some(record=>!host.contains(record.target)))schedule();});
  mutations.observe(page,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','src']});
  page.addEventListener('load',schedule,true);document.fonts?.addEventListener('loadingdone',schedule);
  return()=>{cancelAnimationFrame(frame);resize?.disconnect();mutations.disconnect();page.removeEventListener('load',schedule,true);document.fonts?.removeEventListener('loadingdone',schedule);};
 },[doc,text,right,edge,bottom]);
 return {rail,...placement};
}
