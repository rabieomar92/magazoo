import {useEffect,useRef,type ReactNode} from 'react';
import type {Block} from '../schema/document';
import {currentDocumentSession,useDoc} from '../store/useDoc';
import {usePreviewReadOnly} from './PreviewReadOnly';

/** Resize copy, not the photo. Insets are saved in mm and copied unchanged to print. */
export function GalleryCaptionBox({block,children}:{block:Extract<Block,{type:'figure'}>;children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null),readOnly=usePreviewReadOnly(),update=useDoc(s=>s.update);
 const left=Math.max(0,block.captionInsetLeftMm??0),right=Math.max(0,block.captionInsetRightMm??0);
 const gesture=useRef<{pointer:number;x:number;scale:number;width:number;side:'left'|'right';left:number;right:number;next:number;moved:boolean;session:number;doc:ReturnType<typeof useDoc.getState>['doc']}|null>(null);
 const paint=(l:number,r:number)=>{if(ref.current){ref.current.style.marginLeft=`${l}mm`;ref.current.style.width=`calc(100% - ${l+r}mm)`;}};
 const save=(side:'left'|'right',value:number)=>update(doc=>{const b=doc.blocks.find(b=>b.id===block.id);if(b?.type==='figure')b[side==='left'?'captionInsetLeftMm':'captionInsetRightMm']=Math.round(value*100)/100;});
 useEffect(()=>{const move=(e:PointerEvent)=>{const g=gesture.current;if(!g||e.pointerId!==g.pointer)return;const dx=(e.clientX-g.x)/g.scale;if(Math.abs(dx)<.2&&!g.moved)return;e.preventDefault();e.stopPropagation();g.moved=true;g.next=Math.max(0,Math.min(g.width-5-(g.side==='left'?g.right:g.left),(g.side==='left'?g.left:g.right)+dx*(g.side==='left'?1:-1)));paint(g.side==='left'?g.next:g.left,g.side==='right'?g.next:g.right);};
 const finish=(e:PointerEvent)=>{const g=gesture.current;if(!g||e.pointerId!==g.pointer)return;gesture.current=null;if(e.type==='pointerup'&&g.moved&&!readOnly&&g.session===currentDocumentSession()&&g.doc===useDoc.getState().doc)save(g.side,g.next);else paint(left,right);};
 window.addEventListener('pointermove',move,{capture:true,passive:false});window.addEventListener('pointerup',finish,true);window.addEventListener('pointercancel',finish,true);return()=>{window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',finish,true);window.removeEventListener('pointercancel',finish,true);};
 },[block.id,left,right,readOnly]);
 return <div ref={ref} className="g-caption-box" style={{marginLeft:`${left}mm`,width:`calc(100% - ${left+right}mm)`}}>{children}{!readOnly&&(['left','right'] as const).map(side=><button key={side} type="button" className={`gallery-caption-resize gallery-caption-resize--${side}`} data-editor-only="true" aria-label={`Resize gallery caption from ${side}`} title="Drag to resize caption width · arrows adjust 1 mm · Shift adjusts 5 mm"
 onPointerDown={e=>{if(e.button!==0)return;const parent=ref.current?.parentElement;if(!parent||!parent.offsetWidth)return;e.preventDefault();e.stopPropagation();e.currentTarget.focus({preventScroll:true});const r=parent.getBoundingClientRect();gesture.current={pointer:e.pointerId,x:e.clientX,scale:r.width/(parent.offsetWidth/(96/25.4)),width:parent.offsetWidth/(96/25.4),side,left,right,next:side==='left'?left:right,moved:false,session:currentDocumentSession(),doc:useDoc.getState().doc};}}
 onKeyDown={e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();const width=(ref.current?.parentElement?.offsetWidth??0)/(96/25.4);if(width<5)return;const delta=(e.key==='ArrowRight'?1:-1)*(e.shiftKey?5:1)*(side==='left'?1:-1);save(side,Math.max(0,Math.min(width-5-(side==='left'?right:left),(side==='left'?left:right)+delta)));}}/> )}</div>;
}
