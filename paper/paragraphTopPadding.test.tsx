import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { GalleryPage } from './GalleryPage';
import { MagazineFrontCover } from './MagazineFrontCover';
import { Page1 } from './Page1';

describe('per-paragraph top-to-text spacing', () => {
  it('applies the requested pixels to an article paragraph but not its continuation', () => {
    const doc = emptyDoc();
    const html = renderToStaticMarkup(
      <Page1
        doc={doc}
        vars={{}}
        pieces={[
          { kind: 'text', sourceId: 'first', text: 'First paragraph.', topPadding: 18 },
          {
            kind: 'text',
            sourceId: 'first',
            text: 'Continuation fragment.',
            topPadding: 18,
            cont: true,
          },
        ]}
      />,
    );

    expect(html).toContain('padding-top:18px');
    expect(html.match(/padding-top:18px/g)).toHaveLength(1);
  });

  it('applies the same paragraph control to gallery cards', () => {
    const doc = emptyDoc();
    doc.templateId = 'gallery-1';
    doc.blocks = [
      {
        id: 'card',
        type: 'paragraph',
        text: 'Card title\nCard body',
        topPadding: 14,
      },
    ];

    const html = renderToStaticMarkup(<GalleryPage doc={doc} vars={{}} />);
    expect(html).toContain('class="g-card-body" style="padding-top:14px"');
  });

  it('applies the same paragraph control to front-cover teaser objects', () => {
    const doc = emptyDoc();
    doc.templateId = 'magazine-4';
    doc.blocks = [
      {
        id: 'teaser',
        type: 'paragraph',
        text: 'Teaser title\nTeaser body',
        topPadding: 22,
      },
    ];

    const html = renderToStaticMarkup(<MagazineFrontCover doc={doc} vars={{}} />);
    expect(html).toContain('padding-top:22px');
  });
});
