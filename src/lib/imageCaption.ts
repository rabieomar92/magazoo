import type {PlacedImage,Asset,Design} from '../schema/document';
import {placedImageGeometry,placedImagePolygon,placedImageContour} from './placedImage';

type Point={x:number;y:number};
export interface CaptionObstacle { points:Point[]; gap:number }
export interface CaptionBox { x:number;y:number;width:number;height:number }
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));

/** Project the filled polygon onto Y within the caption's horizontal span.
 * Clipping each edge at both X boundaries retains concave pockets rather than
 * substituting the image's rectangular frame. All coordinates are page mm. */
function bandsAt(obstacle:CaptionObstacle,left:number,right:number) {
  const {points,gap}=obstacle;
  const edges=points.map((a,i)=>({a,b:points[(i+1)%points.length]}));
  const x0=left-gap,x1=right+gap;
  const events=points.map(p=>p.y);
  for(const {a,b} of edges) for(const x of [x0,x1]) {
    const t=(x-a.x)/(b.x-a.x);
    if(t>0&&t<1)events.push(a.y+t*(b.y-a.y));
  }
  const ys=[...new Set(events)].sort((a,b)=>a-b),bands:{top:number;bottom:number}[]=[];
  for(let i=0;i<ys.length-1;i++) {
    const y=(ys[i]+ys[i+1])/2,xs:number[]=[];
    for(const {a,b} of edges) if((a.y<=y&&b.y>y)||(b.y<=y&&a.y>y)) xs.push(a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y));
    xs.sort((a,b)=>a-b);
    for(let j=0;j+1<xs.length;j+=2) if(xs[j]<x1&&xs[j+1]>x0) {bands.push({top:ys[i]-gap,bottom:ys[i+1]+gap});break;}
  }
  return bands;
}

export function imageCaptionObstacle(image:PlacedImage,asset:Asset,design:Design,pageHeight:number,gap=.8):CaptionObstacle {
  const g=placedImageGeometry(image,asset,design,pageHeight);
  let points:Point[];
  if(image.wrapShape==='polygon')points=placedImagePolygon(image);
  else if(image.wrapShape==='contour') {
    const slices=placedImageContour(image);
    points=slices.flatMap((s,i)=>[{x:i*100/slices.length,y:s.top},{x:(i+1)*100/slices.length,y:s.top}]);
    for(let i=slices.length-1;i>=0;i--)points.push({x:(i+1)*100/slices.length,y:100-slices[i].bottom},{x:i*100/slices.length,y:100-slices[i].bottom});
  } else points=[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
  return {gap,points:points.map(p=>({x:g.visualLeft+g.visualWidth*p.x/100,y:g.visualTop+g.visualHeight*p.y/100}))};
}

/** Nearest safe caption slot. If no slot exists, return an explicit failure;
 * callers show a fit warning rather than painting copy across the photograph. */
export function safeCaptionPosition(desired:CaptionBox,pageWidth:number,pageHeight:number,obstacles:CaptionObstacle[]):CaptionBox & {fits:boolean} {
  const width=clamp(Number.isFinite(desired.width)?desired.width:40,1,pageWidth),height=Math.max(0,Number.isFinite(desired.height)?desired.height:0);
  const target={...desired,width,height,x:clamp(Number.isFinite(desired.x)?desired.x:0,0,pageWidth-width),y:clamp(Number.isFinite(desired.y)?desired.y:0,0,Math.max(0,pageHeight-height))};
  obstacles=obstacles.filter(o=>o.points.length>=3&&o.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  const candidates=[target.x,0,pageWidth-width,...Array.from({length:9},(_,i)=>(pageWidth-width)*i/8)];
  for(const o of obstacles) {
    const xs=o.points.map(p=>p.x);
    candidates.push(clamp(Math.min(...xs)-o.gap-width,0,pageWidth-width),clamp(Math.max(...xs)+o.gap,0,pageWidth-width));
  }
  let best:CaptionBox|undefined,bestDistance=Infinity;
  for(const x of new Set(candidates)) {
    const bands=obstacles.flatMap(o=>bandsAt(o,x,x+width)).sort((a,b)=>a.top-b.top);
    const slots:{top:number;bottom:number}[]=[];
    let cursor=0;
    for(const b of bands) {
      if(b.top>cursor)slots.push({top:cursor,bottom:Math.min(pageHeight,b.top)});
      cursor=Math.max(cursor,b.bottom);
    }
    if(cursor<pageHeight)slots.push({top:cursor,bottom:pageHeight});
    for(const slot of slots) {
      if(slot.bottom-slot.top<height+.01)continue;
      const y=clamp(target.y,slot.top,slot.bottom-height);
      const distance=(x-target.x)**2+(y-target.y)**2;
      if(distance<bestDistance){best={...target,x,y};bestDistance=distance;}
    }
    if(bestDistance===0)break;
  }
  return {...(best??target),fits:!!best};
}
