export type CropPoint={x:number;y:number};
export type CropShape='rectangle'|'ellipse'|'diamond'|'triangle'|'polygon';
export interface ImageCrop {shape:CropShape;points:CropPoint[]}
export function cropPreset(shape:CropShape):CropPoint[]{
 if(shape==='ellipse')return Array.from({length:48},(_,i)=>({x:50+50*Math.cos(i*Math.PI/24),y:50+50*Math.sin(i*Math.PI/24)}));
 if(shape==='diamond')return [{x:50,y:0},{x:100,y:50},{x:50,y:100},{x:0,y:50}];
 if(shape==='triangle')return [{x:50,y:0},{x:100,y:100},{x:0,y:100}];
 return [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
}
/** Crop is frame-relative, so moving/zooming the photo never moves the mask. */
export function cropPoints(crop?:ImageCrop):CropPoint[]{
 if(!crop||!Array.isArray(crop.points)||crop.points.length<3)return cropPreset('rectangle');
 return crop.points.slice(0,128).map(p=>({x:Math.max(0,Math.min(100,Number.isFinite(p.x)?p.x:0)),y:Math.max(0,Math.min(100,Number.isFinite(p.y)?p.y:0))}));
}
export function cropClip(crop:ImageCrop|undefined,width:number,height:number,left=0,top=0):string{
 return crop?`polygon(evenodd, ${cropPoints(crop).map(p=>`${p.x*width/100-left}px ${p.y*height/100-top}px`).join(', ')})`:'none';
}
