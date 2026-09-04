import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { presetFor } from '../store/presets';
import { MagazineFrontCover } from './MagazineFrontCover';

describe('MagazineFrontCover', () => {
  it('maps the existing editor fields into one fixed cover composition', () => {
    const doc = presetFor('magazine-4');
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<MagazineFrontCover doc={doc} vars={{}} />);

    expect(host.querySelectorAll('.page')).toHaveLength(1);
    expect(host.querySelector('.front-cover-masthead')?.textContent).toBe(doc.meta.masthead);
    expect(host.querySelector('.front-cover-story h1')?.textContent).toBe(doc.meta.title);
    expect(host.querySelectorAll('.front-cover-teaser')).toHaveLength(3);
    expect(host.querySelector('.front-cover-credit-row')?.textContent).toContain(
      doc.meta.photoCredit,
    );
    expect(host.querySelector('.front-cover-issue')).toBeNull();
    expect(host.querySelector('.front-cover-promo')).toBeNull();
  });

  it('applies independent styles and visibility to cover objects', () => {
    const doc = presetFor('magazine-4');
    doc.design.frontCover ??= {};
    doc.design.frontCover.text = {
      title: {
        fontFamily: 'Arial',
        fontSize: 51,
        color: '#123456',
        fontWeight: 400,
        letterSpacing: 0.02,
      },
      photoCredit: { visible: false },
    };
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<MagazineFrontCover doc={doc} vars={{}} />);

    const pageStyle = host.querySelector<HTMLElement>('.front-cover')?.style;
    expect(pageStyle?.getPropertyValue('--front-title-font')).toContain('Arial');
    expect(pageStyle?.getPropertyValue('--front-title-size')).toBe('51pt');
    expect(pageStyle?.getPropertyValue('--front-title-color')).toBe('#123456');
    expect(host.querySelector('.front-cover-credit')).toBeNull();
  });
});
