import {useLayoutEffect,useRef} from 'react';
import type {Asset} from '../schema/document';
import {galleryFrameGeometry} from '../lib/galleryFrame';
import {type ImageFrame,hasImagePan} from '../lib/imageFrame';
import {spreadWindows} from '../lib/magSplit';
import {cropClip} from '../lib/imageCrop';

/** One master photograph, sampled by overlapping facing-page windows. Work in
 * layout pixels (not zoomed screen pixels), so print and canvas share the fit. */
export function GalleryFoldImage({asset,frame,half,bleedMm}:{asset:Asset;frame?:ImageFrame;half:'left'|'right';bleedMm:number}) {
  const ref=useRef<HTMLImageElement>(null);
  useLayoutEffect(()=>{
    const image=ref.current,container=image?.parentElement;
    if(!image||!container)return;
    const paint=()=>{
      const css=getComputedStyle(container),page=container.closest<HTMLElement>('.page');
      const width=parseFloat(css.width),height=parseFloat(css.height);
      if(!(width>0&&height>0))return;
      const pageWidth=page?parseFloat(getComputedStyle(page).width):0;
      const physicalWidth=Number(page?.dataset.pageWidthMm);
      const pixelsPerMm=pageWidth>0&&physicalWidth>0?pageWidth/physicalWidth:96/25.4;
      const windows=spreadWindows(width,bleedMm*pixelsPerMm);
      const g=galleryFrameGeometry(frame);
      const left=g.left/100*windows.width,top=g.top/100*height;
      Object.assign(image.style,{width:`${g.width/100*windows.width}px`,height:`${g.height/100*height}px`,left:`${left-(half==='right'?windows.step:0)}px`,top:`${top}px`,objectFit:g.objectFit,objectPosition:`${g.objectX}% ${g.objectY}%`,clipPath:cropClip(frame?.crop,windows.width,height,left,top)});
      image.dataset.spreadRegionWidth=String(windows.width);
      image.dataset.spreadRegionHeight=String(height);
      image.dataset.spreadWindowOffset=String(half==='right'?windows.step:0);
    };
    paint();image.addEventListener('load',paint);
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(paint);
    observer?.observe(container);
    return()=>{observer?.disconnect();image.removeEventListener('load',paint);};
  },[asset,frame,half,bleedMm]);
  return <img ref={ref} className="spread-photo-image gallery-fold-image" src={asset.src} alt="" draggable={false} data-image-free-pan={hasImagePan(frame)?'true':undefined} style={{position:'absolute',width:'200%',height:'100%',left:half==='right'?'-100%':0,top:0,maxWidth:'none'}}/>;
}
