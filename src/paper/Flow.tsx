import { Fragment, useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { Doc } from '../schema/document';
import type { Piece } from '../lib/paginate';
import { parseRuns, renderTex, runsToHtml } from '../lib/richtext';
import { fitEquation } from '../lib/mathfit';
import { HighlightsBody } from './Sidebar';
import { MagSplitAside } from './MagSplitHead';
import { exclusionGradient, mergeExclusions, type ColumnExclusion } from '../lib/columnFill';
import { requestBlockEditorFocus } from '../lib/editorNavigation';

/** A standalone display equation with an optional caption. KaTeX can't wrap math,
 *  so a too-wide formula is scaled down to the column rather than running off the
 *  edge — re-fit after every render (covers tex edits and column-width changes). */
function DisplayEquation({ tex, caption, align }: { tex: string; caption: string; align?: 'left' | 'center' | 'right' }) {
  const texRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (texRef.current) fitEquation(texRef.current);
  });
  return (
    <figure className="flow-eq">
      <span ref={texRef} className="flow-eq-tex" dangerouslySetInnerHTML={{ __html: renderTex(tex, true) }} />
      {caption.trim() && (
        <figcaption style={{ textAlign: align ?? 'center' }}>{renderRuns(caption)}</figcaption>
      )}
    </figure>
  );
}

/** Turn a paragraph string with **bold** / *italic* / __underline__ markers and
 *  `$…$` math into styled inline nodes. React escapes the text; KaTeX HTML is
 *  trusted output rendered with throwOnError:false. */
function renderRuns(text: string): ReactNode {
  return parseRuns(text).map((r, j) => {
    if (r.math)
      return <span key={j} className="tex" dangerouslySetInnerHTML={{ __html: renderTex(r.text) }} />;
    let node: ReactNode = r.text;
    if (r.b) node = <strong>{node}</strong>;
    if (r.i) node = <em>{node}</em>;
    if (r.u) node = <u>{node}</u>;
    return <Fragment key={j}>{node}</Fragment>;
  });
}

/** Synthetic flow item id: the highlights block when placed below the article.
 *  It rides the atomic full-width figure machinery so paginate() is untouched. */
export const HIGHLIGHTS_BLOCK_ID = '__highlights__';

/** Same trick for magazine-2's pull-quote + highlights: one atomic one-column
 *  item at the very end of the flow, so it always closes the last column. */
export const MAG2_ASIDE_ID = '__mag2_aside__';

type TextPiece = Extract<Piece, { kind: 'text' }>;
type FigurePiece = Extract<Piece, { kind: 'figure' }>;
type ColumnPiece = TextPiece | FigurePiece;

/** Extend a boundary figure's image to the physical sheet edge while keeping
 * its pagination footprint unchanged. The preview may be CSS-scaled, so all
 * distances are converted back to unscaled page pixels before being applied. */
function usePageEdgeBleed(
  containerRef: RefObject<HTMLElement | null>,
  figureRef: RefObject<HTMLElement | null>,
  imageRef: RefObject<HTMLImageElement | null>,
  top: boolean,
  bottom: boolean,
) {
  useLayoutEffect(() => {
    const container = containerRef.current;
    const figure = figureRef.current;
    const img = imageRef.current;
    if (!container || !figure || !img) return;

    const reset = () => {
      container.style.removeProperty('--edge-top');
      container.style.removeProperty('--edge-bottom');
      img.style.removeProperty('height');
    };
    reset();
    if (!top && !bottom) return reset;

    let frame = 0;
    const measure = () => {
      reset();
      const page = container.closest<HTMLElement>('.page');
      if (!page || !page.offsetWidth) return;
      const pageRect = page.getBoundingClientRect();
      const figureRect = figure.getBoundingClientRect();
      const imageRect = img.getBoundingClientRect();
      const scale = pageRect.width / page.offsetWidth || 1;
      const topExtra = top ? Math.max(0, (figureRect.top - pageRect.top) / scale) : 0;
      // Measure from the IMAGE'S bottom. In a partial wrap row, neighbouring
      // copy can make the grid track taller than the image and CSS stretches
      // the <figure> box to that track; measuring the figure there would stop
      // short by exactly that stretch. The requested boundary is the picture
      // boundary, so grow its pixels by their own remaining distance to trim.
      const bottomExtra = bottom ? Math.max(0, (pageRect.bottom - imageRect.bottom) / scale) : 0;
      if (topExtra) container.style.setProperty('--edge-top', `${topExtra}px`);
      if (bottomExtra) container.style.setProperty('--edge-bottom', `${bottomExtra}px`);
      if (topExtra || bottomExtra) {
        img.style.height = `${imageRect.height / scale + topExtra + bottomExtra}px`;
      }
    };

    frame = requestAnimationFrame(measure);
    img.addEventListener('load', measure);
    return () => {
      cancelAnimationFrame(frame);
      img.removeEventListener('load', measure);
      reset();
    };
  // Deliberately re-measure after every React commit. Pagination can move
  // neighbouring copy after the figure itself has mounted while keeping the
  // same keyed component alive; a dependency-only effect then preserves a
  // stale bottom distance and lets the image overshoot the trim. This effect
  // changes DOM styles only (no React state), so running per commit is cheap
  // and makes the final settled pagination authoritative.
  });
}

function FlowFigure({
  className,
  style,
  src,
  caption,
  align,
  topBleed,
  bottomBleed,
}: {
  className: string;
  style?: CSSProperties;
  src: string;
  caption: string;
  align?: 'left' | 'center' | 'right';
  topBleed: boolean;
  bottomBleed: boolean;
}) {
  const figureRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  usePageEdgeBleed(figureRef, figureRef, imageRef, topBleed, bottomBleed);
  return (
    <figure ref={figureRef} className={className} style={style}>
      <img ref={imageRef} src={src} alt="" />
      {caption.trim() && <figcaption style={{ textAlign: align ?? 'left' }}>{renderRuns(caption)}</figcaption>}
    </figure>
  );
}

function WrapRow({
  piece,
  doc,
  topBleed,
  bottomBleed,
  opener,
}: {
  piece: Extract<Piece, { kind: 'wrap-row' }>;
  doc: Doc;
  topBleed: boolean;
  bottomBleed: boolean;
  opener: boolean;
}) {
  const block = doc.blocks.find((b) => b.id === piece.figureId);
  const asset = block?.type === 'figure' ? doc.assets[block.assetId] : null;
  const rowRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  usePageEdgeBleed(rowRef, figureRef, imageRef, topBleed, bottomBleed);
  if (!block || block.type !== 'figure' || !asset) return null;

  const bleed = block.bleed === true || block.span === 'bleed';
  const start =
    piece.side === 'left'
      ? 0
      : piece.side === 'right'
        ? piece.fcols - piece.nFig
        : Math.floor((piece.fcols - piece.nFig) / 2);
  const rowStyle = { '--n-fig': piece.nFig, '--fcols': piece.fcols } as CSSProperties;
  const figureStyle = { gridColumn: `${start + 1} / span ${piece.nFig}`, gridRow: 1 } as CSSProperties;
  const horizontalBleed =
    bleed && piece.side !== 'center' ? ` flow-wraprow-fig--bleed-${piece.side}` : '';
  const verticalBleed = `${topBleed ? ' flow-wraprow--bleed-top' : ''}${bottomBleed ? ' flow-wraprow--bleed-bottom' : ''}`;

  return (
    <div
      ref={rowRef}
      className={`flow-wraprow flow-wraprow--${piece.side}${verticalBleed}`}
      style={rowStyle}
      data-wrap-height={piece.wrapHeight}
    >
      <figure ref={figureRef} className={`flow-fig flow-wraprow-fig${horizontalBleed}`} style={figureStyle}>
        <img ref={imageRef} src={asset.src} alt="" />
        {block.caption.trim() && (
          <figcaption style={{ textAlign: block.align ?? 'left' }}>{renderRuns(block.caption)}</figcaption>
        )}
      </figure>
      {piece.sideColumns.map((column, ci) => (
        <div
          className="flow-wraprow-sidecol"
          style={{ gridColumn: column.column + 1, gridRow: 1 }}
          key={column.column}
        >
          {column.pieces.map((tp, j) => (
            <TextP
              pc={{ ...tp, colBreak: undefined }}
              opener={opener && ci === 0 && j === 0}
              key={j}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Shared with the plain-text branch below and with the free-column text
 *  inside a 'wrap-row'. Tri-state indent + colBreak mirror paint()'s and
 *  columnFill.ts's own logic exactly, so the measured and rendered wraps
 *  match. */
function TextP({ pc, opener = false }: { pc: TextPiece; opener?: boolean }) {
  const classes = [
    opener ? 'flow-opener' : '',
    pc.cont ? 'cont' : pc.indent === true ? 'indent-on' : pc.indent === false ? 'indent-off' : '',
  ].filter(Boolean);
  const cls = classes.length ? classes.join(' ') : undefined;
  const style = (pc.colBreak
    ? { breakBefore: 'column', WebkitColumnBreakBefore: 'always' }
    : {}) as CSSProperties;
  if (pc.fontSize !== undefined) style.fontSize = `${pc.fontSize}pt`;
  if (pc.color) style.color = pc.color;
  return (
    <p
      className={`${cls ?? ''}${pc.sourceId ? `${cls ? ' ' : ''}flow-source-paragraph` : ''}` || undefined}
      data-source-block-id={pc.sourceId}
      title={pc.sourceId ? 'Click to edit this paragraph' : undefined}
      onClick={pc.sourceId ? () => requestBlockEditorFocus(pc.sourceId!) : undefined}
      style={Object.keys(style).length ? style : undefined}
      dangerouslySetInnerHTML={{ __html: runsToHtml(pc.text, opener) }}
    />
  );
}

/**
 * columnFill.ts has already split a text-only page into exact, sequential
 * columns. Rendering those groups as explicit grid tracks avoids sending the
 * answer back through Chromium's multi-column fragmentation engine, which can
 * reinterpret `break-before: column` and leave a large hole in a middle
 * column. The groups remain in reading order; inherited `direction` places
 * them left-to-right or right-to-left to match the article setting.
 */
function InlineColumnFigure({ piece, doc }: { piece: FigurePiece; doc: Doc }) {
  const block = doc.blocks.find((candidate) => candidate.id === piece.id);
  if (!block || block.type !== 'figure' || block.span !== 1) return null;
  const asset = doc.assets[block.assetId];
  if (!asset) return null;
  const wrap = block.wrap && block.wrap !== 'none' ? block.wrap : null;
  const side = block.pos === 'right' ? 'right' : 'left';
  const className = wrap
    ? `flow-fig flow-fig--col flow-fig--wrap flow-fig--wrap-${side}`
    : 'flow-fig flow-fig--col';
  const style = wrap === 'tight' ? ({ shapeOutside: `url(${asset.src})` } as CSSProperties) : undefined;
  return (
    <FlowFigure
      className={className}
      style={style}
      src={asset.src}
      caption={block.caption}
      align={block.align}
      topBleed={false}
      bottomBleed={false}
    />
  );
}

/** Finish every non-final reading-order column on the same visual baseline.
 * Line height is an invariant: this pass may vary only the whitespace between
 * adjacent paragraphs. The last logical column is exempt only when this grid
 * really contains the end of the article; the last column of an earlier page
 * must align with its neighbours too. */
function useEvenColumnBaselines(
  gridRef: RefObject<HTMLDivElement | null>,
  allowShortLastColumn: boolean,
  layoutPieces: readonly ColumnPiece[],
) {
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let frame = 0;

    const align = () => {
      const columns = Array.from(grid.querySelectorAll<HTMLElement>(':scope > .flow-textgrid-col'));
      for (const column of columns) {
        column.removeAttribute('data-baseline-adjust');
        for (const child of Array.from(column.children)) {
          if (!(child instanceof HTMLElement)) continue;
          child.style.removeProperty('position');
          child.style.removeProperty('top');
        }
        for (const paragraph of column.querySelectorAll<HTMLElement>(':scope > p')) {
          paragraph.style.removeProperty('margin-bottom');
          paragraph.style.removeProperty('line-height');
        }
      }
      if (columns.length < 2) return;

      // Empty image-covered/trailing tracks have no baseline to align. Every
      // column that does contain copy participates, including the final one;
      // a genuinely short final column is protected by the small-adjustment
      // limits below rather than being categorically exempted.
      const adjustable = columns.filter((column) =>
        Array.from(column.querySelectorAll(':scope > p')).some((p) => Boolean(p.textContent?.trim())),
      );
      const lastChildBottom = (column: HTMLElement) => {
        const child = column.lastElementChild;
        return child instanceof HTMLElement ? child.getBoundingClientRect().bottom : null;
      };
      const bottoms = adjustable
        .map(lastChildBottom)
        .filter((bottom): bottom is number => bottom !== null);
      if (bottoms.length < 2) return;
      const target = Math.max(...bottoms);

      const renderedScale = grid.offsetWidth
        ? grid.getBoundingClientRect().width / grid.offsetWidth
        : 1;
      const scale = renderedScale || 1;

      for (const column of adjustable) {
        const naturalBottom = lastChildBottom(column);
        if (naturalBottom === null) continue;
        const delta = target - naturalBottom;
        if (delta <= 0.1) continue;

        const children = Array.from(column.children).filter(
          (child): child is HTMLElement => child instanceof HTMLElement,
        );
        const paragraphGaps: HTMLElement[] = [];
        for (let i = 0; i < children.length - 1; i++) {
          if (children[i].tagName === 'P' && children[i + 1].tagName === 'P') {
            paragraphGaps.push(children[i]);
          }
        }
        const unscaledDelta = delta / scale;
        const gapAdd = paragraphGaps.length ? unscaledDelta / paragraphGaps.length : Infinity;
        let lineTargets: HTMLElement[] = [];
        let lineCount = 0;
        let shiftedBelowImage = false;
        if (gapAdd <= 24) {
          for (const paragraph of paragraphGaps) {
            const base = parseFloat(getComputedStyle(paragraph).marginBottom) || 0;
            paragraph.style.marginBottom = `${base + gapAdd}px`;
          }
        } else {
          // A column made from one long paragraph has no inter-paragraph gaps
          // to tune. Spread a sub-pixel correction over its real line boxes;
          // this preserves wrapping and is visually imperceptible while making
          // the final baseline exact. Refuse large leading changes on a truly
          // short final column—those should remain honestly short.
          lineTargets = Array.from(column.querySelectorAll<HTMLElement>(':scope > p')).filter(
            (paragraph) => Boolean(paragraph.textContent?.trim()),
          );
          const shape = column.querySelector<HTMLElement>(':scope > .flow-column-shape');
          const exclusionBottom = Number(shape?.dataset.exclusionBottom);
          const columnTop = column.getBoundingClientRect().top;
          const firstTextTop = lineTargets[0]?.getBoundingClientRect().top;
          // If all copy in this track begins below the image, moving that copy
          // as one unit is the cleanest correction: leading remains unchanged,
          // no line can enter the image shape, and the bottom becomes exact.
          if (
            shape &&
            Number.isFinite(exclusionBottom) &&
            firstTextTop !== undefined &&
            (firstTextTop - columnTop) / scale >= exclusionBottom - 0.5
          ) {
            for (const paragraph of lineTargets) {
              paragraph.style.position = 'relative';
              paragraph.style.top = `${unscaledDelta}px`;
            }
            shiftedBelowImage = true;
          }
          if (shiftedBelowImage) {
            column.dataset.baselineAdjust = delta.toFixed(2);
          } else {
          lineCount = lineTargets.reduce((total, paragraph) => {
            const range = document.createRange();
            range.selectNodeContents(paragraph);
            const tops = new Set(
              Array.from(range.getClientRects()).map((rect) => Math.round(rect.top * 10) / 10),
            );
            return total + Math.max(1, tops.size);
          }, 0);
          const lineAdd = lineCount ? unscaledDelta / lineCount : Infinity;
          if (lineAdd > 2.5) {
            column.dataset.baselineAdjust = allowShortLastColumn
              ? 'short-final-column'
              : 'pagination-required';
            continue;
          }
          for (const paragraph of lineTargets) {
            const base = parseFloat(getComputedStyle(paragraph).lineHeight) || 0;
            paragraph.style.lineHeight = `${base + lineAdd}px`;
          }
          }
        }

        // Chromium quantizes layout to 1/64 px. Feed the tiny residual back
        // into the same paragraph gaps until their final baselines coincide.
        for (let pass = 0; pass < 8; pass++) {
          const correctedBottom = lastChildBottom(column) ?? target;
          const correction = target - correctedBottom;
          if (Math.abs(correction) <= 0.02) break;
          if (gapAdd <= 24 && paragraphGaps.length) {
            for (const paragraph of paragraphGaps) {
              const current = parseFloat(getComputedStyle(paragraph).marginBottom) || 0;
              paragraph.style.marginBottom = `${Math.max(
                0,
                current + correction / scale / paragraphGaps.length,
              )}px`;
            }
          } else if (shiftedBelowImage && lineTargets.length) {
            for (const paragraph of lineTargets) {
              const current = parseFloat(paragraph.style.top) || 0;
              paragraph.style.top = `${current + correction / scale}px`;
            }
          } else if (lineTargets.length && lineCount) {
            for (const paragraph of lineTargets) {
              const current = parseFloat(getComputedStyle(paragraph).lineHeight) || 0;
              paragraph.style.lineHeight = `${Math.max(
                1,
                current + correction / scale / lineCount,
              )}px`;
            }
          }
        }
        // Shape transitions can make line-height response slightly discrete:
        // a line may jump from above an image to below it. Use the reserved
        // 4px wrap gutter for a final sub-gutter correction on the last text
        // block, which makes the visible baseline exact without touching a
        // glyph or allowing it into the image rectangle.
        const finalBottom = lastChildBottom(column) ?? target;
        const finalResidual = target - finalBottom;
        if (Math.abs(finalResidual) > 0.02 && Math.abs(finalResidual / scale) <= 4) {
          const lastText = Array.from(column.querySelectorAll<HTMLElement>(':scope > p'))
            .filter((paragraph) => Boolean(paragraph.textContent?.trim()))
            .at(-1);
          if (lastText) {
            const currentTop = parseFloat(lastText.style.top) || 0;
            lastText.style.position = 'relative';
            lastText.style.top = `${currentTop + finalResidual / scale}px`;
          }
        }
        column.dataset.baselineAdjust = delta.toFixed(2);
      }
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(align);
    };
    align();
    grid.addEventListener('load', schedule, true);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(grid);
    return () => {
      cancelAnimationFrame(frame);
      grid.removeEventListener('load', schedule, true);
      observer?.disconnect();
    };
  }, [allowShortLastColumn, gridRef, layoutPieces]);
}

function ExplicitFlowColumns({
  pieces,
  doc,
  allowShortLastColumn,
}: {
  pieces: ColumnPiece[];
  doc: Doc;
  allowShortLastColumn: boolean;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  useEvenColumnBaselines(gridRef, allowShortLastColumn, pieces);
  const columns: ColumnPiece[][] = [];
  for (const piece of pieces) {
    if (piece.colBreak && columns.length) columns.push([]);
    if (!columns.length) columns.push([]);
    columns[columns.length - 1].push({ ...piece, colBreak: undefined });
  }
  return (
    <div ref={gridRef} className="flow-textgrid" style={{ '--flow-text-cols': columns.length } as CSSProperties}>
      {columns.map((column, ci) => {
        const exclusions = column[0]?.kind === 'text' ? column[0].exclusions : undefined;
        return (
          <div className="flow-textgrid-col" key={ci}>
            {exclusions?.length ? <ColumnImageShape exclusions={exclusions} /> : null}
            {column.map((piece, pi) =>
              piece.kind === 'text' ? (
                <TextP pc={piece} opener={ci === 0 && pi === 0} key={pi} />
              ) : (
                <InlineColumnFigure piece={piece} doc={doc} key={pi} />
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Transparent full-column float whose CSS Shape reserves exactly the vertical
 * bands occupied by page images. Transparent parts remain available to text. */
function ColumnImageShape({ exclusions }: { exclusions: ColumnExclusion[] }) {
  const merged = mergeExclusions(exclusions);
  return (
    <span
      className="flow-column-shape"
      aria-hidden="true"
      data-exclusion-bottom={Math.max(...merged.map((band) => band.bottom))}
      style={{
        shapeOutside: exclusionGradient(merged),
        shapeImageThreshold: 0.5,
      }}
    />
  );
}

function ImageColumnsFlow({ piece }: { piece: Extract<Piece, { kind: 'image-columns' }> }) {
  let opened = false;
  const columnCount = Math.max(1, piece.columns.length);
  const segments = piece.columns
    .flatMap((column, columnIndex) =>
      column.segments.map((segment) => ({ ...segment, columnIndex })),
    )
    .sort((a, b) => a.order - b.order);
  return (
    <div
      className="flow-image-grid"
      style={{
        '--flow-image-cols': piece.columns.length,
        height: `${piece.height}px`,
      } as CSSProperties}
    >
      {segments.map((segment) => {
        const widthPercent = 100 / columnCount;
        const gapShare = (columnCount - 1) / columnCount;
        const startPercent = segment.columnIndex * widthPercent;
        const startGapShare = segment.columnIndex / columnCount;
        return (
          <div
            className="flow-image-segment"
            style={{
              top: `${segment.top}px`,
              height: `${segment.bottom - segment.top}px`,
              width: `calc(${widthPercent}% - var(--gutter) * ${gapShare})`,
              insetInlineStart: `calc(${startPercent}% + var(--gutter) * ${startGapShare})`,
            }}
            key={`${segment.columnIndex}-${segment.order}`}
          >
            {segment.pieces.map((textPiece, pieceIndex) => {
              const opener = !opened;
              opened = true;
              return <TextP pc={textPiece} opener={opener} key={pieceIndex} />;
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Renders a page's pieces into the column flow: paragraphs and full-width
 *  figures. Figures resolve their image/caption from the doc by id.
 *  `allowTopBleed`/`allowBottomBleed`: whether THIS page's top/bottom edge is
 *  free for a bled figure to reach — the page shell (ContPage, Page1, etc.)
 *  decides that, not Flow itself, since it's the shell that knows whether a
 *  header/hero already owns the top (page 1 always does; a continuation page
 *  never does) or something else owns the bottom (nothing currently does, but
 *  a future footer would). Both default false so every existing caller keeps
 *  today's look until it opts in. */
export function Flow({
  pieces,
  doc,
  allowTopBleed = false,
  allowBottomBleed = false,
  allowShortLastColumn = false,
}: {
  pieces: Piece[];
  doc: Doc;
  allowTopBleed?: boolean;
  allowBottomBleed?: boolean;
  /** True only for the region containing the article's actual final column. */
  allowShortLastColumn?: boolean;
}) {
  if (pieces.length === 1 && pieces[0].kind === 'image-columns') {
    return <ImageColumnsFlow piece={pieces[0]} />;
  }
  // 'page1-flow' rides the same end-of-flow atom as 'below', but renders it as a
  // one-column box (.hl-col) instead of the full-width band (.hl-below).
  const hlClass = doc.design.highlightsPlacement === 'page1-flow' ? 'hl-col' : 'hl-below';
  const explicitCompatible = pieces.every(
    (piece): piece is ColumnPiece =>
      piece.kind === 'text' ||
      (piece.kind === 'figure' &&
        doc.blocks.some((block) => block.id === piece.id && block.type === 'figure' && block.span === 1)),
  );
  if (explicitCompatible && pieces.some((piece) => piece.colBreak !== undefined)) {
    return (
      <ExplicitFlowColumns
        pieces={pieces}
        doc={doc}
        allowShortLastColumn={allowShortLastColumn}
      />
    );
  }

  // A mixed text/art page needs each text band to finish on a common baseline
  // before the following image begins. Leaving these paragraphs directly in
  // the outer fixed-height multicolumn box lets Chromium fragment each track
  // differently, producing the ragged white wedges called out in annotation 4.
  // An auto-height balanced inner band gives every template the same magazine
  // baseline while the surrounding figure remains a full-width flow atom.
  type RenderPiece = Piece | { kind: 'balanced-text'; pieces: TextPiece[] };
  const renderPieces: RenderPiece[] = [];
  // A single-column figure intentionally participates in the outer column
  // flow. Wrapping its neighbouring text in full-width bands would isolate
  // that figure in one track and recreate a blank-track bug. Balance bands
  // only when every figure-like atom on this page is genuinely spanning.
  const hasInlineFigure = pieces.some((piece) => {
    if (piece.kind !== 'figure') return false;
    if (piece.id === MAG2_ASIDE_ID) return true;
    const block = doc.blocks.find((candidate) => candidate.id === piece.id);
    return block?.type === 'figure' && block.span === 1;
  });
  const mixed = !hasInlineFigure && pieces.some((piece) => piece.kind !== 'text');
  if (mixed) {
    for (const piece of pieces) {
      const last = renderPieces[renderPieces.length - 1];
      if (piece.kind === 'text' && last?.kind === 'balanced-text') last.pieces.push(piece);
      else if (piece.kind === 'text') renderPieces.push({ kind: 'balanced-text', pieces: [piece] });
      else renderPieces.push(piece);
    }
  } else {
    renderPieces.push(...pieces);
  }

  return (
    <>
      {renderPieces.map((pc, i) => {
        if (pc.kind === 'balanced-text') {
          return (
            <div className="flow-balanced-row" key={i}>
              {pc.pieces.map((piece, pi) => (
                <TextP pc={piece} opener={i === 0 && pi === 0} key={pi} />
              ))}
            </div>
          );
        }
        if (pc.kind === 'equation') {
          const block = doc.blocks.find((b) => b.id === pc.id);
          if (!block || block.type !== 'equation') return null;
          return <DisplayEquation key={i} tex={block.tex} caption={block.caption} align={block.align} />;
        }
        if (pc.kind === 'figure') {
          if (pc.id === MAG2_ASIDE_ID) return <MagSplitAside doc={doc} key={i} />;
          if (pc.id === HIGHLIGHTS_BLOCK_ID) {
            // magazine-1's band is highlights-only — no references.
            return (
              <aside className={hlClass} data-image-avoiding-callout key={i}>
                <span className="sidebar-image-shape" aria-hidden="true" />
                <HighlightsBody doc={doc} hideRefs={doc.templateId === 'magazine-1'} />
              </aside>
            );
          }
          const block = doc.blocks.find((b) => b.id === pc.id);
          if (!block || block.type !== 'figure') return null;
          const asset = doc.assets[block.assetId];
          if (!asset) return null;
          // Legacy `span: 'bleed'` files never set the new `bleed` field, so
          // the old value still means what it always meant: full body width,
          // bled. See paginate.ts / page.css for the same span → class logic.
          const widthBasis = block.span === 'bleed' ? 'body' : block.span;
          const bleed = block.bleed === true || block.span === 'bleed';
          const pos = block.pos ?? 'center';
          // Vertical bleed: the OTHER half of "emphasize" — a bled figure
          // that lands as the very first or very last thing on its page also
          // reaches the physical top/bottom sheet edge, not just left/right.
          // Only a spanner can (span 1 never touches the row edges either);
          // gated on `allow*Bleed` so a page whose top is already owned by a
          // header/hero (or whose bottom holds something else) never grows a
          // figure into it. The top-bled figure ends up covering the page's
          // tag-bar strip exactly the way the real hero already covers it on
          // page 1 (see page.css's .hero .tag-bar/.hero img z-index) — same
          // "bar exists underneath, a photo up front hides it" look, not a
          // relocation of the bar itself.
          const fillsBody =
            widthBasis === 'body' ||
            (typeof widthBasis === 'number' && pc.fcols !== undefined && widthBasis >= pc.fcols);
          const isSpanner = widthBasis !== 1;
          const topBleed = allowTopBleed && isSpanner && bleed && i === 0;
          const bottomBleed = allowBottomBleed && isSpanner && bleed && i === renderPieces.length - 1;
          const vBleedClass = `${topBleed ? ' flow-fig--bleed-top' : ''}${bottomBleed ? ' flow-fig--bleed-bottom' : ''}`;
          let spanClass: string;
          let figStyle: CSSProperties | undefined;
          if (widthBasis === 1) {
            const wrap = block.wrap && block.wrap !== 'none' ? block.wrap : null;
            if (wrap) {
              // Float to the `pos` side (physical, like every other author-picked
              // side in this schema — it doesn't flip under textDirection: 'rtl',
              // same as barSide/pos elsewhere). 'tight' additionally derives a
              // wrap shape from the image's own alpha channel; 'box' leaves the
              // browser's default rectangular float, i.e. no shape-outside at all.
              const side = pos === 'right' ? 'right' : 'left';
              spanClass = `flow-fig--col flow-fig--wrap flow-fig--wrap-${side}`;
              if (wrap === 'tight') figStyle = { shapeOutside: `url(${asset.src})` };
            } else {
              spanClass = 'flow-fig--col';
            }
          } else if (fillsBody) {
            spanClass = `flow-fig--full${bleed ? ' flow-fig--bleed' : ''}`;
          } else {
            const bleedOn = bleed && pos !== 'center';
            spanClass = `flow-fig--n flow-fig--pos-${pos}${bleedOn ? ' flow-fig--bleed' : ''}`;
            figStyle = { '--n': widthBasis } as CSSProperties;
          }
          return (
            <FlowFigure
              className={`flow-fig ${spanClass}${vBleedClass}`}
              style={figStyle}
              src={asset.src}
              caption={block.caption}
              align={block.align}
              topBleed={topBleed}
              bottomBleed={bottomBleed}
              key={i}
            />
          );
        }
        if (pc.kind === 'wrap-row') {
          const block = doc.blocks.find((b) => b.id === pc.figureId);
          if (!block || block.type !== 'figure') return null;
          const asset = doc.assets[block.assetId];
          if (!asset) return null;
          const bleed = block.bleed === true || block.span === 'bleed';
          const topBleed = allowTopBleed && bleed && i === 0;
          const bottomBleed = allowBottomBleed && bleed && i === renderPieces.length - 1;
          return (
            <WrapRow
              piece={pc}
              doc={doc}
              topBleed={topBleed}
              bottomBleed={bottomBleed}
              opener={i === 0}
              key={i}
            />
          );
        }
        if (pc.kind === 'image-columns') return <ImageColumnsFlow piece={pc} key={i} />;
        return <TextP pc={pc} opener={i === 0} key={i} />;
      })}
    </>
  );
}
