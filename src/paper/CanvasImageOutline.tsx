import {useEffect,useState,useRef} from 'react';
import {CanvasPhotoPanel} from './CanvasPhotoPanel';
import type {Asset,PlacedImage} from '../schema/document';
import {placedImageControlPoints,placedImageWrapGap} from '../lib/placedImage';
import {isCanvasOutlineValid} from '../lib/imageCanvas';
import {PolygonPoints} from './PolygonPoints';
import {cropPreset,type CropShape} from '../lib/imageCrop';
import '../styles/image-canvas.css';
interface Props {image:PlacedImage;asset:Asset;onApply:(points:{x:number;y:number}[],smoothing:number,gap:number)=>void;onCancel:()=>void}
export function CanvasImageOutline({image,onApply,onCancel}:Props){
 const [points,setPoints]=useState(()=>placedImageControlPoints(image));
 const [gap,setGap]=useState(placedImageWrapGap(image));
 const outline=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onCancel();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onCancel]);
 return <><div ref={outline} className="canvas-outline" data-editor-only="true" onPointerDown={e=>e.stopPropagation()}><PolygonPoints points={points} onChange={setPoints}/></div>
 <CanvasPhotoPanel anchorRef={outline} className="canvas-outline-tools" label="Edit text wrap boundary">
 <strong>Text wrap boundary</strong><span>Drag points. Click an edge to add a point; double-click a point or press Delete to remove it. The photo stays visible.</span>
 <span className="canvas-point-count" role="status">{points.length} / 128 points{points.length>=128?' · Remove a point before adding another.':''}</span>
 <div className="canvas-outline-settings"><label>Shape <select aria-label="Wrap shape" onChange={e=>setPoints(cropPreset(e.target.value as CropShape))} defaultValue="polygon">{['polygon','rectangle','ellipse','diamond','triangle'].map(s=><option key={s}>{s}</option>)}</select></label><label>Text gap <input aria-label="Outline text gap" type="number" min="0" max="12" step=".1" value={gap} onChange={e=>setGap(Math.max(0,Math.min(12,Number(e.target.value))))}/> mm</label></div>
 <div className="canvas-outline-buttons"><button onClick={onCancel}>Cancel</button><button className="canvas-outline-apply" disabled={!isCanvasOutlineValid(points)} onClick={()=>onApply(points,0,gap)}>Apply boundary</button></div>
 </CanvasPhotoPanel></>;
}
