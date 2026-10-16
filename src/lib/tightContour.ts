export interface TightOutline { points: {x:number;y:number}[]; gap: number }
export interface ContourBand { top:number; bottom:number; outline?:TightOutline }
export interface TightContour { side:'left'|'right'; path:string }
// CSS Shapes measures line boxes, while italic/ascender glyph ink can protrude
// slightly beyond them. Keep a two-pixel optical guard even at zero clearance.
export const TEXT_CONTOUR_SAFETY_PX=2;

/** A native three-line initial cannot share a BFC with Chromium's full-width
 * shape float: only its first line is excluded. Give the opener a real clear
 * rectangle, then continue the same paragraph beside the rebased contour. */
export function contourOpening(bands:ContourBand[],width:number,height:number,minHeight:number):{top:number;bottom:number}|undefined {
  if(!(minHeight>0&&Number.isFinite(minHeight)))return;
  const occupied=bands.flatMap(b=>{
    const o=b.outline;
    if(!o)return [{top:Math.max(0,b.top),bottom:Math.min(height,b.bottom)}];
    if(o.points.length<3)return [];
    const gap=TEXT_CONTOUR_SAFETY_PX+Math.max(0,Math.min(48,o.gap||0));
    if(Math.max(...o.points.map(p=>p.x))+gap<=0||Math.min(...o.points.map(p=>p.x))-gap>=width)return [];
    return [{top:Math.max(0,b.top-gap),bottom:Math.min(height,b.bottom+gap)}];
  }).filter(b=>b.bottom>b.top).sort((a,b)=>a.top-b.top);
  let top=0;
  for(const band of occupied){
    if(band.top-top>=minHeight)return {top,bottom:band.top};
    top=Math.max(top,band.bottom);
  }
  if(height-top>=minHeight)return {top,bottom:height};
}

export function offsetContourBands(bands:ContourBand[],top:number):ContourBand[] {
  return bands.map(b=>({...b,top:b.top-top,bottom:b.bottom-top,outline:b.outline?{...b.outline,points:b.outline.points.map(p=>({...p,y:p.y-top}))}:undefined}));
}

function strip(points:TightOutline['points'], boundary:number, keepBelow:boolean) {
  const output:TightOutline['points']=[];
  for(let i=0;i<points.length;i++) {
    const a=points[i],b=points[(i+1)%points.length];
    const insideA=keepBelow?a.y>=boundary:a.y<=boundary, insideB=keepBelow?b.y>=boundary:b.y<=boundary;
    if(insideA)output.push(a);
    if(insideA!==insideB)output.push({x:a.x+(b.x-a.x)*(boundary-a.y)/(b.y-a.y),y:boundary});
  }
  return output;
}

/** A conservative, two-pixel edge profile, not one box per column. Native CSS
 * Shapes then chooses the available width for EVERY line of type. Rectangular
 * captions/other objects are unioned into the same profile. Points are local
 * unscaled CSS pixels, so print and preview use precisely the same boundary. */
export function tightContour(bands:ContourBand[],width:number,height:number,minLineWidth=48,lineHeight=0):TightContour|undefined {
  if(!(width>0&&height>0&&Number.isFinite(width)&&Number.isFinite(height)))return;
  const outlines=bands.filter(b=>{
    const o=b.outline;
    if(!o||o.points.length<3||!o.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))return false;
    const gap=TEXT_CONTOUR_SAFETY_PX+Math.max(0,Math.min(48,Number.isFinite(o.gap)?o.gap:0));
    return b.bottom+gap>0&&b.top-gap<height&&Math.min(...o.points.map(p=>p.x))-gap<width&&Math.max(...o.points.map(p=>p.x))+gap>0;
  });
  if(!outlines.length)return;
  const metadata=outlines.map(b=>{
    const p=b.outline!.points,x0=Math.min(...p.map(p=>p.x)),x1=Math.max(...p.map(p=>p.x));
    const area=Math.max(0,Math.min(width,x1)-Math.max(0,x0))*Math.max(0,Math.min(height,b.bottom)-Math.max(0,b.top));
    return {band:b,side:(x0+x1)/2>width/2?'right' as const:'left' as const,area};
  });
  const side=metadata.reduce((a,b)=>a.area>=b.area?a:b).side;
  const rects=bands.filter(b=>!b.outline);
  // One conservative profile per actual line box. A blocked line resumes at
  // the next baseline, not at an arbitrary two-pixel contour vertex.
  const step=lineHeight>0&&Number.isFinite(lineHeight)?Math.max(2,lineHeight):height/Math.min(512,Math.max(1,Math.ceil(height/2)));
  const rows=Math.max(1,Math.ceil(height/step));
  const points:{x:number;y:number}[]=[];
  const outer=side==='left'?0:width;
  for(let row=0;row<rows;row++) {
    const top=row*step,bottom=Math.min(height,(row+1)*step);
    let edge=outer;
    if(rects.some(b=>b.top<bottom&&b.bottom>top))edge=side==='left'?width:0;
    for(const {band,side:objectSide} of metadata) {
      const outline=band.outline!,gap=TEXT_CONTOUR_SAFETY_PX+Math.max(0,Math.min(48,Number.isFinite(outline.gap)?outline.gap:0));
      if(band.bottom+gap<=top||band.top-gap>=bottom)continue;
      const clipped=strip(strip(outline.points,top-gap,true),bottom+gap,false);
      if(clipped.length<3)continue;
      const left=Math.min(...clipped.map(p=>p.x))-gap,right=Math.max(...clipped.map(p=>p.x))+gap;
      if(right<=0||left>=width)continue;
      // Opposite-side images cannot share one physical float safely. At those
      // heights reserve the union, never allow a line to cross either image.
      if(objectSide!==side)edge=side==='left'?width:0;
      else edge=side==='left'?Math.max(edge,Math.min(width,right)):Math.min(edge,Math.max(0,left));
    }
    const available=side==='left'?width-edge:edge;
    // A geometric gap is not necessarily a usable editorial text lane. Avoid
    // ladders of hyphenated half-words beside a large cutout: reserve the line
    // until a minimum readable word lane is clear. Callers use three body ems;
    // a former nine-em limit left large usable gaps beside hand-drawn borders.
    // Never widen a column or alter the author's outline to obtain that room.
    if(available>0&&available<Math.min(width*.75,Math.max(0,minLineWidth)))edge=side==='left'?width:0;
    points.push({x:edge,y:top},{x:edge,y:bottom});
  }
  const n=(value:number)=>Number(value.toFixed(3));
  return {side,path:`polygon(${outer}px 0px, ${points.map(p=>`${n(p.x)}px ${n(p.y)}px`).join(', ')}, ${outer}px ${n(height)}px)`};
}

/** Insert only into a measuring host. paintText/paint clears it for each
 * candidate; the same definition is rendered by ContourFloat on the page. */
export function measureContour(host:HTMLElement,contour:TightContour) {
  if(host.querySelector(':scope > [data-tight-contour]'))return;
  const shape=document.createElement('span');shape.dataset.tightContour='true';shape.setAttribute('aria-hidden','true');
  shape.style.cssText=`display:block;float:${contour.side};width:100%;height:100%;pointer-events:none`;
  shape.style.shapeOutside=contour.path;
  host.prepend(shape);
  host.querySelectorAll<HTMLElement>('figure').forEach(figure=>{figure.style.clear='both';});
}
