import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Doc } from '../schema/document';
import { TEMPLATES, presetFor } from '../store/presets';
import { PageFooters } from './PageFooters';
import { snapshotIssuePages } from '../issue/snapshotIssuePages';
import { clonePages } from '../lib/pdfExport';
import { FOCUS_EDITOR_TARGET_EVENT } from '../lib/editorNavigation';

let host: HTMLDivElement;
let root: Root;
function Sheets({ doc, count = 2 }: { doc: Doc; count?: number }) {
  const pages = useRef<HTMLDivElement>(null);
  return <><div className="pages" ref={pages}>
    {Array.from({ length: count }, (_, i) => <article className="page" key={i}><p>Body page {i + 1}</p></article>)}
    <div className="measure-root"><div className="page">Not a physical sheet</div></div>
  </div><PageFooters doc={doc} root={pages} /></>;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe('physical page margin text', () => {
  it.each(TEMPLATES.map(t => t.id))('renders independent credits for %s, including unnumbered covers', async id => {
    const doc = presetFor(id);
    doc.marginText = { enabled: true, pages: { 1: '© Alice', 2: '© Bob' } };
    doc.footer = { enabled: false, startNumber: 92 };
    await act(async () => { root.render(<Sheets doc={doc} />); });
    expect([...host.querySelectorAll('.page-margin-text')].map(e => e.textContent)).toEqual(['© Alice', '© Bob']);
    expect(host.querySelector('.measure-root .page-margin-text')).toBeNull();
    expect(host.querySelector('.page-folio')).toBeNull();
    const credit = host.querySelector<HTMLElement>('.page-margin-text')!;
    expect(credit.parentElement!.style.position).toBe('absolute');
    expect(credit.style.flexShrink).toBe('0');
    expect(credit.style.writingMode).toBe('vertical-rl');
    expect(credit.style.transform).toBe('rotate(180deg)');
    expect(credit.dataset.editorTarget).toBe('page-margin-text-1');
  });

  it('updates new and removed sheets without leaving duplicate credits', async () => {
    const doc = presetFor('gallery-1');
    doc.marginText = { enabled: true, mode: 'all', text: 'Same credit' };
    await act(async () => { root.render(<Sheets doc={doc} count={1} />); });
    expect(host.querySelectorAll('.page-margin-text')).toHaveLength(1);
    await act(async () => { root.render(<Sheets doc={doc} count={4} />); });
    expect(host.querySelectorAll('.page-margin-text')).toHaveLength(4);
    await act(async () => { root.render(<Sheets doc={doc} count={2} />); });
    expect(host.querySelectorAll('.page-margin-text')).toHaveLength(2);
    await act(async () => { root.render(<Sheets doc={{ ...doc, marginText: { ...doc.marginText, enabled: false } }} />); });
    expect(host.querySelectorAll('.page-margin-text')).toHaveLength(0);
  });

  it('opens the correct page controls when a portalled credit is clicked', async () => {
    const doc = presetFor('gallery-1');
    doc.marginText = { enabled: true, pages: { 2: 'Second credit' } };
    await act(async () => { root.render(<Sheets doc={doc} />); });
    const focus = vi.fn();
    window.addEventListener(FOCUS_EDITOR_TARGET_EVENT, focus);
    try {
      act(() => host.querySelector<HTMLElement>('.page-margin-text')!.click());
      expect(focus.mock.calls[0][0].detail).toEqual({ tab: 'design', target: 'page-margin-text-2' });
    } finally { window.removeEventListener(FOCUS_EDITOR_TARGET_EVENT, focus); }
  });

  it.each([25, 297])('keeps real credit text and a %s mm position in export and compiled snapshots', async bottomOffset => {
    const doc = presetFor('gallery-1');
    doc.marginText = { enabled: true, side: 'right', edgeOffset: 5, bottomOffset, color: '#123456', pages: { 1: '© <Alice>', 2: '© Bob' } };
    await act(async () => { root.render(<Sheets doc={doc} />); });
    const pages = host.querySelector<HTMLElement>('.pages')!;
    const print = document.implementation.createHTMLDocument('Print check');
    clonePages(pages, print, { freezeColumns: false });
    expect([...print.querySelectorAll('.page-margin-text')].map(e => e.textContent)).toEqual(['© <Alice>', '© Bob']);
    const snapshots = snapshotIssuePages(pages);
    expect(snapshots).toHaveLength(2);
    const credit = snapshots[0].querySelector<HTMLElement>('.page-margin-text')!;
    expect(credit.textContent).toBe('© <Alice>');
    expect(credit.querySelector('alice')).toBeNull();
    expect(credit.parentElement!.style.right).toBe('5mm');
    expect(snapshots[0].querySelector<HTMLElement>('.page-margin-offset')!.style.height).toBe(`${bottomOffset}mm`);
    expect(credit.style.writingMode).toBe('vertical-rl');
    expect(credit.style.fontSize).toBe('6.5pt');
  });
});
