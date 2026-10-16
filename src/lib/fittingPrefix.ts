/** Find the last fitting paragraph prefix in a single-column measuring host.
 * Whole input is already known to overflow. Keep this opt-in: native
 * multicolumn/spanner balancing is not reliably monotonic. */
export function fittingPrefix(length:number,fits:(count:number)=>boolean):number {
  let lo=0,hi=Math.max(0,length-1),best=0;
  while(lo<=hi){const mid=(lo+hi)>>>1;if(fits(mid)){best=mid;lo=mid+1;}else hi=mid-1;}
  // Protect against rounding or a late browser/font geometry change.
  while(best>0&&!fits(best))best--;
  return best;
}
