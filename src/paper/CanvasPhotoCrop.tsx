import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import {cropClip,cropPoints,cropPreset,type CropShape} from '../lib/imageCrop';
import {framedImageGeometry,normalizeImageFrame,type ImageFrame} from '../lib/imageFrame';
import {isCanvasOutlineValid} from '../lib/imageCanvas';
import {PolygonPoints} from './PolygonPoints';
import '../styles/image-canvas.css';
import {currentDocumentSession} from '../store/useDoc';
/** Reversible preview on the actual photo; only Apply changes the document. */
export function CanvasPhotoCrop({image,frame,onApply,onCancel}:{image:HTMLImageElement;frame?:ImageFrame;onApply:(frame:ImageFrame)=>void;onCancel:()=>void}){
 const [draft,setDraft]=useState(()=>normalizeImageFrame(frame));
 const session=useRef(currentDocumentSession());
 const [points,setPoints]=useState(()=>cropPoints(frame?.crop));
 const [shape,setShape]=useState<CropShape>(frame?.crop?.shape??'rectangle');
 const [mode,setMode]=useState<'boundary'|'pan'>('boundary');
 const [dragging,setDragging]=useState(false);
 const drag=useRef<{id:number;x:number;y:number;panX:number;panY:number}|null>(null);
 const container=image.parentElement!;
 useLayoutEffect(()=>{const original=image.style.cssText;const previous=container.dataset.cropping;container.dataset.cropping='true';return()=>{image.style.cssText=original;if(previous===undefined)delete container.dataset.cropping;else container.dataset.cropping=previous;};},[image,container]);
 useLayoutEffect(()=>{
  const paint=()=>{const css=getComputedStyle(container),w=parseFloat(css.width)||container.clientWidth,h=parseFloat(css.height)||container.clientHeight;
   const g=framedImageGeometry(image.naturalWidth,image.naturalHeight,w,h,draft,image.dataset.imageFit==='contain'?'contain':'cover');
   Object.assign(image.style,{width:`${g.width}px`,height:`${g.height}px`,left:`${g.left}px`,top:`${g.top}px`,inset:'auto',objectFit:'fill',transform:'none',clipPath:cropClip({shape,points},w,h,g.left,g.top)});
  };paint();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(paint);observer?.observe(container);return()=>observer?.disconnect();
 },[draft,points,shape,image,container]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onCancel();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onCancel]);
 const pan=(e:PointerEvent<HTMLDivElement>)=>{const d=drag.current;if(!d||e.pointerId!==d.id)return;const r=container.getBoundingClientRect();setDraft(old=>({...old,panX:d.panX+(e.clientX-d.x)/r.width*100,panY:d.panY+(e.clientY-d.y)/r.height*100}));};
 return <>{createPortal(<div className={`canvas-crop-surface canvas-outline ${mode==='pan'?'is-panning':''}`} data-editor-only="true" onPointerDown={e=>e.stopPropagation()}>
 {mode==='boundary'?<PolygonPoints points={points} rectangle={shape==='rectangle'} onChange={p=>{setPoints(p);if(shape!=='rectangle'||p.length!==4)setShape('polygon');}}/>:<div className="crop-pan-area" style={{cursor:dragging?'grabbing':'grab'}} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,panX:draft.panX??0,panY:draft.panY??0};setDragging(true);}} onPointerMove={pan} onPointerUp={e=>{pan(e);drag.current=null;setDragging(false);}} onPointerCancel={()=>{drag.current=null;setDragging(false);}}/>}
 </div>,container)}
 {createPortal(<section className="canvas-outline-tools" role="dialog" aria-label="Crop photograph" data-editor-only="true"><strong>Crop photograph</strong><span>Drag boundary points. Click an edge to add a point; double-click a point to remove it. Pan moves the photo inside the crop.</span>
 <div className="canvas-outline-settings"><label>Shape <select aria-label="Crop shape" value={shape} onChange={e=>{const s=e.target.value as CropShape;setShape(s);setPoints(cropPreset(s));setMode('boundary');}}>{['rectangle','ellipse','diamond','triangle','polygon'].map(s=><option key={s}>{s}</option>)}</select></label>
 <label>Zoom <input aria-label="Crop zoom" type="range" min=".5" max="3" step=".01" value={draft.scale} onChange={e=>setDraft(old=>({...old,scale:Number(e.target.value)}))}/><output>{Math.round(draft.scale*100)}%</output></label></div>
 <div className="canvas-outline-buttons"><button aria-pressed={mode==='boundary'} onClick={()=>setMode('boundary')}>Edit boundary</button><button aria-pressed={mode==='pan'} onClick={()=>setMode('pan')}>Pan photo</button><button onClick={()=>{setPoints(cropPreset('rectangle'));setShape('rectangle');}}>Reset crop</button><button onClick={onCancel}>Cancel</button><button className="canvas-outline-apply" disabled={!isCanvasOutlineValid(points)} onClick={()=>{if(session.current===currentDocumentSession())onApply({...draft,crop:{shape,points}});else onCancel();}}>Apply crop</button></div>
 </section>,document.body)}</>;
}
