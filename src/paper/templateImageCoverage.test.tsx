import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { emptyDoc, type Doc } from '../schema/document';
import { TEMPLATES } from '../store/presets';
import { ContPage } from './ContPage';
import { GalleryPage } from './GalleryPage';
import { MagGateA, MagGateB } from './MagGate';
import { MagPhotoPage, MagSplitCover } from './MagSplitCover';
import { MagazineCover } from './MagazineCover';
import { MagazinePage } from './MagazinePage';
import { Page1 } from './Page1';
import { PaperTwoPage } from './PaperTwo';

function docWithPageImage(page = 1): Doc {
  const doc = emptyDoc();
  doc.assets.placed = {
    src: 'data:image/png;base64,',
    naturalWidth: 800,
    naturalHeight: 400,
  };
  doc.images.push({
    id: 'placed-image',
    assetId: 'placed',
    caption: 'Caption',
    widthCols: 2,
    anchor: { page, column: 0, y: 20 },
    frame: { scale: 1.4, offsetX: 18, offsetY: -12 },
  });
  return doc;
}

describe('placed-image template coverage', () => {
  it('renders split and gatefold photos as durable image elements, not data-URL CSS', () => {
    const split = TEMPLATES.find((template) => template.id === 'magazine-2')!.make();
    const gate = TEMPLATES.find((template) => template.id === 'magazine-3')!.make();

    const splitHtml = renderToStaticMarkup(
      <>
        <MagSplitCover doc={split} vars={{}} pieces={[]} />
        <MagPhotoPage doc={split} vars={{}} pageIndex={1} />
      </>,
    );
    const gateHtml = renderToStaticMarkup(
      <>
        <MagGateA doc={gate} vars={{}} />
        <MagGateB doc={gate} vars={{}} />
      </>,
    );

    for (const html of [splitHtml, gateHtml]) {
      expect(html).toContain('class="spread-photo-image"');
      expect(html).not.toContain('background-image:url(data:image');
    }
  });

  it('renders optional first-page artwork as an image that PDF export can await', () => {
    const doc = emptyDoc();
    doc.design.pageBackgroundAssetId = 'artwork';
    doc.assets.artwork = {
      src: 'data:image/png;base64,artwork',
      naturalWidth: 1200,
      naturalHeight: 1600,
    };

    const html = renderToStaticMarkup(<Page1 doc={doc} vars={{}} pieces={[]} />);
    expect(html).toContain('class="page-artwork"');
    expect(html).toContain('src="data:image/png;base64,artwork"');
  });

  it('starts every photo-essay top bar at the page trim by default', () => {
    const galleryTemplates = TEMPLATES.filter((template) => template.family === 'gallery');

    expect(galleryTemplates).toHaveLength(4);
    for (const template of galleryTemplates) {
      expect(template.make().design.topBarOffset).toBe(0);
    }
  });

  it('uses the exact article TagBar structure on each gallery sheet', () => {
    const doc = TEMPLATES.find((template) => template.id === 'gallery-4')!.make();
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<GalleryPage doc={doc} vars={{}} />);

    const bars = [...host.querySelectorAll('.gallery > .tag-bar')];
    expect(bars).toHaveLength(2);
    for (const bar of bars) {
      expect([...bar.children].map((child) => child.className)).toEqual([
        'tag-bar-mark',
        'tag-bar-tag',
        'tag-bar-fill',
      ]);
    }
    expect(bars[0].classList.contains('tag-bar--flip')).toBe(false);
    expect(bars[1].classList.contains('tag-bar--flip')).toBe(true);
  });

  it('uses the shared placed-image renderer on every article and editorial sheet', () => {
    const first = docWithPageImage(1);
    const second = docWithPageImage(2);
    const sheets = [
      <Page1 key="paper-1" doc={first} vars={{}} pieces={[]} />,
      <PaperTwoPage key="paper-2" doc={first} vars={{}} left={[]} right={[]} />,
      <ContPage key="continuation" doc={second} vars={{}} pieces={[]} pageIndex={1} />,
      <MagazineCover key="mag-cover" doc={first} vars={{}} />,
      <MagazinePage key="mag-page" doc={first} vars={{}} pieces={[]} lead pageIndex={0} />,
      <MagSplitCover key="mag-split" doc={first} vars={{}} pieces={[]} />,
      <MagPhotoPage key="mag-photo" doc={second} vars={{}} pageIndex={1} />,
      <MagGateA key="mag-gate-a" doc={first} vars={{}} />,
      <MagGateB key="mag-gate-b" doc={second} vars={{}} />,
    ];

    for (const sheet of sheets) {
      const html = renderToStaticMarkup(sheet);
      expect(html).toContain('class="placed-image');
      expect(html).toContain('data-frame-scale="1.4"');
    }
  });

  it('keeps photo-essay gallery sheets on their fixed-slot image system', () => {
    const doc = docWithPageImage(1);
    doc.templateId = 'gallery-1';
    expect(renderToStaticMarkup(<GalleryPage doc={doc} vars={{}} />)).not.toContain(
      'class="placed-image',
    );
  });

  it('applies paragraph typography overrides to photo-essay text cards', () => {
    const doc = emptyDoc();
    doc.templateId = 'gallery-1';
    doc.blocks = [
      {
        id: 'styled-card',
        type: 'paragraph',
        text: 'Styled title\nStyled description',
        fontSize: 14,
        color: '#123456',
        align: 'justify',
      },
    ];

    const html = renderToStaticMarkup(<GalleryPage doc={doc} vars={{}} />);
    expect(html).toContain('font-size:14pt');
    expect(html).toContain('color:#123456');
    expect(html).toContain('text-align:justify');
  });

  it('renders a freely positioned RTL highlight box on its selected article page', () => {
    const doc = emptyDoc();
    doc.design.highlightsPlacement = 'free';
    doc.design.textDirection = 'rtl';
    doc.highlights = ['نقطة رئيسية'];
    doc.highlightBox = {
      widthCols: 2,
      anchor: { page: 1, column: 1, y: 120 },
    };

    const html = renderToStaticMarkup(<Page1 doc={doc} vars={{}} pieces={[]} />);
    expect(html).toContain('class="placed-highlights"');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('نقطة رئيسية');
  });
});
