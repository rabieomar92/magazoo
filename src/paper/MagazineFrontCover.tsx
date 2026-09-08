import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { Block, Doc } from '../schema/document';
import { parseRuns, renderTex } from '../lib/richtext';
import {
  frontCoverTextVars,
  frontCoverTextVisible,
} from '../lib/frontCoverDesign';
import { FramedImage } from '../components/FramedImage';
import { PageArtwork } from '../components/PageArtwork';
import { requestBlockEditorFocus } from '../lib/editorNavigation';
import { clampSpacing, COVER_STORY_GAP } from '../lib/spacing';
import { useDoc } from '../store/useDoc';
import { useVerticalDrag } from './useVerticalDrag';
import { CoverTextObject } from './CoverTextObject';

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
  const update = useDoc(state => state.update);
  const storyTop = clampSpacing(coverDesign.storyTop, COVER_STORY_GAP, 15);
  // The story block carries the cover's headline copy; dragging it up or down
  // writes the same distance the panel's number field sets. Its width and side
  // stay numeric, so the block cannot drift off the cover's column.
  const storyDrag = useVerticalDrag({
    start: () => storyTop,
    clamp: value => clampSpacing(value, COVER_STORY_GAP, storyTop),
    commit: top => update(d => {
      d.design.frontCover = { ...(d.design.frontCover ?? {}), storyTop: clampSpacing(top, COVER_STORY_GAP, 15) };
    }),
  });
  const alignment = coverDesign.alignment ?? (doc.design.textDirection === 'rtl' || flip ? 'right' : 'left');
  const coverVars: Record<string, string> = {
    ...frontCoverTextVars(doc.design),
    '--front-story-top': `${storyTop}mm`,
    '--front-story-width': `${coverDesign.storyWidth ?? 88}%`,
    '--front-overlay': String(coverDesign.overlayOpacity ?? 0.68),
    '--front-kicker-bg': coverDesign.kickerBackground ?? doc.design.colors.accent,
    '--front-teaser-bg': coverDesign.teaserBackground ?? '#071006',
    '--front-teaser-bg-opacity': `${(coverDesign.teaserBackgroundOpacity ?? 0.45) * 100}%`,
    '--front-align': alignment,
    '--front-items':
      alignment === 'center' ? 'center' : alignment === 'right' ? 'flex-end' : 'flex-start',
    '--front-copy-items': alignment === 'center' ? 'center' : (alignment === 'right') === (doc.design.textDirection === 'rtl') ? 'flex-start' : 'flex-end',
  };
  const style: CSSProperties & { '--front-teaser-count': string } = {
    ...vars,
    ...coverVars,
    backgroundColor: doc.design.colors.hero,
    '--front-teaser-count': String(Math.max(1, teasers.length)),
  };

  return (
    <div
      className={`page front-cover${photo ? ' page--dedicated-bg' : ''}${
        flip ? ' front-cover--flip' : ''
      }${(doc.design.firstPageTopMargin ?? 0) > 0 ? ' page--first-offset' : ''}`}
      style={style}
      data-editor-tab={photo ? 'images' : undefined}
      data-editor-target={photo ? 'image-cover' : undefined}
    >
      <PageArtwork doc={doc} />
      {photo && <FramedImage className="front-cover-photo" asset={photo} frame={cover} />}
      <div className="front-cover-scrim" />
      <div className="front-cover-inner">
        <header className="front-cover-brand">
          <div className="front-cover-brand-copy">
            {frontCoverTextVisible(doc.design, 'masthead') && meta.masthead && (
              <CoverTextObject doc={doc} role="masthead" className="front-cover-masthead" target="meta-masthead">{meta.masthead}</CoverTextObject>
            )}
            {frontCoverTextVisible(doc.design, 'strapline') && meta.affiliation && (
              <CoverTextObject doc={doc} role="strapline" className="front-cover-strap" target="meta-affiliation">{meta.affiliation}</CoverTextObject>
            )}
          </div>
        </header>

        <main
          className={`front-cover-story front-cover-story--draggable${storyDrag.dragging ? ' is-dragging' : ''}`}
          {...storyDrag.handlers}
          title="Drag up or down to place this block"
          data-editor-tab="design"
          data-editor-target="front-cover-story-position"
        >
          {frontCoverTextVisible(doc.design, 'kicker') && meta.categoryLabel && (
            <CoverTextObject doc={doc} role="kicker" className="front-cover-kicker" target="meta-category">{meta.categoryLabel}</CoverTextObject>
          )}
          {frontCoverTextVisible(doc.design, 'title') && meta.title && <CoverTextObject doc={doc} as="h1" role="title" target="meta-title">{meta.title}</CoverTextObject>}
          {frontCoverTextVisible(doc.design, 'subtitle') && meta.subtitle && (
            <CoverTextObject doc={doc} as="p" role="subtitle" className="front-cover-lede" target="meta-subtitle">{meta.subtitle}</CoverTextObject>
          )}
          <div className="front-cover-byline">
            {frontCoverTextVisible(doc.design, 'author') && meta.author && (
              <CoverTextObject doc={doc} as="span" role="author" className="front-cover-author" target="meta-author">{meta.author}</CoverTextObject>
            )}
            {frontCoverTextVisible(doc.design, 'storyTag') && meta.location && (
              <CoverTextObject doc={doc} as="span" role="storyTag" className="front-cover-story-tag" target="meta-location">{meta.location}</CoverTextObject>
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
                    data-source-block-id={teaser.id}
                    onClick={() => requestBlockEditorFocus(teaser.id)}
                    style={{
                      ...teaserOverrides,
                      textAlign: teaser.align ?? (doc.design.textDirection === 'rtl' ? 'right' : doc.design.bodyAlign ?? 'left'),
                      paddingTop:
                        teaser.topPadding !== undefined ? `${teaser.topPadding}px` : undefined,
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
              <span className="front-cover-footer-brand" data-editor-tab="content" data-editor-target="meta-masthead">{meta.masthead}</span>
            )}
            {frontCoverTextVisible(doc.design, 'photoCredit') && meta.photoCredit && (
              <span className="front-cover-photo-credit" data-editor-tab="content" data-editor-target="meta-photo-credit">PHOTO · {meta.photoCredit}</span>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
