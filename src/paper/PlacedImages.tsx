import {
  useLayoutEffect,
  useCallback,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Asset, Design, Doc, PlacedImage } from '../schema/document';
import { PAGE_H } from '../lib/geometry';
import { pageDimensions } from '../lib/pageFormat';
import { placedImageContourClip, placedImageGeometry, snapImageColumn } from '../lib/placedImage';
import { defaultPlacedHighlights, placedHighlightsGeometry, highlightAvoidingTop } from '../lib/placedHighlights';
import { articleGridDesign, isReferenceArticle } from '../lib/articleLayouts';
import { useDoc } from '../store/useDoc';
import { HighlightsBody } from './Sidebar';
import { FramedImage } from '../components/FramedImage';
import { usePreviewReadOnly, usePreserveSourceAnchors } from './PreviewReadOnly';

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
  pageHeight = PAGE_H,
): number {
  const clamped = Math.min(Math.max(0, desiredTop), Math.max(0, pageHeight - height));
  if (pxPerMm <= 0 || height <= 0) return clamped;
  const pageRect = page.getBoundingClientRect();
  const right = left + width;
  const bands = Array.from(page.querySelectorAll<HTMLElement>('.placed-image, [data-callout-obstacle]'))
    .map((image) => image.getBoundingClientRect())
    .filter((rect) => {
      const imageLeft = (rect.left - pageRect.left) / pxPerMm;
      const imageRight = (rect.right - pageRect.left) / pxPerMm;
      return Math.min(right, imageRight) - Math.max(left, imageLeft) > 0.2;
    })
    .map((rect) => ({
      top: Math.max(0, (rect.top - pageRect.top) / pxPerMm - gap),
      bottom: Math.min(pageHeight, (rect.bottom - pageRect.top) / pxPerMm + gap),
    }))
    .sort((a, b) => a.top - b.top);
  return highlightAvoidingTop(clamped, height, pageHeight, bands);
}

function PlacedImageItem({
  image,
  asset,
  design,
  pageHeight,
  readOnly,
}: {
  image: PlacedImage;
  asset: Asset;
  design: Design;
  pageHeight: number;
  readOnly: boolean;
}) {
  const update = useDoc((state) => state.update);
  const drag = useRef<DragState | null>(null);
  const geometry = placedImageGeometry(image, asset, design, pageHeight);

  const applyGeometry = (element: HTMLElement, next: typeof geometry) => {
    element.style.left = `${next.visualLeft}mm`;
    element.style.top = `${next.visualTop}mm`;
    element.style.width = `${next.visualWidth}mm`;
    element.style.setProperty('--placed-image-h', `${next.visualHeight}mm`);
    element.style.setProperty('--placed-caption-left', `${next.captionLeft}mm`);
    element.style.setProperty('--placed-caption-width', `${next.width}mm`);
    element.style.setProperty('--placed-caption-space', `${Math.max(0, pageHeight - next.visualTop - next.visualHeight)}mm`);
  };

  const commitAnchor = (column: number, y: number) =>
    update((doc) => {
      const current = doc.images?.find((candidate) => candidate.id === image.id);
      if (!current) return;
      current.anchor.column = column;
      current.anchor.y = y;
    });

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (readOnly || event.button !== 0) return;
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
      pxPerMm: pageRect.width / pageDimensions(design).width,
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
      pageHeight,
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
    '--placed-caption-space': `${Math.max(0, pageHeight - geometry.visualTop - geometry.visualHeight)}mm`,
    ...(image.wrapShape === 'contour'
      ? { '--placed-contour-clip': placedImageContourClip(image) }
      : {}),
  } as CSSProperties;
  const hasBleed = Boolean(
    image.bleed?.left || image.bleed?.right || image.bleed?.top || image.bleed?.bottom,
  );

  return (
    <figure
      className={`placed-image${hasBleed ? ' placed-image--bleed' : ''}${
        image.wrapShape === 'contour' ? ' placed-image--contour' : ''
      }${
        image.bleed?.bottom ? ' placed-image--caption-overlay' : ''
      }`}
      style={style}
      data-image-id={image.id}
      data-editor-tab="images"
      data-editor-target={`article-image-${image.id}`}
      aria-label={`Placed image, ${geometry.widthCols} columns wide`}
      title={readOnly ? undefined : 'Drag to position · horizontal movement snaps to columns'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
    >
      <div className="placed-image-frame">
        <FramedImage asset={asset} frame={image.frame} />
      </div>
      {image.caption.trim() && (
        <figcaption
          data-editor-tab="images"
          data-editor-target={`article-caption-${image.id}`}
          dir={design.textDirection ?? 'ltr'}
          style={{ textAlign: image.align ?? 'left' }}
        >
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}

function PlacedHighlightsItem({ doc, design, pageHeight, readOnly }: { doc: Doc; design: Design; pageHeight: number; readOnly: boolean }) {
  const update = useDoc((state) => state.update);
  const preserveSourceAnchors = usePreserveSourceAnchors();
  const elementRef = useRef<HTMLElement>(null);
  const drag = useRef<HighlightDragState | null>(null);
  const placement = doc.highlightBox ?? defaultPlacedHighlights(design, pageHeight);
  const geometry = placedHighlightsGeometry(placement, design, 0, pageHeight);

  const commitAnchor = useCallback((column: number, y: number) =>
    update((currentDoc) => {
      currentDoc.highlightBox ??= defaultPlacedHighlights(design, pageHeight);
      currentDoc.highlightBox.anchor.page = placement.anchor.page;
      currentDoc.highlightBox.anchor.column = column;
      currentDoc.highlightBox.anchor.y = y;
    }), [update, design, pageHeight, placement.anchor.page]);

  // Content/font/image changes can alter the callout's real height. Keep the
  // stored anchor valid and move it to the nearest image-free slot when one is
  // available, so a newly enlarged box cannot silently cover a photograph.
  useLayoutEffect(() => {
    const element = elementRef.current;
    const page = element?.closest<HTMLElement>('.page');
    if (!element || !page) return;
    // Persist the design default even while the preview is hidden or has not
    // received a measurable width yet. Without this early commit, a loaded
    // free-placement document could be autosaved before its first layout and
    // lose the box's position on the next open.
    const canCommit = !readOnly && !preserveSourceAnchors && design.pageFormat !== 'magazine' && !element.closest('[inert]');
    if (canCommit && !doc.highlightBox) commitAnchor(placement.anchor.column, placement.anchor.y);
    if (!page.offsetWidth) return;
    const pxPerMm = page.getBoundingClientRect().width / pageDimensions(design).width;
    const height = element.getBoundingClientRect().height / pxPerMm;
    const measured = placedHighlightsGeometry(placement, design, height, pageHeight);
    const safeTop = imageAvoidingTop(
      page,
      measured.top,
      measured.left,
      measured.width,
      height,
      pxPerMm,
      Math.max(3, doc.design.gutter * 0.6),
      pageHeight,
    );
    const rounded = Math.round(safeTop * 10) / 10;
    element.style.top = `${rounded}mm`;
    // Materialise the default placement as soon as the free box is rendered.
    // Without this, a box that had never been dragged existed only as a
    // computed fallback and could disappear or move after an autosave/reload.
    if (canCommit && (!doc.highlightBox || Math.abs(rounded - placement.anchor.y) > 0.05)) commitAnchor(measured.column, rounded);
  }, [commitAnchor, doc.assets, doc.design, doc.highlightBox, doc.highlights, doc.images, doc.references, placement, design, pageHeight, readOnly, preserveSourceAnchors]);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (readOnly || event.button !== 0) return;
    const page = event.currentTarget.closest<HTMLElement>('.page');
    if (!page) return;
    const pxPerMm = page.getBoundingClientRect().width / pageDimensions(design).width;
    if (pxPerMm <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startTop = parseFloat(event.currentTarget.style.top) || geometry.top;
    drag.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: geometry.left,
      startTop,
      pxPerMm,
      column: geometry.column,
      top: startTop,
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
    const column = snapImageColumn(nextLeft, geometry.widthCols, design);
    const candidate = placedHighlightsGeometry(
      { ...placement, anchor: { ...placement.anchor, column, y: desiredTop } },
      design,
      state.height,
      pageHeight,
    );
    const top = imageAvoidingTop(
      page,
      candidate.top,
      candidate.left,
      candidate.width,
      state.height,
      state.pxPerMm,
      Math.max(3, doc.design.gutter * 0.6),
      pageHeight,
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
      data-editor-tab="highlights"
      data-editor-target="highlights"
      style={{ left: `${geometry.left}mm`, top: `${geometry.top}mm`, width: `${geometry.width}mm` }}
      dir={doc.design.textDirection ?? 'ltr'}
      aria-label={`Highlights box, ${geometry.widthCols} columns wide`}
      title={readOnly ? undefined : 'Drag to position · horizontal movement snaps to columns'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
    >
      <HighlightsBody doc={doc} />
    </aside>
  );
}

/** Absolute image overlay for one physical sheet. */
export function PlacedImages({ doc, pageIndex, pageHeight = pageDimensions(doc.design).height, readOnly = false, includeHighlights = true }: { doc: Doc; pageIndex: number; pageHeight?: number; readOnly?: boolean; includeHighlights?: boolean }) {
  const inheritedReadOnly = usePreviewReadOnly();
  readOnly = readOnly || inheritedReadOnly;
  const design = isReferenceArticle(doc.templateId) ? articleGridDesign(doc.design) : doc.design;
  const images = (doc.images ?? []).filter((image) => image.anchor.page === pageIndex + 1);
  const showHighlights =
    includeHighlights && doc.design.sidebar &&
    doc.design.highlightsPlacement === 'free' &&
    (doc.highlights.some((item) => item.trim()) || doc.references.length > 0) &&
    (doc.highlightBox ?? defaultPlacedHighlights(design, pageHeight)).anchor.page === pageIndex + 1;
  if (!images.length && !showHighlights) return null;

  return (
    <div className="placed-images" aria-label={`Images on page ${pageIndex + 1}`}>
      {images.map((image) => {
        const asset = doc.assets[image.assetId];
        return asset ? (
          <PlacedImageItem key={image.id} image={image} asset={asset} design={design} pageHeight={pageHeight} readOnly={readOnly}/>
        ) : null;
      })}
      {showHighlights && <PlacedHighlightsItem doc={doc} design={design} pageHeight={pageHeight} readOnly={readOnly}/>}
    </div>
  );
}
