/** Screen rectangles include every ancestor's preview zoom. Layout offsets
 * must stay in unscaled CSS pixels, just like offsetHeight and mm geometry. */
export function unscaledVerticalOffset(element: HTMLElement, container: HTMLElement): number {
  const bounds = container.getBoundingClientRect();
  // Computed width retains fractional pixels; offsetWidth rounds them.
  const width = Number.parseFloat(getComputedStyle(container).width) || bounds.width;
  const scale = bounds.width / width || 1;
  return (element.getBoundingClientRect().top - bounds.top) / scale;
}
