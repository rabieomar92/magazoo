import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Panel } from './Panel';
import { Toolbar } from './Toolbar';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { vi } from 'vitest';
import { useProjectFile } from '../store/projectFiles';

describe('editor chrome', () => {
  it('shows a short save label while retaining full file details for accessibility and hover', () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
    const original=useProjectFile.getState();
    const message='Saved · a-very-long-project-file-name-that-should-never-wrap-in-the-toolbar.json';
    useProjectFile.setState({status:'saved',message});
    const host=document.createElement('div');const root=createRoot(host);
    try {
      act(()=>root.render(<Toolbar onPreviewToolsHost={()=>undefined}/>));
      expect(host.querySelector('.project-save-status')?.textContent).toBe('Saved');
      expect(host.querySelector('.project-save-status')?.getAttribute('aria-label')).toBe(message);
      expect(host.querySelector('.toolbar-identity')?.getAttribute('title')).toBe(message);
    } finally { act(()=>root.unmount());useProjectFile.setState(original);vi.unstubAllGlobals(); }
  });
  it('shows the Magazoo! wordmark while keeping autosave status accessible', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<Toolbar onPreviewToolsHost={() => undefined} />);

    // The brand mark is the illustrated Magazoo! logo (an <img>), not text —
    // assert on its alt text rather than textContent.
    expect(host.querySelector('img.toolbar-brand')?.getAttribute('alt')).toBe('Magazoo!');
    expect(host.querySelector('.save-status')).toBeNull();
    expect(host.querySelector('.project-save-status')?.textContent).toContain('Draft');
    expect(host.querySelector('.visually-hidden[role="status"]')?.textContent).toContain('Autosave: Ready');
    expect(host.querySelector('[aria-label="Save"]')).not.toBeNull();

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

  it('keeps existing history, file and adjacent PDF controls in clearly labelled groups', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<Toolbar onPreviewToolsHost={() => undefined} />);
    const history = host.querySelector('[role="group"][aria-label="Edit history"]')!;
    const files = host.querySelector('[role="group"][aria-label="Project files"]')!;
    const output = host.querySelector('[role="group"][aria-label="PDF output"]')!;
    expect(history.querySelectorAll('button')).toHaveLength(2);
    expect(files.querySelectorAll('button')).toHaveLength(3);
    expect(files.querySelector('[aria-label="Save"]')).not.toBeNull();
    expect(output.querySelector('[aria-label="PDF page size"]')?.classList.contains('select-control')).toBe(true);
    expect(output.querySelector('[aria-label="Export PDF"]')).not.toBeNull();
    expect([...output.children].map(node => node.tagName)).toEqual(['SELECT', 'BUTTON']);
  });
});
