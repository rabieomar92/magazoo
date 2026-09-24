import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Doc } from '../schema/document';
import { TEMPLATES, presetFor } from '../store/presets';
import { PageFooters } from './PageFooters';
import { TagBar } from './TagBar';
import { assignIssuePages, defaultIssuePlan, documentWithIssueNumber, type IssueItem } from '../issue/model';
import { snapshotIssuePages } from '../issue/snapshotIssuePages';
import { clonePages } from '../lib/pdfExport';
import { FOCUS_EDITOR_TARGET_EVENT } from '../lib/editorNavigation';

let host: HTMLDivElement;
let root: Root;
function Sheets({ doc, count = 2 }: { doc: Doc; count?: number }) {
  const pages = useRef<HTMLDivElement>(null);
  return <><div className="pages" ref={pages}>
    {Array.from({ length: count }, (_, i) => <article className="page" key={i}><TagBar doc={doc} pageIndex={i} /><p>Body page {i + 1}</p></article>)}
    <div className="measure-root"><div className="page">Not a physical sheet</div></div>
  </div><PageFooters doc={doc} root={pages} /></>;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe('physical page margin text', () => {
  it.each(['left', 'right', undefined] as const)('follows the masthead on every sheet when starting %s', async barSide => {
    for (const mode of ['all', 'per-page'] as const) {
      const doc = presetFor('gallery-1');
      doc.design.barSide = barSide;
      doc.footer = { startNumber: 92 };
      doc.marginText = { enabled: true, mode, text: 'Shared credit', side: barSide === 'right' ? 'left' : 'right',
        pages: { 1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth' } };
      await act(async () => { root.render(<Sheets doc={doc} count={4} />); });
      const pages = [...host.querySelectorAll('.pages > .page')];
      const sides = pages.map(page => {
        const rail = page.querySelector<HTMLElement>('.page-margin-rail')!;
        const right = page.querySelector('.tag-bar')!.classList.contains('tag-bar--flip');
        expect(rail.style.left).toBe(right ? 'auto' : '6mm');
        expect(rail.style.right).toBe(right ? '6mm' : 'auto');
        return right ? 'right' : 'left';
      });
      expect(sides).toEqual(barSide === 'right' ? ['right', 'left', 'right', 'left'] : ['left', 'right', 'left', 'right']);
    }
  });

  it('uses physical page positions even when intervening credits are blank', async () => {
    const doc = presetFor('gallery-1');
    doc.design.barSide = 'left';
    doc.marginText = { enabled: true, pages: { 2: 'Second', 4: 'Fourth' } };
    await act(async () => { root.render(<Sheets doc={doc} count={4} />); });
    const rails = [...host.querySelectorAll<HTMLElement>('.page-margin-rail')];
    expect(rails).toHaveLength(2);
    expect(rails.map(rail => rail.style.right)).toEqual(['6mm', '6mm']);
    await act(async () => { root.render(<Sheets doc={{ ...doc, design: { ...doc.design, barSide: 'right' } }} count={4} />); });
    expect([...host.querySelectorAll<HTMLElement>('.page-margin-rail')].map(rail => rail.style.left)).toEqual(['6mm', '6mm']);
  });

  it.each([false, true])('follows compiled issue mastheads with countCovers=%s, regardless of folios or reading direction', async countCovers => {
    const items: IssueItem[] = ['cover', 'a', 'b'].map(id => ({ id, name: id, version: 1, updated: 0,
      doc: presetFor(id === 'cover' ? 'magazine-4' : 'paper-1') }));
    const plan = { ...defaultIssuePlan(items), countCovers, startNumber: 42, direction: 'rtl' as const };
    const assignments = assignIssuePages(plan, items, { cover: 1, a: 3, b: 2 });
    const sides: string[] = [];
    for (const row of assignments.filter(row => row.id !== 'cover')) {
      const original = items.find(item => item.id === row.id)?.doc ?? presetFor('frontmatter-contents');
      const doc = documentWithIssueNumber(original, row.startNumber, row.mastheadSide);
      doc.marginText = { enabled: true, mode: 'all', text: 'Issue credit', side: 'right' };
      await act(async () => { root.render(<Sheets doc={doc} count={row.pageCount} />); });
      for (const page of snapshotIssuePages(host.querySelector<HTMLElement>('.pages')!)) {
        const rail = page.querySelector<HTMLElement>('.page-margin-rail')!;
        const right = page.querySelector('.tag-bar')!.classList.contains('tag-bar--flip');
        expect(rail.style.right).toBe(right ? '6mm' : 'auto');
        sides.push(rail.style.right === '6mm' ? 'right' : 'left');
      }
    }
    expect(sides).toEqual(['left', 'right', 'left', 'right', 'left', 'right', 'left']);
  });

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
    expect(credit.style.textOrientation).toBe('sideways');
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
    doc.design.barSide = 'right';
    doc.marginText = { enabled: true, side: 'left', edgeOffset: 5, bottomOffset, color: '#123456', pages: { 1: '© <Alice>', 2: '© Bob' } };
    await act(async () => { root.render(<Sheets doc={doc} />); });
    const pages = host.querySelector<HTMLElement>('.pages')!;
    const print = document.implementation.createHTMLDocument('Print check');
    clonePages(pages, print, { freezeColumns: false });
    expect([...print.querySelectorAll('.page-margin-text')].map(e => e.textContent)).toEqual(['© <Alice>', '© Bob']);
    expect(print.querySelector<HTMLElement>('.page-margin-text')!.style.textOrientation).toBe('sideways');
    expect([...print.querySelectorAll<HTMLElement>('.page-margin-rail')].map(rail => rail.style.right)).toEqual(['5mm', 'auto']);
    const snapshots = snapshotIssuePages(pages);
    expect(snapshots).toHaveLength(2);
    const credit = snapshots[0].querySelector<HTMLElement>('.page-margin-text')!;
    expect(credit.textContent).toBe('© <Alice>');
    expect(credit.querySelector('alice')).toBeNull();
    expect(credit.parentElement!.style.right).toBe('5mm');
    expect(snapshots[1].querySelector<HTMLElement>('.page-margin-rail')!.style.left).toBe('5mm');
    expect(snapshots[0].querySelector<HTMLElement>('.page-margin-offset')!.style.height).toBe(`${bottomOffset}mm`);
    expect(credit.style.writingMode).toBe('vertical-rl');
    expect(credit.style.textOrientation).toBe('sideways');
    expect(credit.style.fontSize).toBe('6.5pt');
  });
});
