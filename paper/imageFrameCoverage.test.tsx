import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { emptyDoc, type Doc, type TemplateId } from '../schema/document';
import { MagazineCover } from './MagazineCover';
import { MagazineFrontCover } from './MagazineFrontCover';
import { MagazineHead } from './MagazineHead';
import { Page1 } from './Page1';
import { PaperTwoPage } from './PaperTwo';

function framedDoc(templateId: TemplateId): Doc {
  const doc = emptyDoc();
  doc.templateId = templateId;
  doc.assets.photo = {
    src: 'data:image/png;base64,',
    naturalWidth: 700,
    naturalHeight: 1100,
  };
  doc.hero = { assetId: 'photo', scale: 1.75, offsetX: 31, offsetY: -22 };
  doc.cover = { ...doc.hero };
  return doc;
}

describe('primary image frame coverage', () => {
  it('routes every ordinary hero and cover through the bounded frame component', () => {
    const paper1 = framedDoc('paper-1');
    const paper2 = framedDoc('paper-2');
    const magazine = framedDoc('magazine-1');
    const frontCover = framedDoc('magazine-4');
    const views = [
      <Page1 key="paper-1" doc={paper1} vars={{}} pieces={[]} />,
      <PaperTwoPage key="paper-2" doc={paper2} vars={{}} left={[]} right={[]} />,
      <MagazineCover key="magazine-cover" doc={magazine} vars={{}} />,
      <MagazineHead key="magazine-head" doc={magazine} />,
      <MagazineFrontCover key="front-cover" doc={frontCover} vars={{}} />,
    ];

    for (const view of views) {
      const html = renderToStaticMarkup(view);
      expect(html).toContain('class="framed-image');
      expect(html).toContain('data-frame-scale="1.75"');
      expect(html).toContain('data-frame-x="31"');
      expect(html).toContain('data-frame-y="-22"');
    }
  });
});
