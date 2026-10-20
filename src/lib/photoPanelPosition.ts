export function photoPanelPosition(anchor:{left:number;right:number;top:number;bottom:number}|null,width:number,height:number,vw:number,vh:number){
 const gap=12,clamp=(n:number,max:number)=>Math.max(gap,Math.min(n,max-gap));
 if(anchor){
  if(vw-anchor.right>=width+gap*2)return{left:anchor.right+gap,top:clamp(anchor.top,vh-height)};
  if(anchor.left>=width+gap*2)return{left:anchor.left-width-gap,top:clamp(anchor.top,vh-height)};
  if(anchor.top>=height+gap*2)return{left:clamp(anchor.left,vw-width),top:anchor.top-height-gap};
  if(vh-anchor.bottom>=height+gap*2)return{left:clamp(anchor.left,vw-width),top:anchor.bottom+gap};
 }
 return{left:clamp(vw-width-gap,vw-width),top:gap};
}
