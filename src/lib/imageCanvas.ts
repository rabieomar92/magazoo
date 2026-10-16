import {isPlacedImagePolygonValid} from './placedImage';

export const DRAW_IMAGE_OUTLINE_EVENT='magazoo:draw-image-outline';

/** Pointer rounding makes an almost straight stroke technically non-collinear.
 * Require a real area, not a hairline sliver accidentally created by jitter. */
export function isCanvasOutlineValid(points:{x:number;y:number}[]):boolean {
  if(!isPlacedImagePolygonValid(points))return false;
  const first=points[0];
  const farthest=points.reduce((a,b)=>Math.hypot(a.x-first.x,a.y-first.y)>=Math.hypot(b.x-first.x,b.y-first.y)?a:b);
  const dx=farthest.x-first.x,dy=farthest.y-first.y,length=Math.hypot(dx,dy);
  return length>0&&points.some(p=>Math.abs(dx*(p.y-first.y)-dy*(p.x-first.x))/length>.5);
}

/** Drawing is transient editor UI, never document data or an autosave. */
export function requestImageOutline(imageId:string) {
  window.dispatchEvent(new CustomEvent(DRAW_IMAGE_OUTLINE_EVENT,{detail:{imageId}}));
}
