import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { Block, Doc } from '../schema/document';
import { parseRuns, renderTex } from '../lib/richtext';
import {
  frontCoverTextVars,
  frontCoverTextVisible,
} from '../lib/frontCoverDesign';

type Paragraph = Extract<Block, { type: 'paragraph' }>;

function renderRuns(text: string): ReactNode {
  return parseRuns(text).map((run, index) => {
    if (run.math) {
      return (
        <span
          key={index}
          className="tex"
          dangerouslySetInnerHTML={{ __html: renderTex(run.text) }}
        />
      );
    }
    let node: ReactNode = run.text;
    if (run.b) node = <strong>{node}</strong>;
    if (run.i) node = <em>{node}</em>;
    if (run.u) node = <u>{node}</u>;
    return <Fragment key={index}>{node}</Fragment>;
  });
}

function teaserParts(block: Paragraph) {
  const [heading = '', ...description] = block.text.split(/\r?\n/);
  return { heading: heading.trim(), description: description.join(' ').trim() };
}

/**
 * A dedicated, single-sheet magazine front cover. Every piece of copy maps to
 * an existing editor field: masthead/issue metadata above, title fields in the
 * middle, and the first three Content paragraphs as editable cover teasers.
 */
export function MagazineFrontCover({ doc, vars }: { doc: Doc; vars: CSSProperties }) {
  const { meta, assets } = doc;
  const cover = doc.cover ?? doc.hero;
  const photo = doc.design.showHero !== false && cover.assetId ? assets[cover.assetId] : null;
  const teasers = doc.blocks
    .filter((block): block is Paragraph => block.type === 'paragraph' && Boolean(block.text.trim()))
    .slice(0, 3);
  const flip = doc.design.barSide === 'right';
  const coverDesign = doc.design.frontCover ?? {};
  const alignment = coverDesign.alignment ?? (flip ? 'right' : 'left');
  const coverVars: Record<string, string> = {
    ...frontCoverTextVars(doc.design),
    '--front-story-top': `${coverDesign.storyTop ?? 15}mm`,
    '--front-story-width': `${coverDesign.storyWidth ?? 88}%`,
    '--front-overlay': String(coverDesign.overlayOpacity ?? 0.68),
    '--front-kicker-bg': coverDesign.kickerBackground ?? doc.design.colors.accent,
    '--front-teaser-bg': coverDesign.teaserBackground ?? '#071006',
    '--front-teaser-bg-opacity': `${(coverDesign.teaserBackgroundOpacity ?? 0.45) * 100}%`,
    '--front-align': alignment,
    '--front-items':
      alignment === 'center' ? 'center' : alignment === 'right' ? 'flex-end' : 'flex-start',
  };
  const style: CSSProperties & { '--front-teaser-count': string } = {
    ...vars,
    ...coverVars,
    ...(photo
      ? {
          backgroundImage: `url("${photo.src}")`,
          backgroundPosition: `${50 + cover.offsetX}% ${50 + cover.offsetY}%`,
          backgroundSize: cover.scale === 1 ? 'cover' : `${cover.scale * 100}%`,
          backgroundRepeat: 'no-repeat',
        }
      : { backgroundColor: doc.design.colors.hero }),
    '--front-teaser-count': String(Math.max(1, teasers.length)),
  };

  return (
    <div
      className={`page front-cover${photo ? ' page--dedicated-bg' : ''}${
        flip ? ' front-cover--flip' : ''
      }${(doc.design.firstPageTopMargin ?? 0) > 0 ? ' page--first-offset' : ''}`}
      style={style}
    >
      <div className="front-cover-scrim" />
      <div className="front-cover-inner">
        <header className="front-cover-brand">
          <div className="front-cover-brand-copy">
            {frontCoverTextVisible(doc.design, 'masthead') && meta.masthead && (
              <div className="front-cover-masthead">{meta.masthead}</div>
            )}
            {frontCoverTextVisible(doc.design, 'strapline') && meta.affiliation && (
              <div className="front-cover-strap">{meta.affiliation}</div>
            )}
          </div>
        </header>

        <main className="front-cover-story">
          {frontCoverTextVisible(doc.design, 'kicker') && meta.categoryLabel && (
            <div className="front-cover-kicker">{meta.categoryLabel}</div>
          )}
          {frontCoverTextVisible(doc.design, 'title') && meta.title && <h1>{meta.title}</h1>}
          {frontCoverTextVisible(doc.design, 'subtitle') && meta.subtitle && (
            <p className="front-cover-lede">{meta.subtitle}</p>
          )}
          <div className="front-cover-byline">
            {frontCoverTextVisible(doc.design, 'author') && meta.author && (
              <span className="front-cover-author">{meta.author}</span>
            )}
            {frontCoverTextVisible(doc.design, 'storyTag') && meta.location && (
              <span className="front-cover-story-tag">{meta.location}</span>
            )}
          </div>
        </main>

        <footer className="front-cover-footer">
          {teasers.length > 0 && (
            <div className="front-cover-teasers">
              {teasers.map((teaser) => {
                const { heading, description } = teaserParts(teaser);
                const teaserOverrides: Record<string, string> = {};
                if (teaser.fontSize) {
                  teaserOverrides['--front-card-title-size'] = `${teaser.fontSize}pt`;
                  teaserOverrides['--front-card-body-size'] = `${Math.max(5, teaser.fontSize * 0.88)}pt`;
                }
                if (teaser.color) teaserOverrides['--front-card-color'] = teaser.color;
                return (
                  <article
                    className="front-cover-teaser"
                    key={teaser.id}
                    style={{
                      ...teaserOverrides,
                      textAlign: teaser.align ?? doc.design.bodyAlign ?? 'left',
                    }}
                  >
                    {frontCoverTextVisible(doc.design, 'teaserTitle') && heading && (
                      <h2>{renderRuns(heading)}</h2>
                    )}
                    {frontCoverTextVisible(doc.design, 'teaserBody') && description && (
                      <p>{renderRuns(description)}</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          <div className="front-cover-credit-row">
            {frontCoverTextVisible(doc.design, 'footerBrand') && meta.masthead && (
              <span className="front-cover-footer-brand">{meta.masthead}</span>
            )}
            {frontCoverTextVisible(doc.design, 'photoCredit') && meta.photoCredit && (
              <span className="front-cover-photo-credit">PHOTO · {meta.photoCredit}</span>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
