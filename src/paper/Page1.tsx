import type { CSSProperties } from 'react';
import type { Doc } from '../schema/document';
import type { Piece } from '../lib/paginate';
import { grid } from '../lib/geometry';
import { Sidebar } from './Sidebar';
import { Flow } from './Flow';
import { TagBar } from './TagBar';
import { PlacedImages } from './PlacedImages';

interface Props {
  doc: Doc;
  vars: CSSProperties;
  pieces: Piece[];
  allowShortLastColumn?: boolean;
}

export function Page1({ doc, vars, pieces, allowShortLastColumn = false }: Props) {
  const { meta, hero, design } = doc;
  const heroAsset = hero.assetId ? doc.assets[hero.assetId] : null;
  const { rail } = grid(design);

  return (
    <div className="page" style={vars}>
      <div className={`hero${design.showHero === false ? ' hero--hidden' : ''}`}>
        {/* The bar always exists — it's the first paint in this box. A hero
            photo sits above it in z-order, so once a photo is set it simply
            covers the strip; with no photo the bar reads on the plain
            hero-colour backdrop. */}
        <TagBar doc={doc} pageIndex={0} />
        {design.showHero !== false && heroAsset && (
          <img
            src={heroAsset.src}
            alt=""
            style={{
              objectFit: hero.scale < 1 ? 'contain' : 'cover',
              transform: `translate(${hero.offsetX}%, ${hero.offsetY}%) scale(${hero.scale})`,
            }}
          />
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
            allowShortLastColumn={allowShortLastColumn}
          />
        </div>
        {rail && <Sidebar doc={doc} />}
      </div>
      <PlacedImages doc={doc} pageIndex={0} />
    </div>
  );
}
