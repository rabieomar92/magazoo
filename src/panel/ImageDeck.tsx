import {Children,isValidElement,useEffect,useRef,useState,type ReactNode} from 'react';
import {editorTargetId,FOCUS_EDITOR_TARGET_EVENT,type EditorTargetDetail} from '../lib/editorNavigation';
export const REVEAL_IMAGE_CONTROL='magazoo:reveal-image-control';

/** Show one image's controls without discarding its field drafts or typography.
 * Selecting an object on the canvas opens the matching image automatically. */
export function ImageDeck({label,names,children}:{label:string;names:string[];children:ReactNode}){
  const items=Children.toArray(children),[selected,setSelected]=useState(0),host=useRef<HTMLDivElement>(null),previous=useRef(names.length);
  const active=Math.max(0,Math.min(selected,items.length-1));
  useEffect(()=>{if(names.length>previous.current)setSelected(names.length-1);previous.current=names.length;},[names.length]);
  useEffect(()=>{const reveal=(event:Event)=>{const target=(event as CustomEvent<EditorTargetDetail>).detail?.target;if(!target)return;
    const element=document.getElementById(editorTargetId(target));if(!element)return;
    const index=[...host.current?.querySelectorAll<HTMLElement>(':scope > .image-deck-item')??[]].findIndex(item=>item.contains(element));if(index>=0)setSelected(index);
  };window.addEventListener(FOCUS_EDITOR_TARGET_EVENT,reveal);window.addEventListener(REVEAL_IMAGE_CONTROL,reveal);return()=>{window.removeEventListener(FOCUS_EDITOR_TARGET_EVENT,reveal);window.removeEventListener(REVEAL_IMAGE_CONTROL,reveal);};},[]);
  return <div className="image-deck">
    {items.length>1&&<div className="image-deck-navigation"><label>{label}<select value={active} onChange={event=>setSelected(Number(event.target.value))} aria-label={`Choose ${label.toLowerCase()}`}>{names.map((name,index)=><option value={index} key={index}>{name}</option>)}</select></label>
      <div className="image-deck-step"><button type="button" aria-label={`Previous ${label.toLowerCase()}`} disabled={active===0} onClick={()=>setSelected(active-1)}>‹</button><span>{active+1} / {items.length}</span><button type="button" aria-label={`Next ${label.toLowerCase()}`} disabled={active===items.length-1} onClick={()=>setSelected(active+1)}>›</button></div></div>}
    <div ref={host}>{items.map((item,index)=><div className="image-deck-item" key={isValidElement(item)?item.key??index:index} hidden={index!==active}>{item}</div>)}</div>
  </div>;
}
