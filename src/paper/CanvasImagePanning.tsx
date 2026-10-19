/** @jsxImportSource ../lib/mathJsx */
import {useEffect,useLayoutEffect,useRef,useState,type RefObject,type PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import type {Doc} from '../schema/document';
import {imagePan} from '../lib/imageFrame';
import {pageDimensions} from '../lib/pageFormat';
import {MAG2_STRIP,spreadWindows} from '../lib/magSplit';
import {documentBleed} from '../lib/documentBleed';
import {currentDocumentSession,useDoc} from '../store/useDoc';
import '../styles/canvas-image-pan.css';
import {CanvasPhotoCrop} from './CanvasPhotoCrop';
import {cropClip} from '../lib/imageCrop';

type Target={kind:'hero'|'cover';id?:never}|{kind:'image'|'gallery';id:string};
type Candidate={image:HTMLImageElement;frame:HTMLElement;target:Target;tools:Element};
type Mirror={image:HTMLImageElement;style:string;freePan:string|null;left:number;top:number};
function canvasPanTarget(image:HTMLImageElement,doc:Doc):Target|null{
  const placed=image.closest<HTMLElement>('[data-image-id]')?.dataset.imageId;
  if(placed&&doc.images.some(item=>item.id===placed))return {kind:'image',id:placed};
  const editor=image.closest<HTMLElement>('[data-editor-target]')?.dataset.editorTarget;
  if(editor?.startsWith('gallery-image-')){const id=editor.slice('gallery-image-'.length);if(doc.blocks?.some(b=>b.type==='figure'&&b.id===id))return {kind:'gallery',id};}
  if(editor==='image-hero')return {kind:'hero'};
  if(editor==='image-cover'||image.matches('.mag-cover-photo,.front-cover-photo'))return doc.cover?{kind:'cover'}:doc.templateId==='magazine-3'?{kind:'hero'}:null;
  return null;
}
const frameOf=(doc:Doc,target:Target)=>{
  if(target.kind==='image')return doc.images.find(item=>item.id===target.id)?.frame;
  if(target.kind==='gallery'){const block=doc.blocks.find(item=>item.id===target.id);return block?.type==='figure'?block.frame:undefined;}
  return doc[target.kind];
};

/** Photo pixels move inside their existing frame; the frame, caption and
 * contour stay still. A draft does not paginate/autosave until Apply. */
export function CanvasImagePanning({doc,root}:{doc:Doc;root:RefObject<HTMLDivElement|null>}){
  const[candidates,setCandidates]=useState<Candidate[]>([]),[active,setActive]=useState<Candidate|null>(null);
  const[cropping,setCropping]=useState<Candidate|null>(null);
  useEffect(()=>setCropping(null),[doc]);
  const draft=useRef<{candidate:Candidate;mirrors:Mirror[];panX:number;panY:number;session:number;doc:Doc}|null>(null);
  const drag=useRef<{id:number;x:number;y:number;width:number;height:number;zoom:number;left:number;top:number;panX:number;panY:number}|null>(null);
  const applyRef=useRef<HTMLButtonElement>(null);
  const restore=(current:NonNullable<typeof draft.current>)=>{for(const m of current.mirrors){m.image.style.cssText=m.style;if(m.freePan===null)m.image.removeAttribute('data-image-free-pan');else m.image.setAttribute('data-image-free-pan',m.freePan);}delete current.candidate.frame.dataset.dragging;};
  const cancel=()=>{const current=draft.current;if(current)restore(current);draft.current=null;drag.current=null;setActive(null);};
  useLayoutEffect(()=>{
    const host=root.current;if(!host)return;
    const collect=()=>{
      const next=[...host.querySelectorAll<HTMLImageElement>('.page img.framed-image,.page img.spread-photo-image')].flatMap(image=>{const target=canvasPanTarget(image,doc),frame=image.parentElement;return target&&frame&&!image.closest('[data-editor-only]')?[{image,frame,target,tools:target.kind==='image'?frame.parentElement?.querySelector('.placed-image-tools')??frame:frame}]:[];});
      setCandidates(previous=>previous.length===next.length&&previous.every((item,index)=>item.image===next[index].image&&item.tools===next[index].tools&&JSON.stringify(item.target)===JSON.stringify(next[index].target))?previous:next);
    };
    collect();const observer=new MutationObserver(collect);observer.observe(host,{subtree:true,childList:true});return()=>observer.disconnect();
  },[doc,root]);
  useEffect(()=>{cancel();return()=>{const current=draft.current;if(current)restore(current);draft.current=null;drag.current=null;};},[doc]); // Any external edit/load invalidates the local draft.
  useEffect(()=>{if(!active)return;applyRef.current?.focus({preventScroll:true});const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();cancel();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[active]);
  const open=(candidate:Candidate)=>{
    if(candidate.image.closest('[data-outline-editing="true"]'))return;
    cancel();const frame=frameOf(doc,candidate.target);
    const link=candidate.target.kind==='image'?doc.images.find(i=>i.id===candidate.target.id)?.spreadLink:undefined;
    const related=candidates.filter(c=>c.target.kind===candidate.target.kind&&(c.target.id===candidate.target.id||!!link&&c.target.kind==='image'&&doc.images.find(i=>i.id===c.target.id)?.spreadLink===link));
    const mirrors=related.map(({image})=>({image,style:image.style.cssText,freePan:image.getAttribute('data-image-free-pan'),left:0,top:0}));
    draft.current={candidate,mirrors,panX:frame?.panX??0,panY:frame?.panY??0,session:currentDocumentSession(),doc};
    mirrors.forEach(m=>m.image.dataset.imageFreePan='true');
    candidate.frame.dataset.dragging='true';setActive(candidate);
  };
  const down=(event:PointerEvent<HTMLDivElement>)=>{
    const current=draft.current;if(!current||event.button!==0)return;
    const bounds=event.currentTarget.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
    event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture?.(event.pointerId);
    const image=current.candidate.image,css=getComputedStyle(image),frameCss=getComputedStyle(current.candidate.frame);
    const page=pageDimensions(doc.design),spread=image.classList.contains('spread-photo-image');
    const bleed=doc.design.bleedCanvas?documentBleed(doc.design.bleedMm):0;
    const regionWidth=Number(image.dataset.spreadRegionWidth)||(spread?(doc.templateId==='magazine-2'?page.width+MAG2_STRIP-2*bleed:spreadWindows(page.width,bleed).width)*96/25.4:parseFloat(frameCss.width));
    const regionHeight=Number(image.dataset.spreadRegionHeight)||(spread?page.height*96/25.4:parseFloat(frameCss.height));
    const zoom=bounds.width/parseFloat(frameCss.width);
    for(const m of current.mirrors){const css=getComputedStyle(m.image);m.left=parseFloat(css.left)||0;m.top=parseFloat(css.top)||0;}
    drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,width:regionWidth*zoom,height:regionHeight*zoom,zoom,left:parseFloat(css.left)||0,top:parseFloat(css.top)||0,panX:current.panX,panY:current.panY};
  };
  const move=(event:PointerEvent<HTMLDivElement>)=>{
    const state=drag.current,current=draft.current;if(!state||!current||state.id!==event.pointerId)return;
    event.preventDefault();event.stopPropagation();const dx=(event.clientX-state.x)/state.width,dy=(event.clientY-state.y)/state.height;
    current.panX=imagePan(state.panX+dx*100);current.panY=imagePan(state.panY+dy*100);
    const crop=frameOf(doc,current.candidate.target)?.crop;
    for(const m of current.mirrors){
      const left=m.left+(current.panX-state.panX)/100*state.width/state.zoom,top=m.top+(current.panY-state.panY)/100*state.height/state.zoom;
      m.image.style.left=`${left}px`;m.image.style.top=`${top}px`;
      if(crop)m.image.style.clipPath=cropClip(crop,state.width/state.zoom,state.height/state.zoom,left+(Number(m.image.dataset.spreadWindowOffset)||0),top);
    }
  };
  const apply=()=>{
    const state=draft.current;if(!state)return;
    const valid=state.session===currentDocumentSession()&&state.doc===doc;
    const {panX,panY,candidate}=state;const before=frameOf(doc,candidate.target);cancel();
    if(valid&&(panX!==(before?.panX??0)||panY!==(before?.panY??0)))useDoc.getState().update(current=>{
      const pan={panX,panY};if(candidate.target.kind==='image'){const image=current.images.find(item=>item.id===candidate.target.id);if(image)image.frame={scale:1,offsetX:0,offsetY:0,...image.frame,...pan};}
      else if(candidate.target.kind==='gallery'){const block=current.blocks.find(b=>b.type==='figure'&&b.id===candidate.target.id);if(block?.type==='figure')block.frame={scale:1,offsetX:0,offsetY:0,...block.frame,...pan};}
      else{const frame=current[candidate.target.kind];if(frame)Object.assign(frame,pan);}
    });
  };
  return <>{candidates.map((candidate,index)=>createPortal(<button type="button" className="canvas-pan-trigger" data-editor-only="true" aria-label={candidate.target.kind==='image'?'Pan page image on canvas':'Pan hero image on canvas'} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();open(candidate);}}>Pan photo</button>,candidate.tools,String(index)))}
    {candidates.filter(c=>c.image.classList.contains('framed-image')).map((candidate,index)=>createPortal(<button type="button" className="canvas-pan-trigger canvas-crop-trigger" data-editor-only="true" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();cancel();setCropping(candidate);}}>Crop photo</button>,candidate.tools,`crop-${index}`))}
    {cropping&&<CanvasPhotoCrop image={cropping.image} frame={frameOf(doc,cropping.target)} onCancel={()=>setCropping(null)} onApply={frame=>{const target=cropping.target;setCropping(null);useDoc.getState().update(current=>{if(target.kind==='image'){const item=current.images.find(i=>i.id===target.id);if(item)item.frame=frame;}else if(target.kind==='gallery'){const block=current.blocks.find(b=>b.type==='figure'&&b.id===target.id);if(block?.type==='figure')block.frame=frame;}else Object.assign(current[target.kind]!,frame);});}}/>}
    {active&&createPortal(<div className="canvas-pan-surface" data-editor-only="true" role="group" aria-label="Drag photograph inside its frame" onPointerDown={down} onPointerMove={move} onPointerUp={event=>{move(event);drag.current=null;}} onPointerCancel={cancel} onLostPointerCapture={()=>{drag.current=null;}}/>,active.frame)}
    {active&&createPortal(<section className="canvas-pan-toolbar" role="dialog" aria-label="Pan photograph" data-editor-only="true"><div><strong>Reposition photograph</strong><span>Drag the photo on the page. Its frame and text boundary stay fixed.</span></div><button type="button" onClick={cancel}>Cancel</button><button ref={applyRef} type="button" onClick={apply}>Apply position</button></section>,document.body)}</>;
}
