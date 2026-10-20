/** Grow the transition with immersion rather than letting text outrun it.
 * Percent stops are also understood by the print-photo compositor. */
export function heroFadeClearStop(heightMm:number,immersionMm:number){
 if(!(heightMm>0))return 50;
 const depth=Number.isFinite(immersionMm)?Math.max(0,immersionMm):0;
 return Math.max(0,50-Math.min(heightMm,depth)/heightMm*100);
}
