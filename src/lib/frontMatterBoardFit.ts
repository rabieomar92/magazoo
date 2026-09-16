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
