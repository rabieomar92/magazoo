import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { Doc } from '../schema/document';
import { gatePlacement, clampGate } from '../lib/gatePlacement';
import { PAGE_W } from '../lib/geometry';
import { useDoc } from '../store/useDoc';
import { useVerticalDrag } from './useVerticalDrag';

/** The box the copy is already occupying, in page millimetres. Recorded the
 * first time a block is placed by hand so that taking hold of it moves it
 * without also re-flowing the text to a different measure. */
function currentBox(element: HTMLElement, rtl: boolean) {
  const page = element.closest<HTMLElement>('.page');
  if (!page) return {};
  const pageRect = page.getBoundingClientRect();
  const pxPerMm = pageRect.width / PAGE_W;
  if (!pxPerMm) return {};
  const rects = Array.from(element.children)
    .map(child => child.getBoundingClientRect())
    .filter(rect => rect.width > 0);
  if (!rects.length) return {};
  const left = Math.min(...rects.map(rect => rect.left));
  const right = Math.max(...rects.map(rect => rect.right));
  return {
    inset: Math.round(((rtl ? pageRect.right - right : left - pageRect.left) / pxPerMm) * 10) / 10,
    width: Math.round(((right - left) / pxPerMm) * 10) / 10,
  };
}

/** Fit a cover block using unscaled page coordinates. The resulting position
 * is also carried into the print clone; no changes to article pagination. */
export function useGatePlacement(doc: Doc, side: 'title' | 'text', vars: CSSProperties) {
  const inner = useRef<HTMLDivElement>(null);
  const mid = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const update = useDoc(state => state.update);
  const key = side === 'title' ? 'gateTitle' : 'gateText';
  const box = doc.design[key];
  const position = gatePlacement(box, doc.design.margin);

  // The block can also be dragged up and down on the sheet. One that is still
  // centred reports where it currently sits, so taking hold of it simply
  // continues from there; the masthead and credit limits below still apply.
  const drag = useVerticalDrag({
    start: (element, pxPerMm) => {
      const page = element.closest<HTMLElement>('.page');
      if (!page) return position.top ?? doc.design.margin;
      return (element.getBoundingClientRect().top - page.getBoundingClientRect().top) / pxPerMm;
    },
    clamp: value => clampGate(value, 0, 260),
    commit: (top, element) => update(d => {
      const stored = d.design[key];
      const next = { ...(stored ?? currentBox(element, d.design.textDirection === 'rtl')), top };
      d.design[key] = { ...next, ...gatePlacement(next, d.design.margin) };
    }),
  });
  useLayoutEffect(() => {
    const frame = inner.current;
    const copy = mid.current;
    if (!frame || !copy) return;
    if (!box) {
      copy.style.removeProperty('max-height');
      copy.style.removeProperty('top');
      setOverflow(false);
      return;
    }
    const measure = () => {
      const rect = frame.getBoundingClientRect();
      const scale = rect.width / frame.clientWidth || 1;
      const pxPerMm = frame.clientWidth / (210 - 2 * doc.design.margin);
      const bar = frame.querySelector<HTMLElement>('.tag-bar');
      const foot = frame.querySelector<HTMLElement>('.mag-gate-foot');
      const min = bar ? Math.max(0, (bar.getBoundingClientRect().bottom - rect.top) / scale + 5 * pxPerMm) : 0;
      const bottom = foot ? (foot.getBoundingClientRect().top - rect.top) / scale - 5 * pxPerMm : frame.clientHeight;
      const available = Math.max(0, bottom - min);
      copy.style.maxHeight = `${available}px`;
      const height = copy.scrollHeight;
      const preferred = position.top === undefined ? min + (available - height) / 2 : (position.top - doc.design.margin) * pxPerMm;
      copy.style.top = `${clampGate(preferred, min, Math.max(min, bottom - height))}px`;
      setOverflow(height > available + 1 || copy.scrollWidth > copy.clientWidth + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame); observer.observe(copy);
    const foot = frame.querySelector('.mag-gate-foot');
    if (foot) observer.observe(foot);
    document.fonts?.addEventListener('loadingdone', measure);
    return () => { observer.disconnect(); document.fonts?.removeEventListener('loadingdone', measure); };
  }, [doc, box, position.top, vars]);
  const style = box ? {
    '--gate-inset': `${position.inset - doc.design.margin}mm`,
    '--gate-width': `${position.width}mm`,
    '--gate-align': box.align ?? (side === 'text' && doc.design.textDirection !== 'rtl' ? 'end' : 'start'),
  } as CSSProperties : undefined;
  return { inner, mid, style, positioned: !!box, overflow, drag };
}
