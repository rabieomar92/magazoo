import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { makeFrontMatter } from '../store/frontMatter';
import { FrontMatterPages } from './FrontMatterPages';

describe('editorial board page', () => {
  it('keeps its measuring copy out of the real page collection', () => {
    const doc = makeFrontMatter('frontmatter-board');
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
      <FrontMatterPages doc={doc} vars={{}} onStatus={() => undefined} />,
    );

    expect(host.querySelectorAll('.page')).toHaveLength(1);
    expect(host.querySelectorAll('.fm-measure-page')).toHaveLength(1);
    expect(host.querySelector('.fm-measure-page')?.classList.contains('page')).toBe(false);
    expect(host.querySelector('.fm-measure-page')?.getAttribute('data-layout-helper')).toBe('true');
  });

  it('applies an editor-selected about-copy column count', () => {
    const doc = makeFrontMatter('frontmatter-board');
    doc.design.frontMatterAboutColumns = 2;
    const html = renderToStaticMarkup(
      <FrontMatterPages doc={doc} vars={{}} onStatus={() => undefined} />,
    );
    expect(html).toContain('--fm-about-columns:2');
  });

  it('keeps the bleed hero and publication logo independent', () => {
    const doc = makeFrontMatter('frontmatter-board');
    doc.assets['board-hero'] = {
      src: 'data:image/png;base64,board-hero',
      naturalWidth: 1600,
      naturalHeight: 1000,
    };
    doc.assets['school-logo'] = {
      src: 'data:image/png;base64,school-logo',
      naturalWidth: 900,
      naturalHeight: 240,
    };
    doc.assets['article-only'] = {
      src: 'data:image/png;base64,article-only',
      naturalWidth: 1200,
      naturalHeight: 800,
    };
    doc.cover = { assetId: 'board-hero', offsetX: 0, offsetY: 0, scale: 1 };
    doc.hero = { assetId: 'article-only', offsetX: 0, offsetY: 0, scale: 1 };
    doc.frontMatter!.logo = { assetId: 'school-logo', offsetX: 0, offsetY: 0, scale: 1 };
    doc.frontMatter!.logoAfterParagraph = 1;
    doc.frontMatter!.logoWrap = 'end';
    doc.frontMatter!.about = 'First publication paragraph.\n\nSecond publication paragraph.\n\nThird publication paragraph.';
    doc.meta.categoryLabel = 'Laboratory portrait';
    doc.meta.heroCaption = 'A complete caption with normal white space.';
    doc.meta.photoCredit = 'Photo: School of Physics';

    const html = renderToStaticMarkup(
      <FrontMatterPages doc={doc} vars={{}} onStatus={() => undefined} />,
    );

    expect(html).toContain('<figure class="fm-board-hero">');
    expect(html).toContain('class="fm-banner fm-banner--bleed"');
    expect(html).toContain('class="fm-board-caption"');
    expect(html).toContain('A complete caption with normal white space.');
    expect(html).toContain('data:image/png;base64,board-hero');
    expect(html).toContain('data:image/png;base64,school-logo');
    expect(html).toContain('data-editor-target="image-logo"');
    expect(html).toContain('data-image-fit="contain"');
    expect(html).not.toContain('data:image/png;base64,article-only');
    const host = document.createElement('div');
    host.innerHTML = html;
    expect(host.querySelector('.fm-note-text .fm-board-logo')).not.toBeNull();
    expect(host.querySelector('.fm-rail > .fm-board-logo')).toBeNull();
    const flow = host.querySelector('.fm-note-text')!;
    expect(flow.children[0]?.textContent).toContain('First publication paragraph.');
    expect(flow.children[1]?.classList.contains('fm-board-logo')).toBe(true);
    expect(flow.children[1]?.classList.contains('fm-board-logo--wrap-end')).toBe(true);
    expect(flow.children[2]?.textContent).toContain('Second publication paragraph.');
    expect(html).toContain('class="tag-bar');
    expect(html).not.toContain('class="fm-header');
  });

  it('can hide its top bar while older documents keep it visible', () => {
    const doc = makeFrontMatter('frontmatter-board');
    expect(
      renderToStaticMarkup(<FrontMatterPages doc={doc} vars={{}} onStatus={() => undefined} />),
    ).toContain('class="tag-bar');

    doc.design.showTopBar = false;
    const hidden = renderToStaticMarkup(
      <FrontMatterPages doc={doc} vars={{}} onStatus={() => undefined} />,
    );
    expect(hidden).not.toContain('class="tag-bar');

    const contents = makeFrontMatter('frontmatter-contents');
    contents.design.showTopBar = false;
    expect(
      renderToStaticMarkup(<FrontMatterPages doc={contents} vars={{}} onStatus={() => undefined} />),
    ).toContain('class="tag-bar');
  });
});
