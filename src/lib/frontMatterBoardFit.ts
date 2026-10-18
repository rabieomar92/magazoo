/** Find the largest readable scale that keeps the Editorial Board's role
 * cards inside its two-column, one-page area. The caller performs the exact
 * DOM measurement at each candidate, so wrapping and uploaded fonts count. */
export function largestBoardScaleThatFits(
  fits: (scale: number) => boolean,
  minimum = 0.62,
  iterations = 9,
) {
  if (fits(1)) return 1;
  if (!fits(minimum)) return minimum;
  let low = minimum;
  let high = 1;
  for (let index = 0; index < iterations; index += 1) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  return Math.floor(low * 1000) / 1000;
}

/** Honour the requested photograph height up to the space actually left by
 * the publication copy. Measurement must use the same page as final output. */
export function largestBoardHeroThatFits(requested:number, fits:(height:number)=>boolean) {
  const maximum=Math.max(25,Math.min(180,requested));
  if (fits(maximum)) return maximum;
  if (!fits(25)) return 25;
  let low=25, high=maximum;
  while (high-low>.1) {
    const middle=(low+high)/2;
    if (fits(middle)) low=middle; else high=middle;
  }
  return Math.floor(low*10)/10;
}
