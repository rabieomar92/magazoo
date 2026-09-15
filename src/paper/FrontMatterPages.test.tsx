import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { makeFrontMatter } from '../store/frontMatter';
import { FrontMatterPages } from './FrontMatterPages';

describe('editorial board page', () => {
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
