import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { emptyDoc, migrate } from '../../schema/document';
import { cssVars } from '../../lib/geometry';
import { useDoc } from '../../store/useDoc';
import { HeadingTextEditor } from './HeadingTextEditor';

describe('independent heading appearance', () => {
  it('turns native italic off, applies bold, persists, and resets only the selected colour', () => {
    const doc = emptyDoc();
    doc.templateId = 'magazine-2';
    doc.design.colors.ink = '#ffffff';
    doc.design.subtitleColor = '#112233';
    doc.design.authorColor = '#ff5500';
    doc.design.affiliationColor = '#22aaff';
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() => {
      useDoc.setState({ doc });
      root.render(<HeadingTextEditor role="subtitle" label="Subtitle" />);
    });
    const [bold, italic] = host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(italic.checked).toBe(true);
    act(() => { bold.click(); italic.click(); });
    act(() => host.querySelector<HTMLButtonElement>('button')!.click());
    const saved = migrate(JSON.parse(JSON.stringify(useDoc.getState().doc)));
    const vars = cssVars(saved.design, saved.templateId);
    expect(vars['--subtitle-weight']).toBe('700');
    expect(vars['--subtitle-style']).toBe('normal');
    expect(vars['--subtitle-color']).toBe('#ffffff');
    expect(vars['--author-color']).toBe('#ff5500');
    expect(vars['--affiliation-color']).toBe('#22aaff');
    saved.design.colors.ink = '#ffff00';
    expect(cssVars(saved.design, saved.templateId)['--subtitle-color']).toBe('#ffff00');
    act(() => root.unmount());
  });
});
