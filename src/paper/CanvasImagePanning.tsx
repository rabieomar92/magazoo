/** @jsxImportSource ../lib/mathJsx */
import {useEffect,useLayoutEffect,useRef,useState,type RefObject,type PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import type {Doc} from '../schema/document';
import {imagePan} from '../lib/imageFrame';
import {pageDimensions} from '../lib/pageFormat';
import {MAG2_STRIP} from '../lib/magSplit';
import {currentDocumentSession,useDoc} from '../store/useDoc';
import '../styles/canvas-image-pan.css';

type Target={kind:'hero'|'cover';id?:never}|{kind:'image';id:string};
type Candidate={image:HTMLImageElement;frame:HTMLElement;target:Target};
function canvasPanTarget(image:HTMLImageElement,doc:Doc):Target|null{
  const placed=image.closest<HTMLElement>('[data-image-id]')?.dataset.imageId;
  if(placed&&doc.images.some(item=>item.id===placed))return {kind:'image',id:placed};
  const editor=image.closest<HTMLElement>('[data-editor-target]')?.dataset.editorTarget;
  if(editor==='image-hero')return {kind:'hero'};
  if(editor==='image-cover'||image.matches('.mag-cover-photo,.front-cover-photo'))return doc.cover?{kind:'cover'}:doc.templateId==='magazine-3'?{kind:'hero'}:null;
  return null;
}
const frameOf=(doc:Doc,target:Target)=>target.kind==='image'?doc.images.find(item=>item.id===target.id)?.frame:doc[target.kind];

/** Photo pixels move inside their existing frame; the frame, caption and
 * contour stay still. A draft does not paginate/autosave until Apply. */
export function CanvasImagePanning({doc,root}:{doc:Doc;root:RefObject<HTMLDivElement|null>}){
  const[candidates,setCandidates]=useState<Candidate[]>([]),[active,setActive]=useState<Candidate|null>(null);
  const draft=useRef<{candidate:Candidate;style:string;freePan:string|null;panX:number;panY:number;session:number;doc:Doc}|null>(null);
  const drag=useRef<{id:number;x:number;y:number;width:number;height:number;zoom:number;left:number;top:number;panX:number;panY:number}|null>(null);
  const applyRef=useRef<HTMLButtonElement>(null);
  const restore=(current:NonNullable<typeof draft.current>)=>{current.candidate.image.style.cssText=current.style;if(current.freePan===null)current.candidate.image.removeAttribute('data-image-free-pan');else current.candidate.image.setAttribute('data-image-free-pan',current.freePan);delete current.candidate.frame.dataset.dragging;};
  const cancel=()=>{const current=draft.current;if(current)restore(current);draft.current=null;drag.current=null;setActive(null);};
  useLayoutEffect(()=>{
    const host=root.current;if(!host)return;
    const collect=()=>{
      const next=[...host.querySelectorAll<HTMLImageElement>('.page img.framed-image,.page img.spread-photo-image')].flatMap(image=>{const target=canvasPanTarget(image,doc),frame=image.parentElement;return target&&frame&&!image.closest('[data-editor-only]')?[{image,frame,target}]:[];});
      setCandidates(previous=>previous.length===next.length&&previous.every((item,index)=>item.image===next[index].image&&JSON.stringify(item.target)===JSON.stringify(next[index].target))?previous:next);
    };
    collect();const observer=new MutationObserver(collect);observer.observe(host,{subtree:true,childList:true});return()=>observer.disconnect();
  },[doc,root]);
  useEffect(()=>{cancel();return()=>{const current=draft.current;if(current)restore(current);draft.current=null;drag.current=null;};},[doc]); // Any external edit/load invalidates the local draft.
  useEffect(()=>{if(!active)return;applyRef.current?.focus({preventScroll:true});const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();cancel();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[active]);
  const open=(candidate:Candidate)=>{
    if(candidate.image.closest('[data-outline-editing="true"]'))return;
    cancel();const frame=frameOf(doc,candidate.target);
    draft.current={candidate,style:candidate.image.style.cssText,freePan:candidate.image.getAttribute('data-image-free-pan'),panX:frame?.panX??0,panY:frame?.panY??0,session:currentDocumentSession(),doc};
    candidate.image.dataset.imageFreePan='true';
    candidate.frame.dataset.dragging='true';setActive(candidate);
  };
  const down=(event:PointerEvent<HTMLDivElement>)=>{
    const current=draft.current;if(!current||event.button!==0)return;
    const bounds=event.currentTarget.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
    event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture?.(event.pointerId);
    const image=current.candidate.image,css=getComputedStyle(image),frameCss=getComputedStyle(current.candidate.frame);
    const page=pageDimensions(doc.design),spread=image.classList.contains('spread-photo-image');
    const regionWidth=spread?(doc.templateId==='magazine-2'?page.width+MAG2_STRIP:page.width*2)*96/25.4:parseFloat(frameCss.width);
    const regionHeight=spread?page.height*96/25.4:parseFloat(frameCss.height);
    const zoom=bounds.width/parseFloat(frameCss.width);
    drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,width:regionWidth*zoom,height:regionHeight*zoom,zoom,left:parseFloat(css.left)||0,top:parseFloat(css.top)||0,panX:current.panX,panY:current.panY};
  };
  const move=(event:PointerEvent<HTMLDivElement>)=>{
    const state=drag.current,current=draft.current;if(!state||!current||state.id!==event.pointerId)return;
    event.preventDefault();event.stopPropagation();const dx=(event.clientX-state.x)/state.width,dy=(event.clientY-state.y)/state.height;
    current.panX=imagePan(state.panX+dx*100);current.panY=imagePan(state.panY+dy*100);
    current.candidate.image.style.left=`${state.left+(current.panX-state.panX)/100*state.width/state.zoom}px`;
    current.candidate.image.style.top=`${state.top+(current.panY-state.panY)/100*state.height/state.zoom}px`;
  };
  const apply=()=>{
    const state=draft.current;if(!state)return;
    const valid=state.session===currentDocumentSession()&&state.doc===doc;
    const {panX,panY,candidate}=state;const before=frameOf(doc,candidate.target);cancel();
    if(valid&&(panX!==(before?.panX??0)||panY!==(before?.panY??0)))useDoc.getState().update(current=>{
      const pan={panX,panY};if(candidate.target.kind==='image'){const image=current.images.find(item=>item.id===candidate.target.id);if(image)image.frame={scale:1,offsetX:0,offsetY:0,...image.frame,...pan};}
      else{const frame=current[candidate.target.kind];if(frame)Object.assign(frame,pan);}
    });
  };
  return <>{candidates.map((candidate,index)=>createPortal(<button type="button" className="canvas-pan-trigger" data-editor-only="true" aria-label={candidate.target.kind==='image'?'Pan page image on canvas':'Pan hero image on canvas'} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();open(candidate);}}>Pan photo</button>,candidate.target.kind==='image'?candidate.frame.parentElement?.querySelector('.placed-image-tools')??candidate.frame:candidate.frame,String(index)))}
    {active&&createPortal(<div className="canvas-pan-surface" data-editor-only="true" role="group" aria-label="Drag photograph inside its frame" onPointerDown={down} onPointerMove={move} onPointerUp={event=>{move(event);drag.current=null;}} onPointerCancel={cancel} onLostPointerCapture={()=>{drag.current=null;}}/>,active.frame)}
    {active&&createPortal(<section className="canvas-pan-toolbar" role="dialog" aria-label="Pan photograph" data-editor-only="true"><div><strong>Reposition photograph</strong><span>Drag the photo on the page. Its frame and text boundary stay fixed.</span></div><button type="button" onClick={cancel}>Cancel</button><button ref={applyRef} type="button" onClick={apply}>Apply position</button></section>,document.body)}</>;
}
