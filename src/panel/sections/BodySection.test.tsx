import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BodySection } from './BodySection';
import { TypographyProvider, TypographyToolbar } from '../TypographyToolbar';
import { GalleryPage } from '../../paper/GalleryPage';
import { useDoc } from '../../store/useDoc';
import { presetFor } from '../../store/presets';
import { familyOf, migrate, type TemplateId } from '../../schema/document';
import { galleryTextPosition } from '../../lib/galleryTextPosition';
import { clonePages } from '../../lib/pdfExport';
import { snapshotIssuePages } from '../../issue/snapshotIssuePages';

let host: HTMLDivElement;
let root: Root;
const galleries = ['gallery-1', 'gallery-2', 'gallery-3', 'gallery-4'] as const;
const cards = () => useDoc.getState().doc.blocks.filter(block => block.type === 'paragraph');
const controls = () => [...host.querySelectorAll<HTMLElement>('.gallery-card-position')];
const renderedCards = () => [...host.querySelectorAll<HTMLElement>('.g-card')];
function Preview() {
  const doc = useDoc(state => state.doc);
  return familyOf(doc.templateId) === 'gallery' ? <GalleryPage doc={doc} vars={{}} /> : null;
}
function render(template: TemplateId = 'gallery-2') {
  const doc = presetFor(template);
  act(() => {
    useDoc.getState().load(doc);
    root.render(<TypographyProvider><TypographyToolbar /><BodySection /><Preview /></TypographyProvider>);
  });
  return structuredClone(doc);
}
function choose(index: number, label: string) {
  act(() => [...controls()[index].querySelectorAll('button')].find(button => button.textContent === label)!.click());
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('gallery paragraph vertical position', () => {
  it.each(galleries)('keeps existing cards centred without mutating %s on render', template => {
    const original = render(template);
    expect(controls()).toHaveLength(cards().length);
    expect(useDoc.getState().doc).toEqual(original);
    for (const card of renderedCards()) {
      expect(card.style.getPropertyValue('--gallery-card-before')).toBe('0.5');
      expect(card.style.getPropertyValue('--gallery-card-after')).toBe('0.5');
    }
  });

  it.each(galleries)('moves only the chosen paragraph and persists through save, reopen, undo and redo in %s', template => {
    const original = render(template);
    const chosenId = cards()[2].id;
    choose(2, 'Bottom');
    expect(cards()[2].cardVerticalPosition).toBe(100);
    expect(renderedCards()[2].style.getPropertyValue('--gallery-card-before')).toBe('1');
    expect(renderedCards()[2].style.getPropertyValue('--gallery-card-after')).toBe('0');
    expect(useDoc.getState().doc.blocks.filter(block => block.id !== chosenId)).toEqual(original.blocks.filter(block => block.id !== chosenId));
    expect(useDoc.getState().doc.assets).toEqual(original.assets);
    const saved = JSON.stringify(useDoc.getState().doc);
    act(() => useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc).toEqual(original);
    act(() => useDoc.temporal.getState().redo());
    expect(cards()[2].cardVerticalPosition).toBe(100);
    act(() => useDoc.getState().load(migrate(JSON.parse(saved))));
    expect(cards()[2].cardVerticalPosition).toBe(100);
    choose(2, 'Top');
    expect(cards()[2].cardVerticalPosition).toBe(0);
    choose(2, 'Middle');
    expect(cards()[2].cardVerticalPosition).toBeUndefined();
    expect(useDoc.getState().doc.blocks).toEqual(original.blocks);
  });

  it.each(galleries)('supports intermediate positions across the full range without changing typography in %s', template => {
    render(template);
    const before = structuredClone(cards()[0]);
    const slider = controls()[0].querySelector<HTMLInputElement>('input[type=range]')!;
    expect(slider.min).toBe('0');
    expect(slider.max).toBe('100');
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(slider, '23');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(cards()[0]).toEqual({ ...before, cardVerticalPosition: 23 });
    expect(renderedCards()[0].style.getPropertyValue('--gallery-card-before')).toBe('0.23');
    expect(renderedCards()[0].style.getPropertyValue('--gallery-card-after')).toBe('0.77');
    expect(controls()[0].querySelectorAll('[aria-pressed=true]')).toHaveLength(0);
  });

  it.each(galleries)('keeps the setting with its paragraph when reordered in %s', template => {
    render(template);
    choose(0, 'Top');
    const first = structuredClone(cards()[0]);
    act(() => host.querySelector<HTMLButtonElement>('.block-card button[title="Move down"]')!.click());
    expect(cards()[1]).toEqual(first);
    expect(renderedCards()[1].dataset.sourceBlockId).toBe(first.id);
    expect(renderedCards()[1].style.getPropertyValue('--gallery-card-before')).toBe('0');
  });

  it.each(galleries)('preserves both page settings in compiled issue and print clones for %s', template => {
    render(template);
    choose(0, 'Top');
    choose(2, 'Bottom');
    const printDoc = document.implementation.createHTMLDocument('Print');
    clonePages(host, printDoc);
    const issuePages = snapshotIssuePages(host);
    expect(issuePages).toHaveLength(2);
    for (const pages of [[...printDoc.querySelectorAll('.page')], issuePages]) {
      const positions = pages.flatMap(page => [...page.querySelectorAll<HTMLElement>('.g-card--positioned')]
        .map(card => [card.style.getPropertyValue('--gallery-card-before'), card.style.getPropertyValue('--gallery-card-after')]));
      expect(positions).toEqual(cards().map((_, index) => index === 0 ? ['0', '1'] : index === 2 ? ['1', '0'] : ['0.5', '0.5']));
    }
  });

  it.each(['paper-1', 'magazine-4'] as const)('does not offer or apply gallery positioning in %s', template => {
    render();
    choose(0, 'Bottom');
    act(() => useDoc.getState().switchTemplate(template));
    expect(controls()).toHaveLength(0);
    expect(host.querySelector('.g-card--positioned')).toBeNull();
    expect(cards()[0].cardVerticalPosition).toBe(100);
    act(() => useDoc.getState().switchTemplate('gallery-2'));
    expect(controls()).toHaveLength(4);
    expect(renderedCards()[0].style.getPropertyValue('--gallery-card-before')).toBe('1');
  });

  it.each(galleries)('retains the same independent position when switching to %s', template => {
    render();
    choose(0, 'Bottom');
    act(() => useDoc.getState().switchTemplate(template));
    expect(controls()).toHaveLength(4);
    expect(renderedCards()[0].style.getPropertyValue('--gallery-card-before')).toBe('1');
  });

  it.each([
    [undefined, 50], [NaN, 50], [Infinity, 50], [-10, 0], [120, 100], [0, 0], [23, 23], [100, 100],
  ])('bounds imported position %s to %s', (value, expected) => {
    expect(galleryTextPosition(value)).toBe(expected);
  });
});
