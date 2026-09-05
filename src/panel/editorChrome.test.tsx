import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Panel } from './Panel';
import { Toolbar } from './Toolbar';

describe('editor chrome', () => {
  it('shows the Magazoo! wordmark while keeping autosave status accessible', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<Toolbar onPreviewToolsHost={() => undefined} />);

    expect(host.querySelector('.toolbar-brand')?.textContent).toBe('Magazoo!');
    expect(host.querySelector('.save-status')).toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Autosave: Ready');

    const exportButton = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Export PDF'),
    );
    expect(exportButton?.textContent?.trim()).toBe('Export PDF');
  });

  it('uses flat tabs and the shared select control on every rendered dropdown', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<Panel />);

    const tabs = [...host.querySelectorAll('[role="tab"]')];
    expect(tabs).toHaveLength(4);
    expect(tabs.every((tab) => tab.classList.contains('panel-tab'))).toBe(true);

    const selects = [...host.querySelectorAll('select')];
    expect(selects.length).toBeGreaterThan(0);
    expect(selects.every((select) => select.classList.contains('select-control'))).toBe(true);
  });
});
