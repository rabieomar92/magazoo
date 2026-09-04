import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { Doc, Block } from '../schema/document';
import { parseRuns, renderTex } from '../lib/richtext';
import { galleryFrameGeometry } from '../lib/galleryFrame';
import { TagBar } from './TagBar';

/** Inline **bold** / *italic* / __underline__ + `$…$` math → styled nodes. */
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

/** Split a tile's text on the first newline: line 1 title, the rest description. */
function titled(text: string): { title: string; desc: string } {
  const nl = text.indexOf('\n');
  if (nl === -1) return { title: text.trim(), desc: '' };
  return { title: text.slice(0, nl).trim(), desc: text.slice(nl + 1).trim() };
}

function TileText({
  text,
  className,
  style,
}: {
  text: string;
  className: string;
  style?: CSSProperties;
}) {
  const { title, desc } = titled(text);
  return (
    <div className={className} style={style}>
      {title && <p className="g-title" style={style}>{renderRuns(title)}</p>}
      {desc && <p className="g-desc" style={style}>{renderRuns(desc)}</p>}
    </div>
  );
}

function ImageCell({ doc, block, area }: { doc: Doc; block?: Block; area: string }) {
  const asset = block && block.type === 'figure' ? doc.assets[block.assetId] : undefined;
  const caption = block && block.type === 'figure' ? block.caption : '';
  const fr = block && block.type === 'figure' ? block.frame : undefined;
  const geometry = galleryFrameGeometry(fr);
  const imgStyle: CSSProperties = {
    position: 'absolute',
    width: `${geometry.width}%`,
    height: `${geometry.height}%`,
    left: `${geometry.left}%`,
    top: `${geometry.top}%`,
    objectPosition: `${geometry.objectX}% ${geometry.objectY}%`,
  };
  return (
    <figure className="g-img" style={{ gridArea: area }}>
      {asset ? <img src={asset.src} alt="" style={imgStyle} /> : <span className="g-img-empty" />}
      {caption.trim() && <figcaption><TileText text={caption} className="g-cap" /></figcaption>}
    </figure>
  );
}

/** One half of the fold image. Both sheets paint the same logical two-cell
 *  canvas. The right sheet shifts that canvas left by exactly one cell; zoom and
 *  pan are already baked into its bounded geometry, so the seam cannot diverge
 *  or reveal an empty edge. */
function FoldCell({ doc, block, area, half }: { doc: Doc; block?: Block; area: string; half: 'left' | 'right' }) {
  const asset = block && block.type === 'figure' ? doc.assets[block.assetId] : undefined;
  const caption = block && block.type === 'figure' ? block.caption : '';
  const fr = block && block.type === 'figure' ? block.frame : undefined;
  const geometry = galleryFrameGeometry(fr, 2);
  const imgStyle: CSSProperties = {
    position: 'absolute',
    top: `${geometry.top}%`,
    height: `${geometry.height}%`,
    width: `${geometry.width}%`,
    left: `${geometry.left - (half === 'right' ? 100 : 0)}%`,
    objectFit: 'cover',
    objectPosition: `${geometry.objectX}% ${geometry.objectY}%`,
  };
  return (
    <figure className={`g-img g-fold${asset ? '' : ' is-empty'}`} style={{ gridArea: area }}>
      {asset && <img src={asset.src} alt="" style={imgStyle} />}
      {/* Caption only on the left half (page 1) so it isn't printed twice. */}
      {half === 'left' && caption.trim() && (
        <figcaption><TileText text={caption} className="g-cap" /></figcaption>
      )}
    </figure>
  );
}

function CardCell({ block, area }: { block?: Block; area: string }) {
  const text = block && block.type === 'paragraph' ? block.text : '';
  const textStyle: CSSProperties | undefined =
    block && block.type === 'paragraph'
      ? {
          fontSize: block.fontSize !== undefined ? `${block.fontSize}pt` : undefined,
          color: block.color,
          textAlign: block.align,
        }
      : undefined;
  const indentClass =
    block && block.type === 'paragraph'
      ? block.indent === true
        ? ' indent-on'
        : block.indent === false
          ? ' indent-off'
          : ''
      : '';
  return (
    <div className={`g-card${indentClass}`} style={{ gridArea: area }}>
      {text.trim() && <TileText text={text} className="g-card-body" style={textStyle} />}
    </div>
  );
}

/**
 * The gallery template: two A4 pages read as an open spread. Figures fill the
 * image slots in order (fig[1] is the fold image spanning both pages); paragraphs
 * fill the text-card slots (2 on page 1, 3 on page 2).
 */
export function GalleryPage({ doc, vars }: { doc: Doc; vars: CSSProperties }) {
  if (doc.templateId === 'gallery-2') return <GalleryTwo doc={doc} vars={vars} />;
  if (doc.templateId === 'gallery-3') return <GalleryThree doc={doc} vars={vars} />;
  if (doc.templateId === 'gallery-4') return <GalleryFour doc={doc} vars={vars} />;

  const figures = doc.blocks.filter((b) => b.type === 'figure');
  const cards = doc.blocks.filter((b) => b.type === 'paragraph');

  return (
    <>
      <div className="page gallery gallery--p1" style={vars}>
        <TagBar doc={doc} pageIndex={0} fullBleed />
        <ImageCell doc={doc} block={figures[0]} area="img-1" />
        <FoldCell doc={doc} block={figures[1]} area="img-2" half="left" />
        <ImageCell doc={doc} block={figures[2]} area="img-3" />
        <CardCell block={cards[0]} area="card-1" />
        <CardCell block={cards[1]} area="card-2" />
      </div>

      <div className="page gallery gallery--p2" style={vars}>
        <TagBar doc={doc} pageIndex={1} fullBleed />
        <FoldCell doc={doc} block={figures[1]} area="img-2" half="right" />
        <ImageCell doc={doc} block={figures[3]} area="img-4" />
        <ImageCell doc={doc} block={figures[4]} area="img-5" />
        <CardCell block={cards[2]} area="card-3" />
        <CardCell block={cards[3]} area="card-4" />
        <CardCell block={cards[4]} area="card-5" />
      </div>
    </>
  );
}

/**
 * gallery-2: the fold image runs vertically down the centre of the spread —
 * fig[0]'s left half sits in page 1's right column, its right half in page 2's
 * left column (same FoldCell mechanism, same fold-edge bleed). Three tiles flank
 * it on each page with a pair of text cards. fig[1..6] fill the flanks in order.
 */
function GalleryTwo({ doc, vars }: { doc: Doc; vars: CSSProperties }) {
  const figures = doc.blocks.filter((b) => b.type === 'figure');
  const cards = doc.blocks.filter((b) => b.type === 'paragraph');

  return (
    <>
      <div className="page gallery gallery--p1 gallery2--p1" style={vars}>
        <TagBar doc={doc} pageIndex={0} fullBleed />
        <FoldCell doc={doc} block={figures[0]} area="fold" half="left" />
        <ImageCell doc={doc} block={figures[1]} area="img-1" />
        <ImageCell doc={doc} block={figures[2]} area="img-2" />
        <ImageCell doc={doc} block={figures[3]} area="img-3" />
        <CardCell block={cards[0]} area="card-1" />
        <CardCell block={cards[1]} area="card-2" />
      </div>

      <div className="page gallery gallery--p2 gallery2--p2" style={vars}>
        <TagBar doc={doc} pageIndex={1} fullBleed />
        <FoldCell doc={doc} block={figures[0]} area="fold" half="right" />
        <ImageCell doc={doc} block={figures[4]} area="img-4" />
        <ImageCell doc={doc} block={figures[5]} area="img-5" />
        <ImageCell doc={doc} block={figures[6]} area="img-6" />
        <CardCell block={cards[2]} area="card-3" />
        <CardCell block={cards[3]} area="card-4" />
      </div>
    </>
  );
}

/**
 * gallery-3: the fold image is a horizontal BAND across the middle of the spread
 * — fig[0] spans the full width of page 1 (bleeding right to the fold) and
 * continues across the full width of page 2 (bleeding left), so it reads as one
 * wide frame cut by the fold. A mosaic of tiles sits above and below the band on
 * each page, with two text cards per page. fig[1..7] fill the tiles in order.
 */
function GalleryThree({ doc, vars }: { doc: Doc; vars: CSSProperties }) {
  const figures = doc.blocks.filter((b) => b.type === 'figure');
  const cards = doc.blocks.filter((b) => b.type === 'paragraph');

  return (
    <>
      <div className="page gallery gallery--p1 gallery3--p1" style={vars}>
        <TagBar doc={doc} pageIndex={0} fullBleed />
        <ImageCell doc={doc} block={figures[1]} area="img-1" />
        <ImageCell doc={doc} block={figures[2]} area="img-2" />
        <FoldCell doc={doc} block={figures[0]} area="fold" half="left" />
        <ImageCell doc={doc} block={figures[3]} area="img-3" />
        <ImageCell doc={doc} block={figures[4]} area="img-4" />
        <CardCell block={cards[0]} area="card-1" />
        <CardCell block={cards[1]} area="card-2" />
      </div>

      <div className="page gallery gallery--p2 gallery3--p2" style={vars}>
        <TagBar doc={doc} pageIndex={1} fullBleed />
        <ImageCell doc={doc} block={figures[5]} area="img-5" />
        <ImageCell doc={doc} block={figures[6]} area="img-6" />
        <FoldCell doc={doc} block={figures[0]} area="fold" half="right" />
        <ImageCell doc={doc} block={figures[7]} area="img-7" />
        <CardCell block={cards[2]} area="card-3" />
        <CardCell block={cards[3]} area="card-4" />
      </div>
    </>
  );
}

/**
 * gallery-4: a text-forward spread with only five photos. The fold image is a
 * tall block on the inner edge of each page (right on page 1, left on page 2),
 * crossing the fold; four small tiles and six text cards carry the rest, so the
 * copy dominates. fig[0] is the fold, fig[1..4] the tiles, in order.
 */
function GalleryFour({ doc, vars }: { doc: Doc; vars: CSSProperties }) {
  const figures = doc.blocks.filter((b) => b.type === 'figure');
  const cards = doc.blocks.filter((b) => b.type === 'paragraph');

  return (
    <>
      <div className="page gallery gallery--p1 gallery4--p1" style={vars}>
        <TagBar doc={doc} pageIndex={0} fullBleed />
        <FoldCell doc={doc} block={figures[0]} area="fold" half="left" />
        <CardCell block={cards[0]} area="card-1" />
        <CardCell block={cards[1]} area="card-2" />
        <ImageCell doc={doc} block={figures[1]} area="img-1" />
        <ImageCell doc={doc} block={figures[2]} area="img-2" />
        <CardCell block={cards[2]} area="card-3" />
      </div>

      <div className="page gallery gallery--p2 gallery4--p2" style={vars}>
        <TagBar doc={doc} pageIndex={1} fullBleed />
        <FoldCell doc={doc} block={figures[0]} area="fold" half="right" />
        <CardCell block={cards[3]} area="card-4" />
        <CardCell block={cards[4]} area="card-5" />
        <ImageCell doc={doc} block={figures[3]} area="img-3" />
        <ImageCell doc={doc} block={figures[4]} area="img-4" />
        <CardCell block={cards[5]} area="card-6" />
      </div>
    </>
  );
}
