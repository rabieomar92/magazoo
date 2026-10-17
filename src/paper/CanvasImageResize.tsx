/** @jsxImportSource ../lib/mathJsx */
import {useEffect,useLayoutEffect,useRef,useState,type RefObject,type PointerEvent as ReactPointerEvent} from 'react';
import {createPortal} from 'react-dom';
import type {Doc} from '../schema/document';
import {pageDimensions} from '../lib/pageFormat';
import {currentDocumentSession,useDoc} from '../store/useDoc';
import '../styles/canvas-image-resize.css';

type Target={kind:'image';id:string}|{kind:'hero'};
type Candidate={frame:HTMLElement;owner:HTMLElement;target:Target};
type Side='top'|'bottom';
export function resizedVerticalFrame(height:number,top:number,delta:number,side:Side,limit:number,maxHeight=limit){
  const bottom=top+height;
  const nextHeight=Math.max(1,Math.min(maxHeight,side==='top'?bottom:limit-top,height+(side==='top'?-delta:delta)));
  return {height:Math.round(nextHeight*100)/100,top:Math.round((side==='top'?bottom-nextHeight:top)*100)/100};
}

/** Resize the frame, not the photo's zoom. Pointer drafts are DOM-only; one
 * history/autosave update is made on release, never on every mouse move. */
export function CanvasImageResize({doc,root}:{doc:Doc;root:RefObject<HTMLDivElement|null>}){
  const[candidates,setCandidates]=useState<Candidate[]>([]);
  const drag=useRef<{candidate:Candidate;side:Side;pointer:number;y:number;scale:number;height:number;top:number;limit:number;max:number;next:{height:number;top:number};frameStyle:string;ownerStyle:string;session:number;moved:boolean}|null>(null);
  const cancel=()=>{const state=drag.current;if(!state)return;state.candidate.frame.style.cssText=state.frameStyle;state.candidate.owner.style.cssText=state.ownerStyle;delete state.candidate.frame.dataset.heightResizing;drag.current=null;};
  useLayoutEffect(()=>{
    const host=root.current;if(!host)return;
    const collect=()=>{
      const next:Candidate[]=[];
      for(const image of host.querySelectorAll<HTMLImageElement>('.page img.framed-image')){
        const frame=image.parentElement;if(!frame||image.closest('[data-editor-only]'))continue;
        const placed=image.closest<HTMLElement>('[data-image-id]'),id=placed?.dataset.imageId;
        if(id&&doc.images.some(item=>item.id===id)){next.push({frame,owner:placed!,target:{kind:'image',id}});continue;}
        // Full-page covers/backgrounds and fixed spread strips have no
        // independent height. Do not offer an inert control for those frames.
        const owner=image.closest<HTMLElement>('[data-editor-target="image-hero"]');
        if(owner&&!['magazine-2','magazine-3','magazine-4','backcover-1','frontmatter-board'].includes(doc.templateId??''))next.push({frame,owner,target:{kind:'hero'}});
      }
      setCandidates(previous=>previous.length===next.length&&previous.every((c,i)=>c.frame===next[i].frame&&JSON.stringify(c.target)===JSON.stringify(next[i].target))?previous:next);
    };
    collect();const observer=new MutationObserver(collect);observer.observe(host,{childList:true,subtree:true});return()=>observer.disconnect();
  },[doc,root]);
  useEffect(()=>{cancel();return cancel;},[doc]);
  const save=(candidate:Candidate,value:{height:number;top:number},side:Side)=>useDoc.getState().update(current=>{
    if(candidate.target.kind==='hero')current.design.heroHeight=value.height;
    else{const id=candidate.target.id;const image=current.images.find(item=>item.id===id);if(image){image.heightMm=Math.max(1,value.height-(image.bleed?.top?image.anchor.y:0));if(side==='top')image.anchor.y=value.top;}}
  });
  useEffect(()=>{
    const move=(event:PointerEvent)=>{
      const state=drag.current;if(!state||state.pointer!==event.pointerId)return;
      event.preventDefault();event.stopPropagation();const delta=(event.clientY-state.y)/state.scale;
      if(!state.moved&&Math.abs(event.clientY-state.y)<3)return;
      state.moved=true;state.next=resizedVerticalFrame(state.height,state.top,delta,state.side,state.limit,state.max);
      const {frame,owner,target}=state.candidate;
      frame.style.height=`${state.next.height}mm`;
      if(target.kind==='image'){owner.style.setProperty('--placed-image-h',`${state.next.height}mm`);if(state.side==='top')owner.style.top=`${state.next.top}mm`;}
      else if(doc.design.heroAtBottom)owner.style.transform=`translateY(${state.next.top-state.top}mm)`;
      frame.dataset.heightResizing='true';
    };
    const finish=(event:PointerEvent)=>{
      const state=drag.current;if(!state||state.pointer!==event.pointerId)return;
      event.stopPropagation();const commit=event.type==='pointerup'&&state.moved&&state.session===currentDocumentSession();
      cancel();if(commit)save(state.candidate,state.next,state.side);
    };
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&drag.current){event.preventDefault();event.stopPropagation();cancel();}};
    window.addEventListener('pointermove',move,{capture:true,passive:false});window.addEventListener('pointerup',finish,true);window.addEventListener('pointercancel',finish,true);window.addEventListener('keydown',key,true);
    return()=>{window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',finish,true);window.removeEventListener('pointercancel',finish,true);window.removeEventListener('keydown',key,true);};
  },[doc]);
  const begin=(event:ReactPointerEvent,candidate:Candidate,side:Side)=>{
    if(event.button!==0||candidate.frame.closest('[data-outline-editing="true"]')||candidate.frame.querySelector('.canvas-pan-surface'))return;
    const page=candidate.frame.closest<HTMLElement>('.page');if(!page)return;
    const pageRect=page.getBoundingClientRect(),rect=candidate.frame.getBoundingClientRect(),dimensions=pageDimensions(doc.design),scale=pageRect.width/dimensions.width;
    if(!(scale>0&&rect.height>0))return;
    event.preventDefault();event.stopPropagation();cancel();event.currentTarget.setPointerCapture?.(event.pointerId);
    const top=(rect.top-pageRect.top)/scale,height=rect.height/scale,limit=page.offsetHeight/(96/25.4);
    drag.current={candidate,side,pointer:event.pointerId,y:event.clientY,scale,top,height,limit,max:candidate.target.kind==='hero'?160:limit,next:{top,height},frameStyle:candidate.frame.style.cssText,ownerStyle:candidate.owner.style.cssText,session:currentDocumentSession(),moved:false};
  };
  return <>{candidates.flatMap((candidate,index)=>(['top','bottom'] as const).filter(side=>{
    if(candidate.target.kind==='hero')return side===(doc.design.heroAtBottom?'top':'bottom');
    const id=candidate.target.id;const image=doc.images.find(item=>item.id===id);
    return !image?.bleed?.[side];
  }).map(side=>createPortal(<button key={side} type="button" className={`canvas-height-handle canvas-height-handle--${side}`} style={candidate.target.kind==='image'&&side==='bottom'?{bottom:'auto',top:'calc(var(--placed-image-h) - 16px * var(--canvas-control-scale,1))'}:undefined} data-editor-only="true" aria-label={`Resize ${candidate.target.kind==='hero'?'hero':'page'} image height from ${side}`} title="Drag to resize image height · arrows adjust 1 mm · Shift adjusts 5 mm · Escape cancels" onPointerDown={event=>begin(event,candidate,side)} onClick={event=>event.stopPropagation()} onKeyDown={event=>{
    if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();
    const page=candidate.frame.closest<HTMLElement>('.page');if(!page)return;
    const scale=page.getBoundingClientRect().width/pageDimensions(doc.design).width,rect=candidate.frame.getBoundingClientRect();if(!(scale>0))return;
    const top=(rect.top-page.getBoundingClientRect().top)/scale,limit=page.offsetHeight/(96/25.4);
    save(candidate,resizedVerticalFrame(rect.height/scale,top,(event.key==='ArrowUp'?-1:1)*(event.shiftKey?5:1),side,limit,candidate.target.kind==='hero'?160:limit),side);
  }}><span/></button>,candidate.owner,`${index}-${side}`)))}</>;
}
