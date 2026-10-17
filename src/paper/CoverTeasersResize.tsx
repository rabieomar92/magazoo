import {useEffect,useRef,type PointerEvent} from 'react';
import {useDoc} from '../store/useDoc';
import {usePreviewReadOnly} from './PreviewReadOnly';
import {pageDimensions} from '../lib/pageFormat';
import type {Doc} from '../schema/document';
export function teaserHeight(value:number,max:number){return Math.round(Math.max(12,Math.min(max,value))*10)/10;}
/** Draft on the DOM; a completed gesture is one undo/save operation. */
export function CoverTeasersResize({doc}:{doc:Doc}){
  const readOnly=usePreviewReadOnly(),update=useDoc(s=>s.update);
  const drag=useRef<{id:number;y:number;start:number;scale:number;max:number;value:number;box:HTMLElement;source:Doc}|null>(null);
  const clear=()=>{const s=drag.current;if(s)s.box.style.removeProperty('--front-teasers-height');drag.current=null;};
  useEffect(()=>()=>clear(),[]);
  if(readOnly)return null;
  const save=(value:number)=>update(d=>{d.design.frontCover={...d.design.frontCover,teaserHeight:value};});
  const start=(e:PointerEvent<HTMLButtonElement>)=>{
    if(e.button!==0)return;
    const box=e.currentTarget.parentElement!,page=box.closest<HTMLElement>('.page');if(!page)return;
    const scale=page.getBoundingClientRect().width/pageDimensions(doc.design).width;if(!(scale>0))return;
    e.preventDefault();e.stopPropagation();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);
    const height=box.getBoundingClientRect().height/scale,max=Math.max(12,Math.min((box.getBoundingClientRect().bottom-page.getBoundingClientRect().top)/scale-doc.design.margin,pageDimensions(doc.design).height-2*doc.design.margin-12));
    drag.current={id:e.pointerId,y:e.clientY,start:height,scale,max,value:height,box,source:useDoc.getState().doc};
  };
  return <button type="button" className="cover-teasers-resize" data-editor-only="true" aria-label="Resize cover teasers height"
    title="Drag to resize teasers. Arrow keys: 1mm; Shift: 5mm. Escape cancels; double-click restores automatic height."
    onPointerDown={start} onPointerMove={e=>{const s=drag.current;if(!s||s.id!==e.pointerId)return;e.stopPropagation();s.value=teaserHeight(s.start+(s.y-e.clientY)/s.scale,s.max);s.box.style.setProperty('--front-teasers-height',`${s.value}mm`);}}
    onPointerUp={e=>{const s=drag.current;if(!s||s.id!==e.pointerId)return;e.stopPropagation();const value=s.value,changed=Math.abs(value-s.start)>.05,valid=s.source===useDoc.getState().doc;clear();e.currentTarget.releasePointerCapture?.(e.pointerId);if(changed&&valid)save(value);}}
    onPointerCancel={clear} onLostPointerCapture={clear} onClick={e=>{e.preventDefault();e.stopPropagation();}}
    onDoubleClick={e=>{e.stopPropagation();update(d=>{if(d.design.frontCover)delete d.design.frontCover.teaserHeight;});}}
    onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();clear();return;}if(!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const box=e.currentTarget.parentElement!,page=box.closest<HTMLElement>('.page');if(!page)return;const scale=page.getBoundingClientRect().width/pageDimensions(doc.design).width;if(!(scale>0))return;const max=Math.max(12,Math.min((box.getBoundingClientRect().bottom-page.getBoundingClientRect().top)/scale-doc.design.margin,pageDimensions(doc.design).height-2*doc.design.margin-12));save(teaserHeight(box.getBoundingClientRect().height/scale+(e.key==='ArrowUp'?1:-1)*(e.shiftKey?5:1),max));}}><span aria-hidden="true"/></button>;
}
