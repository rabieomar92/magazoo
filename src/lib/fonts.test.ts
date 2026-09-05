import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { cssVars } from './geometry';
import { fontStack } from './fonts';

describe('font stacks', () => {
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
});
