/** Move text regions by complete baseline steps, never by an image's arbitrary
 * pixel coordinate. Images stay freely positioned; only text is snapped. */
export function lineGridUp(value:number,step:number,origin=0):number {
  return step>0&&Number.isFinite(step) ? origin+Math.ceil((value-origin)/step-1e-7)*step : value;
}
export function lineGridDown(value:number,step:number,origin=0):number {
  return step>0&&Number.isFinite(step) ? origin+Math.floor((value-origin)/step+1e-7)*step : value;
}
