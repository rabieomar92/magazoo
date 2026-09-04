import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { presetFor } from '../../store/presets';
import { useDoc } from '../../store/useDoc';
import { DesignSection } from './DesignSection';

describe('DesignSection font choices', () => {
  it('offers Avenir Next in every standard font selector', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() => {
      useDoc.setState({ doc: presetFor('paper-1') });
      root.render(<DesignSection />);
    });

    const selects = [...host.querySelectorAll('select')].filter((select) =>
      ['Display', 'Body', 'Category', 'Subtitle', 'Author', 'Affiliation'].includes(
        select.closest('label')?.querySelector('.field-label')?.textContent ?? '',
      ),
    );
    expect(selects).toHaveLength(6);
    for (const select of selects) {
      expect([...select.options].map((option) => option.value)).toContain('Avenir Next');
    }

    act(() => root.unmount());
  });

  it('replaces generic typography with an editable selector for every cover text object', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() => {
      useDoc.setState({ doc: presetFor('magazine-4') });
      root.render(<DesignSection />);
    });

    expect(host.textContent).toContain('Front cover layout');
    expect(host.textContent).toContain('Cover object styles');
    const fontSelects = [...host.querySelectorAll('select')].filter(
      (select) => select.closest('label')?.querySelector('.field-label')?.textContent === 'Font',
    );
    expect(fontSelects).toHaveLength(11);
    for (const select of fontSelects) {
      expect([...select.options].map((option) => option.value)).toContain('Avenir Next');
    }

    act(() => root.unmount());
  });
});
