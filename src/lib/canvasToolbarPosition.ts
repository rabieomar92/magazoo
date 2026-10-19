/** Keep contextual controls inside the viewport, independent of canvas zoom. */
export function canvasToolbarPosition(anchor:{left:number;top:number;bottom:number},width:number,height:number,viewportWidth:number,viewportHeight:number){
 const gap=8,pad=12;
 return {
  left:Math.max(pad,Math.min(anchor.left,viewportWidth-width-pad)),
  top:Math.max(pad,Math.min(anchor.bottom+gap+height<=viewportHeight-pad?anchor.bottom+gap:anchor.top-height-gap,viewportHeight-height-pad)),
 };
}
