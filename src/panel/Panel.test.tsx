import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { presetFor } from '../store/presets';
import { useDoc } from '../store/useDoc';
import { Panel } from './Panel';

describe('layout change warning', () => {
  let root: ReturnType<typeof createRoot> | null = null;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
  });

  it('does not change the renderer until the editor explicitly confirms', () => {
    const host = document.createElement('div');
    root = createRoot(host);
    act(() => {
      useDoc.setState({ doc: presetFor('paper-1') });
      root?.render(<Panel />);
    });

    const select = host.querySelector<HTMLSelectElement>('select[aria-label="Layout template"]')!;
    act(() => {
      select.value = 'frontmatter-board';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(useDoc.getState().doc.templateId).toBe('paper-1');
    expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(host.textContent).toContain('Changing the layout can reflow every page');

    const keep = [...host.querySelectorAll('button')].find(button => button.textContent === 'Keep current layout')!;
    act(() => keep.click());
    expect(useDoc.getState().doc.templateId).toBe('paper-1');
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();

    act(() => {
      select.value = 'frontmatter-board';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const confirm = [...host.querySelectorAll('button')].find(button => button.textContent === 'Change layout')!;
    act(() => confirm.click());
    expect(useDoc.getState().doc.templateId).toBe('frontmatter-board');
  });
});
