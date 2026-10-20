import {useLayoutEffect,useRef,useState,type ReactNode,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {photoPanelPosition} from '../lib/photoPanelPosition';
import {PhotoToolIcon} from '../components/PhotoToolIcon';
/** A movable inspector that first docks outside the photograph, not on its handles. */
export function CanvasPhotoPanel({anchor,anchorRef,label,className,children}:{anchor?:HTMLElement;anchorRef?:RefObject<HTMLElement|null>;label:string;className:string;children:ReactNode}){
 const ref=useRef<HTMLElement|null>(null),manual=useRef(false),drag=useRef<{id:number;x:number;y:number;left:number;top:number}|null>(null);
 const [position,setPosition]=useState({left:12,top:12});
 useLayoutEffect(()=>{
  const panel=ref.current;if(!panel)return;
  const measure=()=>{const r=panel.getBoundingClientRect(),target=anchor??anchorRef?.current;const next=manual.current?{left:Math.max(12,Math.min(r.left,innerWidth-r.width-12)),top:Math.max(12,Math.min(r.top,innerHeight-r.height-12))}:photoPanelPosition(target?.getBoundingClientRect()??null,r.width,r.height,innerWidth,innerHeight);setPosition(old=>old.left===next.left&&old.top===next.top?old:next);};
  measure();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);observer?.observe(panel);window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);return()=>{observer?.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
 },[anchor,anchorRef]);
 return createPortal(<section ref={ref} className={`${className} canvas-photo-panel`} role="dialog" aria-label={label} data-editor-only="true" style={{...position,bottom:'auto',transform:'none'}}>
  <button className="canvas-photo-panel-grip" type="button" aria-label="Move photo tools" title="Drag or use arrow keys to move tools out of the way" onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();manual.current=true;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,...position};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;const r=ref.current!.getBoundingClientRect();setPosition({left:Math.max(8,Math.min(innerWidth-r.width-8,d.left+e.clientX-d.x)),top:Math.max(8,Math.min(innerHeight-r.height-8,d.top+e.clientY-d.y))});}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();manual.current=true;const r=ref.current!.getBoundingClientRect(),step=e.shiftKey?20:5;setPosition(p=>({left:Math.max(8,Math.min(innerWidth-r.width-8,p.left+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0))),top:Math.max(8,Math.min(innerHeight-r.height-8,p.top+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)))}));}}><PhotoToolIcon name="move"/></button>
  {children}
 </section>,document.body);
}
