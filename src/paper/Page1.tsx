import type { CSSProperties } from 'react';
import type { Doc } from '../schema/document';
import type { Piece } from '../lib/paginate';
import { grid } from '../lib/geometry';
import { Sidebar } from './Sidebar';
import { Flow } from './Flow';
import { TagBar } from './TagBar';
import { PlacedImages } from './PlacedImages';
import { FramedImage } from '../components/FramedImage';
import { PageArtwork } from '../components/PageArtwork';

interface Props {
  doc: Doc;
  vars: CSSProperties;
  pieces: Piece[];
}

export function Page1({ doc, vars, pieces }: Props) {
  const { meta, hero, design } = doc;
  const heroAsset = hero.assetId ? doc.assets[hero.assetId] : null;
  const { rail } = grid(design);

  return (
    <div className="page" style={vars}>
      <PageArtwork doc={doc} />
      <div className={`hero${design.showHero === false ? ' hero--hidden' : ''}`}>
        {/* The bar always exists — it's the first paint in this box. A hero
            photo sits above it in z-order, so once a photo is set it simply
            covers the strip; with no photo the bar reads on the plain
            hero-colour backdrop. */}
        <TagBar doc={doc} pageIndex={0} />
        {design.showHero !== false && heroAsset && (
          <FramedImage asset={heroAsset} frame={hero} />
        )}
      </div>
      <header className="header">
        <p className="eyebrow">{meta.categoryLabel}</p>
        <h1 className="title">{meta.title}</h1>
        {meta.subtitle && <p className="subtitle">{meta.subtitle}</p>}
        <p className="byline">
          {meta.author}
          {meta.affiliation && <span className="affiliation"> · {meta.affiliation}</span>}
        </p>
      </header>
      <div className="body-row">
        <div data-flow-host className={`body-cols body-cols--p1${rail ? ' body-cols--railed' : ''}`}>
          {/* Top bleed stays off: the header always owns the top of page 1
              (the hero does too, when set). Nothing sits below the body row,
              so a figure that lands last on the page can still bleed down. */}
          <Flow
            pieces={pieces}
            doc={doc}
            allowBottomBleed
          />
        </div>
        {rail && <Sidebar doc={doc} />}
      </div>
      <PlacedImages doc={doc} pageIndex={0} />
    </div>
  );
}
