import {
  useLayoutEffect,
  useCallback,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Asset, Design, Doc, PlacedImage } from '../schema/document';
import { PAGE_H, PAGE_W } from '../lib/geometry';
import { placedImageGeometry, snapImageColumn } from '../lib/placedImage';
import { defaultPlacedHighlights, placedHighlightsGeometry } from '../lib/placedHighlights';
import { useDoc } from '../store/useDoc';
import { HighlightsBody } from './Sidebar';
import { FramedImage } from '../components/FramedImage';

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startLeft: number;
  startTop: number;
  pxPerMm: number;
  column: number;
  top: number;
}

interface HighlightDragState extends DragState {
  height: number;
}

/** Find the nearest vertical slot which does not overlap an image sharing the
 * selected physical columns. Coordinates are unscaled page millimetres. */
function imageAvoidingTop(
  page: HTMLElement,
  desiredTop: number,
  left: number,
  width: number,
  height: number,
  pxPerMm: number,
  gap: number,
): number {
  const clamped = Math.min(Math.max(0, desiredTop), Math.max(0, PAGE_H - height));
  if (pxPerMm <= 0 || height <= 0) return clamped;
  const pageRect = page.getBoundingClientRect();
  const right = left + width;
  const bands = Array.from(page.querySelectorAll<HTMLElement>('.placed-image'))
    .map((image) => image.getBoundingClientRect())
    .filter((rect) => {
      const imageLeft = (rect.left - pageRect.left) / pxPerMm;
      const imageRight = (rect.right - pageRect.left) / pxPerMm;
      return Math.min(right, imageRight) - Math.max(left, imageLeft) > 0.2;
    })
    .map((rect) => ({
      top: Math.max(0, (rect.top - pageRect.top) / pxPerMm - gap),
      bottom: Math.min(PAGE_H, (rect.bottom - pageRect.top) / pxPerMm + gap),
    }))
    .sort((a, b) => a.top - b.top);
  if (!bands.length) return clamped;

  const merged: { top: number; bottom: number }[] = [];
  for (const band of bands) {
    const previous = merged.at(-1);
    if (previous && band.top <= previous.bottom) previous.bottom = Math.max(previous.bottom, band.bottom);
    else merged.push({ ...band });
  }
  const gaps: { top: number; bottom: number }[] = [];
  let cursor = 0;
  for (const band of merged) {
    if (band.top > cursor) gaps.push({ top: cursor, bottom: band.top });
    cursor = Math.max(cursor, band.bottom);
  }
  if (cursor < PAGE_H) gaps.push({ top: cursor, bottom: PAGE_H });

  const candidates = gaps
    .filter((slot) => slot.bottom - slot.top >= height - 0.05)
    .map((slot) => Math.min(Math.max(clamped, slot.top), slot.bottom - height));
  return candidates.sort((a, b) => Math.abs(a - clamped) - Math.abs(b - clamped))[0] ?? clamped;
}

function PlacedImageItem({
  image,
  asset,
  design,
}: {
  image: PlacedImage;
  asset: Asset;
  design: Design;
}) {
  const update = useDoc((state) => state.update);
  const drag = useRef<DragState | null>(null);
  const geometry = placedImageGeometry(image, asset, design);

  const applyGeometry = (element: HTMLElement, next: typeof geometry) => {
    element.style.left = `${next.visualLeft}mm`;
    element.style.top = `${next.visualTop}mm`;
    element.style.width = `${next.visualWidth}mm`;
    element.style.setProperty('--placed-image-h', `${next.visualHeight}mm`);
    element.style.setProperty('--placed-caption-left', `${next.captionLeft}mm`);
    element.style.setProperty('--placed-caption-width', `${next.width}mm`);
  };

  const commitAnchor = (column: number, y: number) =>
    update((doc) => {
      const current = doc.images?.find((candidate) => candidate.id === image.id);
      if (!current) return;
      current.anchor.column = column;
      current.anchor.y = y;
    });

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const page = event.currentTarget.closest<HTMLElement>('.page');
    if (!page) return;
    const pageRect = page.getBoundingClientRect();
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: geometry.left,
      startTop: geometry.top,
      pxPerMm: pageRect.width / PAGE_W,
      column: geometry.column,
      top: geometry.top,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId || state.pxPerMm <= 0) return;
    const nextLeft = state.startLeft + (event.clientX - state.startClientX) / state.pxPerMm;
    const nextTop = state.startTop + (event.clientY - state.startClientY) / state.pxPerMm;
    const column = snapImageColumn(nextLeft, geometry.widthCols, design);
    const y = Math.min(geometry.maxTop, Math.max(0, nextTop));
    const roundedTop = Math.round(y * 10) / 10;
    state.column = column;
    state.top = roundedTop;

    // Dragging is a visual preview only. Updating the document here used to
    // structured-clone every embedded image and re-paginate the whole article
    // for every pointer event, which made the handle feel several frames
    // behind the cursor. Commit once on release instead.
    const nextGeometry = placedImageGeometry(
      { ...image, anchor: { ...image.anchor, column, y: roundedTop } },
      asset,
      design,
    );
    applyGeometry(event.currentTarget, nextGeometry);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    const state = drag.current;
    drag.current = null;
    commitAnchor(state.column, state.top);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const style = {
    left: `${geometry.visualLeft}mm`,
    top: `${geometry.visualTop}mm`,
    width: `${geometry.visualWidth}mm`,
    '--placed-image-h': `${geometry.visualHeight}mm`,
    '--placed-caption-left': `${geometry.captionLeft}mm`,
    '--placed-caption-width': `${geometry.width}mm`,
  } as CSSProperties;
  const hasBleed = Boolean(
    image.bleed?.left || image.bleed?.right || image.bleed?.top || image.bleed?.bottom,
  );

  return (
    <figure
      className={`placed-image${hasBleed ? ' placed-image--bleed' : ''}${
        image.bleed?.bottom ? ' placed-image--caption-overlay' : ''
      }`}
      style={style}
      data-image-id={image.id}
      aria-label={`Placed image, ${geometry.widthCols} columns wide`}
      title="Drag to position · horizontal movement snaps to columns"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <div className="placed-image-frame">
        <FramedImage asset={asset} frame={image.frame} />
      </div>
      {image.caption.trim() && (
        <figcaption
          dir={design.textDirection ?? 'ltr'}
          style={{ textAlign: image.align ?? 'left' }}
        >
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}

function PlacedHighlightsItem({ doc }: { doc: Doc }) {
  const update = useDoc((state) => state.update);
  const elementRef = useRef<HTMLElement>(null);
  const drag = useRef<HighlightDragState | null>(null);
  const placement = doc.highlightBox ?? defaultPlacedHighlights(doc.design);
  const geometry = placedHighlightsGeometry(placement, doc.design);

  const commitAnchor = useCallback((column: number, y: number) =>
    update((currentDoc) => {
      currentDoc.highlightBox ??= defaultPlacedHighlights(currentDoc.design);
      currentDoc.highlightBox.anchor.column = column;
      currentDoc.highlightBox.anchor.y = y;
    }), [update]);

  // Content/font/image changes can alter the callout's real height. Keep the
  // stored anchor valid and move it to the nearest image-free slot when one is
  // available, so a newly enlarged box cannot silently cover a photograph.
  useLayoutEffect(() => {
    const element = elementRef.current;
    const page = element?.closest<HTMLElement>('.page');
    if (!element || !page || !page.offsetWidth) return;
    const pxPerMm = page.getBoundingClientRect().width / PAGE_W;
    const height = element.getBoundingClientRect().height / pxPerMm;
    const measured = placedHighlightsGeometry(placement, doc.design, height);
    const safeTop = imageAvoidingTop(
      page,
      measured.top,
      measured.left,
      measured.width,
      height,
      pxPerMm,
      Math.max(3, doc.design.gutter * 0.6),
    );
    const rounded = Math.round(safeTop * 10) / 10;
    element.style.top = `${rounded}mm`;
    if (Math.abs(rounded - placement.anchor.y) > 0.05) commitAnchor(measured.column, rounded);
  }, [commitAnchor, doc.assets, doc.design, doc.highlights, doc.images, doc.references, placement]);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const page = event.currentTarget.closest<HTMLElement>('.page');
    if (!page) return;
    const pxPerMm = page.getBoundingClientRect().width / PAGE_W;
    if (pxPerMm <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: geometry.left,
      startTop: parseFloat(event.currentTarget.style.top) || geometry.top,
      pxPerMm,
      column: geometry.column,
      top: geometry.top,
      height: event.currentTarget.getBoundingClientRect().height / pxPerMm,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const page = event.currentTarget.closest<HTMLElement>('.page');
    if (!page) return;
    const nextLeft = state.startLeft + (event.clientX - state.startClientX) / state.pxPerMm;
    const desiredTop = state.startTop + (event.clientY - state.startClientY) / state.pxPerMm;
    const column = snapImageColumn(nextLeft, geometry.widthCols, doc.design);
    const candidate = placedHighlightsGeometry(
      { ...placement, anchor: { ...placement.anchor, column, y: desiredTop } },
      doc.design,
      state.height,
    );
    const top = imageAvoidingTop(
      page,
      candidate.top,
      candidate.left,
      candidate.width,
      state.height,
      state.pxPerMm,
      Math.max(3, doc.design.gutter * 0.6),
    );
    const rounded = Math.round(top * 10) / 10;
    state.column = column;
    state.top = rounded;
    event.currentTarget.style.left = `${candidate.left}mm`;
    event.currentTarget.style.top = `${rounded}mm`;
  };

  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    const state = drag.current;
    drag.current = null;
    commitAnchor(state.column, state.top);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <aside
      ref={elementRef}
      className="placed-highlights"
      style={{ left: `${geometry.left}mm`, top: `${geometry.top}mm`, width: `${geometry.width}mm` }}
      dir={doc.design.textDirection ?? 'ltr'}
      aria-label={`Highlights box, ${geometry.widthCols} columns wide`}
      title="Drag to position · horizontal movement snaps to columns"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <HighlightsBody doc={doc} />
    </aside>
  );
}

/** Absolute image overlay for one physical sheet. */
export function PlacedImages({ doc, pageIndex }: { doc: Doc; pageIndex: number }) {
  const images = (doc.images ?? []).filter((image) => image.anchor.page === pageIndex + 1);
  const showHighlights =
    doc.design.sidebar &&
    doc.design.highlightsPlacement === 'free' &&
    (doc.highlights.some((item) => item.trim()) || doc.references.length > 0) &&
    (doc.highlightBox ?? defaultPlacedHighlights(doc.design)).anchor.page === pageIndex + 1;
  if (!images.length && !showHighlights) return null;

  return (
    <div className="placed-images" aria-label={`Images on page ${pageIndex + 1}`}>
      {images.map((image) => {
        const asset = doc.assets[image.assetId];
        return asset ? (
          <PlacedImageItem key={image.id} image={image} asset={asset} design={doc.design} />
        ) : null;
      })}
      {showHighlights && <PlacedHighlightsItem doc={doc} />}
    </div>
  );
}
