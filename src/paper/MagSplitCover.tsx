import type { CSSProperties } from 'react';
import type { Doc } from '../schema/document';
import type { Piece } from '../lib/paginate';
import { MAG2_STRIP, splitPhoto } from '../lib/magSplit';
import { Flow } from './Flow';
import { MagSplitHead } from './MagSplitHead';
import { MagTopBar } from './MagazineHead';
import { PlacedImages } from './PlacedImages';
import { SpreadPhotoImage } from '../components/SpreadPhotoImage';
import { PageArtwork } from '../components/PageArtwork';

const photoOf = (doc: Doc) =>
  doc.design.showHero !== false && doc.hero.assetId ? doc.assets[doc.hero.assetId] : null;
const arOf = (doc: Doc) => {
  const p = photoOf(doc);
  return p ? p.naturalWidth / p.naturalHeight : 16 / 9;
};

interface Props {
  doc: Doc;
  vars: CSSProperties;
  pieces: Piece[];
}

/** magazine-2 sheet 1: the article (band, title, columns, quote, highlights) with
 *  the left slice of the hero photo bleeding down the right edge. The rest of the
 *  photo continues on sheet 2 — see MagPhotoPage. */
export function MagSplitCover({ doc, vars, pieces }: Props) {
  const photo = photoOf(doc);
  const p = splitPhoto(arOf(doc), doc.hero);

  return (
    <div className="page mag2-page" style={vars}>
      <PageArtwork doc={doc} />
      <div className="mag2-inner">
        <MagSplitHead doc={doc} />
        {/* The pull-quote + highlights ride the flow's tail (MAG2_ASIDE_ID), so
            they close column 2 instead of being a block under both columns. */}
        <div data-flow-host className="mag2-cols mag2-cols--p1">
          <Flow
            pieces={pieces}
            doc={doc}
            allowBottomBleed
          />
        </div>
      </div>
      {photo && (
        <div className="mag2-strip" data-editor-tab="images" data-editor-target="image-hero">
          <SpreadPhotoImage asset={photo} geometry={p} />
          {doc.meta.photoCredit && <span className="mag2-strip-credit" data-editor-tab="content" data-editor-target="meta-photo-credit">PHOTO — {doc.meta.photoCredit}</span>}
        </div>
      )}
      <PlacedImages doc={doc} pageIndex={0} />
    </div>
  );
}

/** magazine-2 sheet 2: the same single photo, continued full-bleed. Its window
 *  starts exactly where sheet 1's strip stopped, so the two meet at the fold. */
export function MagPhotoPage({
  doc,
  vars,
  pageIndex,
}: {
  doc: Doc;
  vars: CSSProperties;
  pageIndex: number;
}) {
  const photo = photoOf(doc);
  const p = splitPhoto(arOf(doc), doc.hero);
  const photoGeometry = { ...p, x: p.x - MAG2_STRIP };

  return (
    <div
      className={`page mag2-photo${photo ? ' page--dedicated-bg' : ' mag2-photo--empty'}`}
      style={vars}
      data-editor-tab={photo ? 'images' : undefined}
      data-editor-target={photo ? 'image-hero' : undefined}
    >
      {photo && <SpreadPhotoImage asset={photo} geometry={photoGeometry} behind />}
      {!photo && <MagTopBar doc={doc} pageIndex={pageIndex} />}
      {doc.meta.location && <span className="mag2-photo-tag" data-editor-tab="content" data-editor-target="meta-location">{doc.meta.location}</span>}
      <PlacedImages doc={doc} pageIndex={pageIndex} />
    </div>
  );
}
