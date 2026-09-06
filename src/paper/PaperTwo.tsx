import type { CSSProperties } from 'react';
import type { Doc } from '../schema/document';
import type { Piece } from '../lib/paginate';
import { paper2Grid } from '../lib/paper2';
import { Sidebar } from './Sidebar';
import { TagBar } from './TagBar';
import { Flow } from './Flow';
import { PlacedImages } from './PlacedImages';
import { FramedImage } from '../components/FramedImage';
import { PageArtwork } from '../components/PageArtwork';

interface Props {
  doc: Doc;
  vars: CSSProperties;
  /** Text for the columns beside the header. */
  left: Piece[];
  /** Text for the column under the hero. */
  right: Piece[];
}

/** paper-2's sheet 1: a full-bleed tag band, then a header/hero split across the
 *  same column grid every other page uses. Sheets 2+ stay on ContPage. */
export function PaperTwoPage({
  doc,
  vars,
  left,
  right,
}: Props) {
  const { meta, hero, design } = doc;
  const heroAsset = hero.assetId ? doc.assets[hero.assetId] : null;
  const { rail } = paper2Grid(design);

  return (
    <div className="page page--p2" style={vars}>
      <PageArtwork doc={doc} />
      <TagBar doc={doc} pageIndex={0} />

      <div className={`p2-cols${design.heroSide === 'left' ? ' p2-cols--hero-left' : ''}`}>
        <div className="p2-left">
          <header className="header p2-head">
            <p className="eyebrow" data-editor-tab="content" data-editor-target="meta-category">{meta.categoryLabel}</p>
            <h1 className="title" data-editor-tab="content" data-editor-target="meta-title">{meta.title}</h1>
            {meta.subtitle && <p className="subtitle" data-editor-tab="content" data-editor-target="meta-subtitle">{meta.subtitle}</p>}
            <p className="byline">
              <span data-editor-tab="content" data-editor-target="meta-author">{meta.author}</span>
              {meta.affiliation && <span className="affiliation" data-editor-tab="content" data-editor-target="meta-affiliation"> · {meta.affiliation}</span>}
            </p>
          </header>
          <div data-flow-host className="body-cols p2-flow-l">
            {/* The header owns this column's top; nothing owns its bottom. */}
            <Flow
              pieces={left}
              doc={doc}
              allowBottomBleed
            />
          </div>
        </div>

        <div className="p2-right">
          {design.showHero !== false && (
            <div className="p2-heroblock">
              <div className="p2-hero" data-editor-tab="images" data-editor-target="image-hero">
                {heroAsset && (
                  <FramedImage asset={heroAsset} frame={hero} />
                )}
              </div>
              {meta.heroCaption && <p className="p2-hero-cap" data-editor-tab="content" data-editor-target="meta-hero-caption">{meta.heroCaption}</p>}
            </div>
          )}
          <div className="p2-right-row">
            <div data-flow-host className={`body-cols p2-flow-r${rail ? ' body-cols--railed' : ''}`}>
              {/* The hero photo owns this column's top; nothing owns its bottom. */}
              <Flow
                pieces={right}
                doc={doc}
                allowBottomBleed
              />
            </div>
            {rail && <Sidebar doc={doc} />}
          </div>
        </div>
      </div>
      <PlacedImages doc={doc} pageIndex={0} />
    </div>
  );
}
