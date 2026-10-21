export interface MarginRect {left:number;top:number;right:number;bottom:number}
/** Physical millimetres, independent of preview zoom and print resolution. */
export function marginTextPlacement(width:number,height:number,textWidth:number,textHeight:number,edge:number,bottom:number,right:boolean,images:readonly MarginRect[],avoidImages=true){
 if(!avoidImages){
  const offset=Math.max(0,Math.min(Math.max(0,height-textHeight),bottom));
  const left=right?width-edge-textWidth:edge,top=height-offset-textHeight;
  const blocked=images.some(image=>left<image.right+2&&left+textWidth>image.left-2&&top<image.bottom+2&&top+textHeight>image.top-2);
  return {right,bottom:offset,blocked,score:0};
 }
 const clamp=(value:number)=>Math.max(8,Math.min(height-textHeight-8,value));
 const desired=clamp(height-bottom-textHeight);
 const candidates=[desired,8,height-textHeight-8,...images.flatMap(image=>[image.top-textHeight-2,image.bottom+2])].map(clamp);
 const placements=[right,!right].flatMap(side=>candidates.map(top=>{
  const left=side?width-edge-textWidth:edge;
  const box={left,right:left+textWidth,top,bottom:top+textHeight};
  const blocked=images.some(image=>box.left<image.right+2&&box.right>image.left-2&&box.top<image.bottom+2&&box.bottom>image.top-2);
  return {right:side,bottom:height-box.bottom,blocked,score:Math.abs(top-desired)+(side===right?0:height)};
 }));
 return placements.filter(p=>!p.blocked).sort((a,b)=>a.score-b.score)[0]??placements[0];
}
