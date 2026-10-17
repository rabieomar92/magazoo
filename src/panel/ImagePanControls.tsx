import {useRef,useState,type CSSProperties,type PointerEvent,type ReactNode} from 'react';
import {imagePan,normalizeImageFrame,type ImageFrame} from '../lib/imageFrame';
import {currentDocumentSession} from '../store/useDoc';
import {LabeledNumber} from './Field';

type Pan=Pick<ImageFrame,'panX'|'panY'>;
interface Props {frame?:Partial<ImageFrame>;onChange:(pan:Pan)=>void;disabled?:boolean}
const panOf=(frame?:Partial<ImageFrame>)=>({panX:imagePan(frame?.panX),panY:imagePan(frame?.panY)});

/** Preview-only draft: dragging never repaginates or autosaves on every move.
 * One pointer release is one undoable document change; Escape/cancel discards. */
export function ImagePanPreview({frame,onChange,disabled=false,children,label='Image crop preview',aspectRatio=1.5,background='#fff',className=''}:Props&{
  children:(frame:ImageFrame)=>ReactNode;label?:string;aspectRatio?:number;background?:string;className?:string;
}){
  const [draft,setDraft]=useState<Pan|null>(null);
  const drag=useRef<{pointer:number;x:number;y:number;width:number;height:number;pan:Pan;key:string;session:unknown}|null>(null);
  const resolved=normalizeImageFrame(frame),key=JSON.stringify(resolved);
  const shown=draft&&drag.current?.key===key?{...resolved,...draft}:resolved;
  const ratio=Number.isFinite(aspectRatio)&&aspectRatio>0?aspectRatio:1.5;
  const position=(event:PointerEvent<HTMLDivElement>)=>{
    const start=drag.current!;
    return {panX:imagePan(Math.round(((start.pan.panX??0)+(event.clientX-start.x)*100/start.width)*100)/100),
      panY:imagePan(Math.round(((start.pan.panY??0)+(event.clientY-start.y)*100/start.height)*100)/100)};
  };
  const cancel=()=>{drag.current=null;setDraft(null);};
  return <div className={`image-pan-preview ${className}`} role="group" tabIndex={disabled?-1:0} aria-disabled={disabled||undefined} aria-label={label}
    aria-roledescription="image panning control" title="Drag to pan · arrows move 1% · Shift moves 10% · Escape cancels"
    style={{aspectRatio:ratio,width:`min(100%, ${180*ratio}px)`,background} as CSSProperties}
    data-panning={draft?'true':undefined}
    onPointerDown={event=>{
      if(disabled||event.button!==0||drag.current)return;
      const rect=event.currentTarget.getBoundingClientRect();if(!rect.width||!rect.height)return;
      event.preventDefault();event.stopPropagation();event.currentTarget.focus();
      drag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,width:rect.width,height:rect.height,pan:panOf(frame),key,session:currentDocumentSession()};
      event.currentTarget.setPointerCapture?.(event.pointerId);setDraft(panOf(frame));
    }}
    onPointerMove={event=>{if(drag.current?.pointer===event.pointerId)setDraft(position(event));}}
    onPointerUp={event=>{
      const start=drag.current;if(!start||start.pointer!==event.pointerId)return;
      const next=position(event),valid=!disabled&&start.key===key&&start.session===currentDocumentSession();
      cancel();if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
      if(valid&&(next.panX!==start.pan.panX||next.panY!==start.pan.panY))onChange(next);
    }} onPointerCancel={cancel} onLostPointerCapture={cancel} onBlur={cancel}
    onKeyDown={event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel();return;}
      if(disabled||drag.current||event.ctrlKey||event.metaKey||event.altKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();const pan=panOf(frame),step=event.shiftKey?10:1;
      onChange(event.key==='Home'?{panX:0,panY:0}:{panX:imagePan(pan.panX+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0)),
        panY:imagePan(pan.panY+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0))});
    }}>
    {children(shown)}<span className="image-pan-preview-hint" aria-hidden="true">Drag to pan</span>
  </div>;
}

export function ImagePanControls({frame,onChange,disabled=false}:Props){
  const pan=panOf(frame);
  return <fieldset className="image-pan-controls" disabled={disabled} aria-label="Image panning">
    <div className="image-pan-coordinates">
      <LabeledNumber label="Pan horizontally" unit="%" min={-1000} max={1000} step={1} value={pan.panX} onChange={panX=>onChange({...pan,panX})}/>
      <LabeledNumber label="Pan vertically" unit="%" min={-1000} max={1000} step={1} value={pan.panY} onChange={panY=>onChange({...pan,panY})}/>
    </div>
    <p className="hint">Drag the crop preview, or enter a pan amount. Empty areas reveal the page background. The canvas updates when you release the preview.</p>
    <button type="button" className="add-btn" disabled={!pan.panX&&!pan.panY} onClick={()=>onChange({panX:0,panY:0})}>Reset panning</button>
  </fieldset>;
}
