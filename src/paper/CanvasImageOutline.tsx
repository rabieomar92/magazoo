/** @jsxImportSource ../lib/mathJsx */
import {memo,useEffect,useRef,useState,type PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import type {Asset,PlacedImage} from '../schema/document';
import {placedImageControlPoints,placedImagePolygon,placedImageWrapGap} from '../lib/placedImage';
import {isCanvasOutlineValid} from '../lib/imageCanvas';
import {FramedImage} from '../components/FramedImage';
import '../styles/image-canvas.css';

type Point={x:number;y:number};
const Photo=memo(FramedImage);
interface Props {image:PlacedImage;asset:Asset;onApply:(points:Point[],smoothing:number,gap:number)=>void;onCancel:()=>void}

/** The image itself is the drawing surface. A local draft keeps the document,
 * pagination, autosave and undo history untouched until Apply is chosen. */
export function CanvasImageOutline({image,asset,onApply,onCancel}:Props) {
  const [points,setPoints]=useState<Point[]>(()=>placedImageControlPoints(image));
  const [history,setHistory]=useState<Point[][]>([]);
  const [smoothing,setSmoothing]=useState(image.wrapSmoothing??.25);
  const [gap,setGap]=useState(placedImageWrapGap(image));
  const [drawing,setDrawing]=useState(false);
  const stroke=useRef<{pointer:number;before:Point[];points:Point[];width:number;height:number}|null>(null);
  const applyButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onCancel();}};
    window.addEventListener('keydown',key);applyButton.current?.focus({preventScroll:true});
    return ()=>window.removeEventListener('keydown',key);
  },[onCancel]);
  const point=(event:PointerEvent<SVGSVGElement>)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    const bounded=(v:number)=>Math.round(Math.max(0,Math.min(100,v))*100)/100;
    return {x:bounded((event.clientX-rect.left)/(rect.width||1)*100),y:bounded((event.clientY-rect.top)/(rect.height||1)*100)};
  };
  const down=(event:PointerEvent<SVGSVGElement>)=>{
    if(event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    const box=event.currentTarget.getBoundingClientRect(),first=point(event);
    stroke.current={pointer:event.pointerId,before:points,points:[first],width:box.width,height:box.height};
    setDrawing(true);setPoints([first]);event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const move=(event:PointerEvent<SVGSVGElement>)=>{
    const current=stroke.current;if(!current||current.pointer!==event.pointerId)return;
    event.preventDefault();event.stopPropagation();const next=point(event),last=current.points.at(-1)!;
    if(Math.hypot((next.x-last.x)*current.width/100,(next.y-last.y)*current.height/100)<2)return;
    if(current.points.length<4096)current.points.push(next);
    setPoints([...current.points]);
  };
  const finish=(event:PointerEvent<SVGSVGElement>,cancel=false)=>{
    const current=stroke.current;if(!current||current.pointer!==event.pointerId)return;
    event.stopPropagation();stroke.current=null;setDrawing(false);
    if(cancel)setPoints(current.before);
    else setHistory(old=>[...old.slice(-9),current.before]);
    if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const valid=isCanvasOutlineValid(points);
  const preview=valid?placedImagePolygon({...image,wrapPolygon:points,wrapSmoothing:smoothing}):points;
  return <>
    <div className="canvas-outline" data-editor-only="true" onPointerDown={event=>event.stopPropagation()}>
      <Photo asset={asset} frame={image.frame}/>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Draw image border on canvas"
        onPointerDown={down} onPointerMove={move} onPointerUp={event=>finish(event)}
        onPointerCancel={event=>finish(event,true)} onLostPointerCapture={event=>finish(event,true)}>
        {valid?<polygon points={preview.map(p=>`${p.x},${p.y}`).join(' ')} fillRule="evenodd"/>:<polyline points={preview.map(p=>`${p.x},${p.y}`).join(' ')}/>}
      </svg>
    </div>
    {createPortal(<section className="canvas-outline-tools" role="dialog" aria-label="Draw image border" data-editor-only="true"
      onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()}>
      <div className="canvas-outline-instructions"><strong>Draw around the subject</strong><span role="status">{drawing?'Keep drawing. Release to close the border.':valid?'Draw a new border to replace this one. Apply when ready.':'Drag around the subject to make a closed border.'}</span></div>
      <div className="canvas-outline-settings">
        <label>Smoothness <input aria-label="Outline smoothness" type="range" min="0" max="100" step="5" value={Math.round(smoothing*100)} onChange={e=>setSmoothing(Number(e.target.value)/100)}/></label>
        <label>Text gap <input aria-label="Outline text gap" type="number" min="0" max="12" step=".1" value={gap} onChange={e=>setGap(Math.max(0,Math.min(12,Number(e.target.value))))}/> mm</label>
      </div>
      <div className="canvas-outline-buttons">
        <button type="button" disabled={!history.length||drawing} onClick={()=>{setPoints(history.at(-1)!);setHistory(old=>old.slice(0,-1));}}>Undo stroke</button>
        <button type="button" onClick={()=>{setHistory(old=>[...old.slice(-9),points]);setPoints([{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}]);setSmoothing(0);}}>Rectangle</button>
        <button type="button" onClick={onCancel}>Cancel</button>
        <button ref={applyButton} type="button" className="canvas-outline-apply" disabled={!valid||drawing} onClick={()=>onApply(placedImageControlPoints({...image,wrapPolygon:points}),smoothing,gap)}>Apply border</button>
      </div>
    </section>,document.body)}
  </>;
}
