import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { presetFor } from '../store/presets';
import { cloneDocForUpdate, useDoc } from '../store/useDoc';
import { migrate } from '../schema/document';
import { MagGateA, MagGateB } from '../paper/MagGate';
import { gateTypography } from './gateTypography';
import { GateDesignSection } from '../panel/sections/GateDesignSection';

describe('Gatefold typography', () => {
  it('keeps the legacy cover defaults, including existing colour and font overrides', () => {
    const doc = presetFor('magazine-3');
    doc.design.gateTitleSize = 52;
    doc.design.subtitleColor = '#abcd12';
    doc.design.fontSubtitle = 'Arial';
    expect(gateTypography(doc.design, 'title')).toMatchObject({ fontSize: 52, lineHeight: .92 });
    expect(gateTypography(doc.design, 'subtitle')).toMatchObject({ color: '#abcd12', fontFamily: 'Arial', lineHeight: 1.45 });
  });
  it('round-trips individual text styles and isolates undo snapshots and the article', () => {
    const doc = presetFor('magazine-3');
    doc.design.gateTypography = { title: { lineHeight: 1.2, letterSpacing: 2 }, subtitle: { spaceAfter: 30, fontSize: 18 } };
    const saved = migrate(JSON.parse(JSON.stringify(doc)));
    expect(saved.design.gateTypography).toEqual(doc.design.gateTypography);
    const clone = cloneDocForUpdate(saved);
    clone.design.gateTypography!.title!.lineHeight = 1.6;
    clone.design.gateTypography!.subtitle!.spaceAfter = 8;
    expect(saved.design.gateTypography!.title!.lineHeight).toBe(1.2);
    expect(saved.design.gateTypography!.subtitle!.spaceAfter).toBe(30);
    expect(clone.blocks).toEqual(doc.blocks);
    expect(clone.design.sizes).toEqual(doc.design.sizes);
  });
  it('renders independent styles into the actual cover DOM, not only the controls', () => {
    const doc = presetFor('magazine-3');
    doc.design.gateTypography = {
      title: { fontSize: 40, fontFamily: 'Arial', lineHeight: 1.1, letterSpacing: 2, color: '#abc123' },
      subtitle: { lineHeight: 1.8, letterSpacing: .5, spaceAfter: 32, italic: false },
      quote: { fontSize: 22, lineHeight: 1.6, fontWeight: 400 },
      attribution: { fontSize: 10, letterSpacing: 1 },
      author: { fontSize: 12, color: '#fedcba' },
      photoCredit: { fontSize: 9, lineHeight: 1.5 },
    };
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<><MagGateA doc={doc} vars={{}} /><MagGateB doc={doc} vars={{}} /></>);
    const css = (selector: string) => host.querySelector<HTMLElement>(selector)!.style;
    expect(css('h1').fontSize).toBe('40pt');
    expect(css('h1').letterSpacing).toBe('2px');
    expect(css('.mag-gate-lede').lineHeight).toBe('1.8');
    expect(css('.mag-gate-lede').marginBottom).toBe('32px');
    expect(css('.mag-gate-lede').fontStyle).toBe('normal');
    expect(css('.mag-gate-quote-text').fontSize).toBe('22pt');
    expect(css('.mag-gate-quote-by').fontSize).toBe('10pt');
    expect(css('.mag-gate-author').fontSize).toBe('12pt');
    expect(css('[data-editor-target="meta-photo-credit"]').fontSize).toBe('9pt');
  });
  it('preserves Arabic shaping without discarding stored Latin tracking', () => {
    const doc = presetFor('magazine-3');
    doc.design.gateTypography = { title: { letterSpacing: 3, lineHeight: 1.5 } };
    doc.design.textDirection = 'rtl';
    doc.meta.title = 'ألوان الضوء على سطح فقاعة الصابون';
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<MagGateA doc={doc} vars={{}} />);
    expect(host.querySelector('h1')!.textContent).toBe(doc.meta.title);
    expect(host.querySelector('h1')!.style.letterSpacing).toBe('0px');
    expect(doc.design.gateTypography.title!.letterSpacing).toBe(3);
    doc.design.textDirection = 'ltr';
    expect(gateTypography(doc.design, 'title').letterSpacing).toBe(3);
  });
  it('keeps each preview destination inside its object group with no duplicate IDs', () => {
    useDoc.getState().load(presetFor('magazine-3'));
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<GateDesignSection />);
    const ids = [...host.querySelectorAll('[id]')].map(el => el.id);
    expect(ids.length).toBe(new Set(ids).size);
    for (const target of ['meta-title', 'meta-category', 'meta-subtitle', 'meta-pull-quote', 'meta-pull-quote-by', 'meta-author', 'meta-photo-credit', 'meta-masthead', 'footer-font']) {
      expect(host.querySelector(`#editor-target-${target}`)?.closest('.gate-editor-group')).not.toBeNull();
    }
    expect(host.querySelector('#editor-target-meta-title')?.textContent).toContain('Title line height');
    expect(host.querySelector('#editor-target-meta-subtitle')?.textContent).toContain('Subtitle letter spacing');
  });
});
