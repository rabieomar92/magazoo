import { Fragment, useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { Doc } from '../schema/document';
import type { Piece } from '../lib/paginate';
import { parseRuns, renderTex, runsToHtml } from '../lib/richtext';
import { fitEquation } from '../lib/mathfit';
import { HighlightsBody } from './Sidebar';
import { MagSplitAside } from './MagSplitHead';
import { exclusionGradient, mergeExclusions, type ColumnExclusion } from '../lib/columnFill';
import { fullColumnsForLevelling, type FullColumnMetric } from '../lib/fullColumnLevel';
import { requestBlockEditorFocus } from '../lib/editorNavigation';

/** A standalone display equation with an optional caption. KaTeX can't wrap math,
 *  so a too-wide formula is scaled down to the column rather than running off the
 *  edge — re-fit after every render (covers tex edits and column-width changes). */
function DisplayEquation({ id, tex, caption, align }: { id: string; tex: string; caption: string; align?: 'left' | 'center' | 'right' }) {
  const texRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (texRef.current) fitEquation(texRef.current);
  });
  return (
    <figure
      className="flow-eq"
      data-source-block-id={id}
      title="Click to edit this equation"
      onClick={() => requestBlockEditorFocus(id)}
    >
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
  if (!pc.cont && pc.topPadding !== undefined) style.paddingTop = `${pc.topPadding}px`;
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

type MeasuredFullColumn = FullColumnMetric & {
  column: HTMLElement;
  container: HTMLElement;
  lastParagraph: HTMLElement;
};

/**
 * Align only columns that are already full. A full column has less than one
 * complete line left before the page's writable bottom; short columns never
 * participate. Corrections are bounded by that sub-line remainder and are
 * distributed exclusively through existing paragraph-to-paragraph gaps.
 * Line-height, paragraph position, and the figure-wrap geometry are untouched.
 */
function useFullColumnParagraphLevelling(
  gridRef: RefObject<HTMLDivElement | null>,
  layoutSignal: unknown,
  mode: 'text' | 'image' = 'text',
) {
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let frame = 0;
    let disposed = false;

    const restoreOwnedGaps = () => {
      grid.querySelectorAll<HTMLElement>('[data-full-column-gap]').forEach((paragraph) => {
        const original = paragraph.dataset.fullColumnOriginalMargin ?? '';
        if (original) paragraph.style.marginBottom = original;
        else paragraph.style.removeProperty('margin-bottom');
        delete paragraph.dataset.fullColumnGap;
        delete paragraph.dataset.fullColumnOriginalMargin;
      });
    };

    const align = () => {
      if (disposed) return;
      restoreOwnedGaps();
      const host = grid.closest<HTMLElement>('[data-flow-host]');
      if (!host) return;
      const columnSelector =
        mode === 'image' ? ':scope > .flow-image-grid-col' : ':scope > .flow-textgrid-col';
      const columns = Array.from(grid.querySelectorAll<HTMLElement>(columnSelector));
      if (columns.length < 2) return;

      const renderedScale = grid.offsetWidth
        ? grid.getBoundingClientRect().width / grid.offsetWidth
        : 1;
      const scale = renderedScale || 1;
      const hostBottom = host.getBoundingClientRect().bottom;

      const measured = columns.flatMap<MeasuredFullColumn>((column) => {
        let container = column;
        let usableBottom = hostBottom;

        if (mode === 'image') {
          const segments = Array.from(
            column.querySelectorAll<HTMLElement>(':scope > .flow-image-segment'),
          );
          const finalSegment = segments.at(-1);
          if (!finalSegment) return [];
          const segmentBottom = finalSegment.getBoundingClientRect().bottom;
          // If an image owns the foot of this column, its text does not reach
          // the page bottom and therefore cannot be a full-column candidate.
          if (Math.abs(segmentBottom - grid.getBoundingClientRect().bottom) > 1 * scale) return [];
          container = finalSegment;
          usableBottom = segmentBottom;
        }

        const children = Array.from(container.children).filter(
          (child): child is HTMLElement =>
            child instanceof HTMLElement && !child.classList.contains('flow-column-shape'),
        );
        const lastContent = children.at(-1);
        if (!lastContent || lastContent.tagName !== 'P' || !lastContent.textContent?.trim()) return [];
        // Moving paragraph gaps around an inline figure would change its wrap
        // relationship. Such columns stay exactly as the figure engine placed
        // them and are never levelled here.
        if (children.some((child) => child.tagName !== 'P')) return [];

        const computed = getComputedStyle(lastContent);
        const parsedLineHeight = parseFloat(computed.lineHeight);
        const parsedFontSize = parseFloat(computed.fontSize);
        const lineHeight = Number.isFinite(parsedLineHeight)
          ? parsedLineHeight
          : Math.max(1, parsedFontSize * 1.2);
        return [
          {
            column,
            container,
            lastParagraph: lastContent,
            contentBottom: lastContent.getBoundingClientRect().bottom,
            usableBottom,
            lineHeight: lineHeight * scale,
          },
        ];
      });

      const fullColumns = fullColumnsForLevelling(measured);
      if (!fullColumns.length) return;
      const targetBottom = Math.max(...fullColumns.map((column) => column.contentBottom));

      for (const { container, lastParagraph, usableBottom } of fullColumns) {
        const naturalBottom = lastParagraph.getBoundingClientRect().bottom;
        const desiredCorrection = Math.min(
          targetBottom - naturalBottom,
          usableBottom - naturalBottom,
        );
        if (desiredCorrection <= 0.1) continue;

        const children = Array.from(container.children).filter(
          (child): child is HTMLElement => child instanceof HTMLElement,
        );
        const gaps: HTMLElement[] = [];
        for (let index = 0; index < children.length - 1; index += 1) {
          if (children[index].tagName === 'P' && children[index + 1].tagName === 'P') {
            gaps.push(children[index]);
          }
        }
        // No legal paragraph gap means no correction. Never substitute line
        // height, letter spacing, transforms, or paragraph positioning.
        if (!gaps.length) continue;

        for (const paragraph of gaps) {
          paragraph.dataset.fullColumnGap = 'true';
          paragraph.dataset.fullColumnOriginalMargin = paragraph.style.marginBottom;
        }
        for (let pass = 0; pass < 4; pass += 1) {
          const remaining = targetBottom - lastParagraph.getBoundingClientRect().bottom;
          if (Math.abs(remaining) <= 0.05) break;
          const perGap = remaining / scale / gaps.length;
          for (const paragraph of gaps) {
            const current = parseFloat(getComputedStyle(paragraph).marginBottom) || 0;
            paragraph.style.marginBottom = `${Math.max(0, current + perGap)}px`;
          }
        }
      }
    };

    const schedule = () => {
      if (disposed) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(align);
    };
    align();
    frame = requestAnimationFrame(align);
    grid.addEventListener('load', schedule, true);
    document.fonts?.addEventListener('loadingdone', schedule);
    void document.fonts?.ready.then(schedule);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      grid.removeEventListener('load', schedule, true);
      document.fonts?.removeEventListener('loadingdone', schedule);
      restoreOwnedGaps();
    };
  }, [gridRef, layoutSignal, mode]);
}

function ExplicitFlowColumns({
  pieces,
  doc,
}: {
  pieces: ColumnPiece[];
  doc: Doc;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  useFullColumnParagraphLevelling(gridRef, pieces);
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
  const gridRef = useRef<HTMLDivElement>(null);
  useFullColumnParagraphLevelling(gridRef, piece, 'image');
  let opened = false;
  return (
    <div
      ref={gridRef}
      className="flow-image-grid"
      style={{
        '--flow-image-cols': piece.columns.length,
        height: `${piece.height}px`,
      } as CSSProperties}
    >
      {piece.columns.map((column, columnIndex) => (
        <div className="flow-image-grid-col" key={columnIndex}>
          {[...column.segments]
            .sort((a, b) => a.order - b.order)
            .map((segment) => (
              <div
                className="flow-image-segment"
                style={{
                  top: `${segment.top}px`,
                  height: `${segment.bottom - segment.top}px`,
                }}
                key={`${columnIndex}-${segment.order}`}
              >
                {segment.pieces.map((textPiece, pieceIndex) => {
                  const opener = !opened;
                  opened = true;
                  return <TextP pc={textPiece} opener={opener} key={pieceIndex} />;
                })}
              </div>
            ))}
        </div>
      ))}
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
}: {
  pieces: Piece[];
  doc: Doc;
  allowTopBleed?: boolean;
  allowBottomBleed?: boolean;
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
      <ExplicitFlowColumns pieces={pieces} doc={doc} />
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
          return <DisplayEquation key={i} id={block.id} tex={block.tex} caption={block.caption} align={block.align} />;
        }
        if (pc.kind === 'figure') {
          if (pc.id === MAG2_ASIDE_ID) return <MagSplitAside doc={doc} key={i} />;
          if (pc.id === HIGHLIGHTS_BLOCK_ID) {
            // magazine-1's band is highlights-only — no references.
            return (
              <aside
                className={hlClass}
                data-image-avoiding-callout
                data-editor-tab="highlights"
                data-editor-target="highlights"
                key={i}
              >
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
        if (pc.kind === 'image-columns') {
          return <ImageColumnsFlow piece={pc} key={i} />;
        }
        return <TextP pc={pc} opener={i === 0} key={i} />;
      })}
    </>
  );
}
