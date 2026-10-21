import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { heroCaptionText } from '../lib/heroCaption';
import { emptyDoc, type Doc, type TemplateId } from '../schema/document';
import { presetFor } from '../store/presets';
import { HeroCaption } from './HeroCaption';
import { Page1 } from './Page1';
import { PaperTwoPage } from './PaperTwo';
import { MagazineHead } from './MagazineHead';
import { MagPhotoPage } from './MagSplitCover';
import { MagazineCover } from './MagazineCover';
import { MagazineFrontCover } from './MagazineFrontCover';
import { MagGateB } from './MagGate';
import { FrontMatterPages } from './FrontMatterPages';
import { ArticlePages } from './ArticlePages';
import {wrapHeroIntoPage} from '../lib/wrappedHero';

const HERO_CAPTION = 'A carefully written image description.\nThe second line is retained.';
const COVER_CAPTION = 'A separate cover image needs its own description.';

it('keeps the independent magazine cover when its article hero is wrapped',()=>{
 const doc=captionDoc('magazine-1');
 wrapHeroIntoPage(doc,'wrapped-hero');
 const html=renderToStaticMarkup(<MagazineCover doc={doc} vars={{}}/>);
 expect(html).toContain('data:image/png;base64,cover-photo');
 expect(doc.images.at(-1)?.anchor.page).toBe(2);
});

function captionDoc(templateId: TemplateId): Doc {
  const doc = presetFor(templateId);
  doc.assets.heroPhoto = { src: 'data:image/png;base64,hero-photo', naturalWidth: 1200, naturalHeight: 800 };
  doc.assets.coverPhoto = { src: 'data:image/png;base64,cover-photo', naturalWidth: 800, naturalHeight: 1200 };
  doc.hero = { assetId: 'heroPhoto', scale: 1, offsetX: 0, offsetY: 0 };
  doc.cover = { assetId: 'coverPhoto', scale: 1, offsetX: 0, offsetY: 0 };
  doc.design.showHero = true;
  doc.meta.heroCaption = HERO_CAPTION;
  doc.meta.coverCaption = COVER_CAPTION;
  return doc;
}

function host(view: ReactElement) {
  const node = document.createElement('div');
  node.innerHTML = renderToStaticMarkup(view);
  return node;
}

function expectCaption(node: ParentNode, caption: string, target = 'meta-hero-caption') {
  const captions = [...node.querySelectorAll(`[data-editor-target="${target}"]`)];
  expect(captions.filter(element => element.textContent === caption)).toHaveLength(1);
  const selected = captions.find(element => element.textContent === caption)!;
  expect(selected.getAttribute('data-editor-tab')).toBe('images');
  return selected;
}

describe('universal hero and cover captions', () => {
  it('shares an escaped plain-text caption and selectable typography target', () => {
    const doc = emptyDoc();
    doc.meta.heroCaption = '<img src=x onerror=alert(1)> & original text';
    const before = JSON.stringify(doc);
    const node = host(<HeroCaption doc={doc} className="proof-caption" overlay />);
    const caption = expectCaption(node, doc.meta.heroCaption);
    expect(caption.tagName).toBe('P');
    expect(caption.classList.contains('hero-caption')).toBe(true);
    expect(caption.classList.contains('hero-caption--overlay')).toBe(true);
    expect(caption.classList.contains('proof-caption')).toBe(true);
    expect(caption.querySelector('img')).toBeNull();
    expect(JSON.stringify(doc)).toBe(before);
    doc.meta.heroCaption = '   \n  ';
    expect(renderToStaticMarkup(<HeroCaption doc={doc} />)).toBe('');
  });

  it('keeps a distinct cover description independent from the article hero', () => {
    const doc = captionDoc('magazine-1');
    expect(heroCaptionText(doc)).toBe(HERO_CAPTION);
    expect(heroCaptionText(doc, true)).toBe(COVER_CAPTION);
    expectCaption(host(<HeroCaption doc={doc} cover />), COVER_CAPTION, 'meta-cover-caption');
    delete doc.meta.coverCaption;
    expect(heroCaptionText(doc, true)).toBe('');
    doc.cover = { ...doc.hero };
    expect(heroCaptionText(doc, true)).toBe(HERO_CAPTION);
    doc.meta.coverCaption = '';
    expect(heroCaptionText(doc, true)).toBe('');
    expect(renderToStaticMarkup(<HeroCaption doc={doc} cover />)).toBe('');
  });

  it.each(['magazine-3', 'magazine-4'] as const)('%s preserves the legacy caption for its cover-only image', templateId => {
    const doc = captionDoc(templateId);
    delete doc.meta.coverCaption;
    expect(heroCaptionText(doc, true)).toBe(HERO_CAPTION);
  });

  it.each(['paper-1', 'paper-3'] as const)('%s shows the hero caption inside the image in top and bottom placements', templateId => {
    const doc = captionDoc(templateId);
    for (const bottom of templateId === 'paper-3' ? [false, true] : [false]) {
      doc.design.heroAtBottom = bottom;
      doc.design.heroBottomBleed = bottom;
      const node = host(<Page1 doc={doc} vars={{}} pieces={[]} />);
      const caption = expectCaption(node, HERO_CAPTION);
      expect(caption.closest('.hero')).not.toBeNull();
      expect(caption.classList.contains('hero-caption--overlay')).toBe(true);
    }
    doc.design.showHero = false;
    expect(host(<Page1 doc={doc} vars={{}} pieces={[]} />).querySelector('[data-editor-target="meta-hero-caption"]')).toBeNull();
    doc.design.showHero = true;
    doc.hero.assetId = null;
    expect(host(<Page1 doc={doc} vars={{}} pieces={[]} />).querySelector('[data-editor-target="meta-hero-caption"]')).toBeNull();
  });

  it('retains the Physics Letter caption directly below its freely sized hero', () => {
    const doc = captionDoc('paper-2');
    const node = host(<PaperTwoPage doc={doc} vars={{}} left={[]} right={[]} />);
    const caption = expectCaption(node, HERO_CAPTION);
    expect(caption.classList.contains('p2-hero-cap')).toBe(true);
    expect(caption.closest('.p2-heroblock')).not.toBeNull();
    expect(caption.previousElementSibling?.classList.contains('p2-hero')).toBe(true);
    doc.design.showHero = false;
    expect(host(<PaperTwoPage doc={doc} vars={{}} left={[]} right={[]} />).querySelector('[data-editor-target="meta-hero-caption"]')).toBeNull();
    doc.design.showHero = true;
    doc.hero.assetId = null;
    expect(host(<PaperTwoPage doc={doc} vars={{}} left={[]} right={[]} />).querySelector('[data-editor-target="meta-hero-caption"]')).toBeNull();
  });

  it('adds the magazine article hero description without replacing location or credit', () => {
    const doc = captionDoc('magazine-1');
    doc.meta.location = 'Penang laboratory';
    doc.meta.photoCredit = 'School of Physics';
    const node = host(<MagazineHead doc={doc} />);
    const caption = expectCaption(node, HERO_CAPTION);
    expect(caption.classList.contains('hero-caption--overlay')).toBe(false);
    expect(node.querySelector('[data-editor-target="meta-location"]')?.textContent).toBe('Penang laboratory');
    expect(node.querySelector('[data-editor-target="meta-photo-credit"]')?.textContent).toBe('School of Physics');
    doc.design.showHero = false;
    expect(host(<MagazineHead doc={doc} />).querySelector('[data-editor-target="meta-hero-caption"]')).toBeNull();
  });

  it('prints the Particle Feature spread caption once on the full-photo sheet', () => {
    const doc = captionDoc('magazine-2');
    const node = host(<MagPhotoPage doc={doc} vars={{}} pageIndex={1} />);
    expect(expectCaption(node, HERO_CAPTION).closest('.mag2-photo-captions')).not.toBeNull();
    doc.design.showHero = false;
    expect(host(<MagPhotoPage doc={doc} vars={{}} pageIndex={1} />).querySelector('[data-editor-target="meta-hero-caption"]')).toBeNull();
    doc.design.showHero = true;
    doc.hero.assetId = null;
    expect(host(<MagPhotoPage doc={doc} vars={{}} pageIndex={1} />).querySelector('[data-editor-target="meta-hero-caption"]')).toBeNull();
  });

  it.each(['magazine-1', 'magazine-4', 'magazine-3'] as const)('%s gives its cover the independent caption and retains its photo credit', templateId => {
    const doc = captionDoc(templateId);
    doc.meta.photoCredit = 'Cover photographer';
    const view = () => templateId === 'magazine-1'
      ? <MagazineCover doc={doc} vars={{}} />
      : templateId === 'magazine-4'
        ? <MagazineFrontCover doc={doc} vars={{}} />
        : <MagGateB doc={doc} vars={{}} />;
    const node = host(view());
    expectCaption(node, COVER_CAPTION, 'meta-cover-caption');
    expect(node.querySelector('[data-editor-target="meta-photo-credit"]')?.textContent).toContain('Cover photographer');
    expect(node.textContent).not.toContain(HERO_CAPTION);
    doc.design.showHero = false;
    expect(host(view()).querySelector('[data-editor-target="meta-cover-caption"]')).toBeNull();
  });

  it.each(['frontmatter-dean', 'frontmatter-contents'] as const)('%s exposes independent hero and cover descriptions on visible sheets', templateId => {
    const doc = captionDoc(templateId);
    const node = host(<FrontMatterPages doc={doc} vars={{}} onStatus={() => undefined} />);
    const page = node.querySelector('.page')!;
    expectCaption(page, HERO_CAPTION);
    expectCaption(page, COVER_CAPTION, 'meta-cover-caption');
  });

  it('preserves the editorial-board legacy hero caption for the bleed banner', () => {
    const doc = captionDoc('frontmatter-board');
    const node = host(<FrontMatterPages doc={doc} vars={{}} onStatus={() => undefined} />);
    const page = node.querySelector('.page')!;
    const bannerCaption = page.querySelector('.fm-board-caption')!;
    expect(bannerCaption.textContent).toContain(HERO_CAPTION);
    expect(page.querySelector('[data-editor-target="meta-hero-caption"]')?.textContent).toBe(HERO_CAPTION);
  });

  it.each(['paper-4', 'paper-5', 'paper-6', 'paper-7', 'paper-8'] as const)('%s keeps its article hero description visible', templateId => {
    const doc = captionDoc(templateId);
    const node = host(<ArticlePages doc={doc} vars={{}} onStatus={() => undefined} readOnly />);
    const page = node.querySelector('.article-page')!;
    // The five reference layouts retain their existing figure-specific caption
    // geometry; they must not regress while adding the universal counterpart.
    expect(page.querySelector('[data-editor-target="meta-hero-caption"]')?.textContent).toBe(HERO_CAPTION);
  });
});
