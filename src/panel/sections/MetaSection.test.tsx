import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../../store/presets';
import { useDoc } from '../../store/useDoc';
import { MetaSection } from './MetaSection';

describe('MetaSection top-bar editor', () => {
  it('shows one dedicated top-bar text field for every template', () => {
    for (const template of TEMPLATES) {
      const host = document.createElement('div');
      const root = createRoot(host);
      const doc = template.make();
      act(() => {
        useDoc.setState({ doc });
        root.render(<MetaSection />);
      });

      const labels = [...host.querySelectorAll('.field-label')].filter(
        (label) => label.textContent === 'Top bar text',
      );
      expect(labels, template.id).toHaveLength(1);
      expect(labels[0].closest('label')?.querySelector('input')?.getAttribute('value')).toBe(
        doc.meta.masthead ?? '',
      );
      act(() => root.unmount());
    }
  });
});
