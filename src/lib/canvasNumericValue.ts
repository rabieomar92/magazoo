/** Eight pointer pixels per input step, clamped to that control's own range. */
export function draggedNumericValue(start:number,pixels:number,step:number,min=-Infinity,max=Infinity){
 const value=start+Math.round(pixels/8)*step;
 return Number(Math.max(min,Math.min(max,value)).toFixed(6));
}
