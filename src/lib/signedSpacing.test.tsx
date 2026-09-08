import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { migrate } from '../schema/document';
import { cssVars, grid } from './geometry';
import { gateSpacingBleed, gateTypography } from './gateTypography';
import { gatePlacement } from './gatePlacement';
import { footerBottomOffset } from './pageFooter';
import { MagGateA, MagGateB } from '../paper/MagGate';
import { MagazineFrontCover } from '../paper/MagazineFrontCover';
import { DesignSection } from '../panel/sections/DesignSection';
import { presetFor } from '../store/presets';
import { useDoc } from '../store/useDoc';

describe('signed optical spacing', () => {
  it('preserves negative subtitle margins in the shared preview/print variables and saved files', () => {
    for (const template of ['paper-1', 'paper-2', 'paper-3', 'magazine-1', 'magazine-2', 'magazine-3', 'magazine-4'] as const) {
      const doc = presetFor(template);
      const originalGrid = grid(doc.design);
      doc.design.subtitleGap = -3.5;
      const saved = migrate(JSON.parse(JSON.stringify(doc)));
      expect(cssVars(saved.design, template)['--subtitle-gap']).toBe('-3.5mm');
      for (const [key, value] of Object.entries(originalGrid)) {
        if (typeof value === 'number') expect(grid(saved.design)[key as keyof typeof originalGrid]).toBe(value);
      }
    }
  });
  it('exposes signed gaps while physical measurements retain safe positive limits', () => {
    for (const template of ['paper-1', 'magazine-3', 'magazine-4'] as const) {
      const host = document.createElement('div');
      const root = createRoot(host);
      act(() => { useDoc.getState().load(presetFor(template)); root.render(<DesignSection />); });
      const labeled = (label: string) => [...host.querySelectorAll('label')].find(e => {
        const fieldLabel = e.querySelector('.field-label');
        return fieldLabel && [...fieldLabel.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim() === label;
      })?.querySelector('input');
      const gap = labeled(template === 'magazine-3' ? 'Space above subtitle' : 'Title to subtitle gap');
      expect(gap?.min).toBe('-40');
      expect(labeled(template === 'magazine-3' ? 'Title size' : template === 'magazine-4' ? 'Size' : 'Title')?.min).not.toBe('-40');
      if (template === 'magazine-3') {
        expect(labeled('Space after subtitle')?.min).toBe('-100');
        expect(labeled('Text block width')?.min).toBe('50');
        expect(labeled('Title line height')?.min).toBe('0.8');
      }
      if (template === 'magazine-4') expect(labeled('Story top gap')?.min).toBe('-40');
      act(() => root.unmount());
    }
  });
  it('renders signed block gaps and permits raised glyphs without changing positive-gap covers', () => {
    const doc = presetFor('magazine-3');
    expect(gateSpacingBleed(doc.design, 'text')).toBe(0);
    doc.design.subtitleGap = -4;
    doc.design.gateTypography = { subtitle: { spaceAfter: -12 }, kicker: { spaceAfter: -6 } };
    const saved = migrate(JSON.parse(JSON.stringify(doc)));
    expect(gateTypography(saved.design, 'subtitle').spaceAfter).toBe(-12);
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<><MagGateA doc={saved} vars={cssVars(saved.design)} /><MagGateB doc={saved} vars={cssVars(saved.design)} /></>);
    expect(host.querySelector<HTMLElement>('.mag-gate-lede')!.style.marginBottom).toBe('-12px');
    expect(host.querySelectorAll('.mag-gate-mid--signed')).toHaveLength(2);
    expect(gateSpacingBleed(saved.design, 'text')).toBeCloseTo(-4 * 96 / 25.4 - 12);
    expect(gateSpacingBleed(saved.design, 'title')).toBe(-6);
  });
  it('supports a negative cover-story gap without allowing off-page coordinates or negative type sizes', () => {
    const doc = presetFor('magazine-4');
    doc.design.frontCover = { storyTop: -8 };
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<MagazineFrontCover doc={doc} vars={cssVars(doc.design)} />);
    expect(host.querySelector<HTMLElement>('.front-cover')!.style.getPropertyValue('--front-story-top')).toBe('-8mm');
    doc.footer = { bottomOffset: -12 };
    expect(footerBottomOffset(doc)).toBe(0);
    expect(gatePlacement({ top: -10, inset: -10, width: -10 }, 16)).toMatchObject({ top: 0, inset: 8, width: 50 });
    doc.design.gateTypography = { title: { fontSize: -20, lineHeight: -1, spaceAfter: -1000 } };
    expect(gateTypography(doc.design, 'title')).toMatchObject({ fontSize: 6, lineHeight: .8, spaceAfter: -100 });
  });
});
