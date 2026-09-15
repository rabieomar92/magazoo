import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { makeFrontMatter } from '../../store/frontMatter';
import { useDoc } from '../../store/useDoc';
import { FrontMatterDesign } from './FrontMatterSection';

describe('FrontMatterDesign', () => {
  it('offers an Editorial Board-only top-bar visibility control', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() => {
      useDoc.setState({ doc: makeFrontMatter('frontmatter-board') });
      root.render(<FrontMatterDesign />);
    });

    const toggle = [...host.querySelectorAll('label')].find(
      label => label.querySelector('.field-label')?.textContent === 'Show top bar',
    )?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(toggle?.checked).toBe(true);

    act(() => toggle?.click());
    expect(useDoc.getState().doc.design.showTopBar).toBe(false);

    act(() => {
      useDoc.setState({ doc: makeFrontMatter('frontmatter-contents') });
    });
    expect([...host.querySelectorAll('.field-label')].some(
      label => label.textContent === 'Show top bar',
    )).toBe(false);

    act(() => root.unmount());
  });
});
