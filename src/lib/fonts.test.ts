import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { cssVars } from './geometry';
import { ALL_FONTS, fontStack } from './fonts';

describe('font stacks', () => {
  it('exposes only the approved publication font list, in product order', () => {
    expect(ALL_FONTS).toEqual([
      'Helvetica',
      'Playfair Display',
      'Bebas Neue',
      'Arial',
      'Avenir Next LT Pro Light',
      'Avenir Next LT Pro',
    ]);
  });

  it('uses a geometric sans-serif fallback for Avenir Next, never a serif', () => {
    const stack = fontStack('Avenir Next');
    expect(stack).toContain('"Avenir Next"');
    expect(stack).toContain('"Century Gothic"');
    expect(stack).toContain('sans-serif');
    expect(stack).not.toContain('Georgia');
  });

  it('uses the same resolved stack for global display and body typography', () => {
    const design = emptyDoc().design;
    design.fontDisplay = 'Avenir Next';
    design.fontBody = 'Avenir Next';
    const vars = cssVars(design);

    expect(vars['--serif']).toBe(fontStack('Avenir Next'));
    expect(vars['--sans']).toBe(fontStack('Avenir Next'));
  });

  it('publishes the editable title-to-subtitle gap as a physical CSS length', () => {
    const design = emptyDoc().design;
    design.subtitleGap = 4.5;

    expect(cssVars(design)['--subtitle-gap']).toBe('4.5mm');
  });

  it('makes article subtitle and author colors follow Ink until overridden', () => {
    const design = emptyDoc().design;
    design.colors.ink = '#f8fafc';

    expect(cssVars(design, 'magazine-2')['--subtitle-color']).toBe('#f8fafc');
    expect(cssVars(design, 'magazine-2')['--author-color']).toBe('#f8fafc');

    design.subtitleColor = '#22d3ee';
    design.authorColor = '#f59e0b';
    expect(cssVars(design, 'magazine-2')['--subtitle-color']).toBe('#22d3ee');
    expect(cssVars(design, 'magazine-2')['--author-color']).toBe('#f59e0b');
  });

  it('follows theme Ink on every template, including photographic covers', () => {
    const design = emptyDoc().design;
    design.colors.ink = '#eeeeff';
    for (const template of ['paper-1', 'paper-2', 'magazine-1', 'magazine-2', 'magazine-3', 'magazine-4', 'gallery-1', 'gallery-2', 'gallery-3', 'gallery-4'] as const) {
      const vars = cssVars(design, template);
      expect(vars['--subtitle-color']).toBe('#eeeeff');
      expect(vars['--author-color']).toBe('#eeeeff');
      expect(vars['--affiliation-color']).toBe('#eeeeff');
    }
  });
});
