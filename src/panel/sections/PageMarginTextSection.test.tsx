import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageMarginTextSection } from './PageMarginTextSection';
import { TypographyProvider, TypographyToolbar } from '../TypographyToolbar';
import { useDoc } from '../../store/useDoc';
import { emptyDoc } from '../../schema/document';
import { requestEditorTargetFocus } from '../../lib/editorNavigation';

let host: HTMLDivElement;
let root: Root;
function field<T extends HTMLInputElement | HTMLSelectElement>(label: string) {
  return [...host.querySelectorAll('label')].find(el => el.querySelector('.field-label')?.textContent?.replace(/\s*\([^)]*\)\s*$/, '').trim() === label)!.querySelector<T>('input,select')!;
}
function enter(label: string, value: string) {
  act(() => {
    const el = field<HTMLInputElement>(label);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function mode(value: string) {
  act(() => { const el = field<HTMLSelectElement>('Text on pages'); el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); });
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  useDoc.getState().load(emptyDoc());
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<TypographyProvider><TypographyToolbar /><PageMarginTextSection /></TypographyProvider>));
});
afterEach(() => { act(() => root.unmount()); host.remove(); useDoc.getState().load(emptyDoc()); vi.unstubAllGlobals(); });

describe('page margin text controls', () => {
  it('accepts positions beyond 80 mm up to the full page height, including the bottom edge', () => {
    act(() => field<HTMLInputElement>('Show vertical margin text').click());
    const input = field<HTMLInputElement>('Distance from bottom edge');
    expect(input.min).toBe('0');
    expect(input.max).toBe('297');
    for (const value of [180, 250, 297, 0]) {
      enter('Distance from bottom edge', String(value));
      expect(useDoc.getState().doc.marginText?.bottomOffset).toBe(value);
    }
  });

  it('starts disabled, edits independent pages, and switches modes without data loss', () => {
    expect(field<HTMLInputElement>('Show vertical margin text').checked).toBe(false);
    act(() => field<HTMLInputElement>('Show vertical margin text').click());
    enter('Text for page 1', 'First credit');
    enter('Page position in this document', '2');
    enter('Text for page 2', 'Second credit');
    expect(useDoc.getState().doc.marginText?.pages).toEqual({ 1: 'First credit', 2: 'Second credit' });
    mode('all');
    expect(field<HTMLInputElement>('Text for every page').value).toBe('Second credit');
    enter('Text for every page', 'Common credit');
    mode('per-page');
    expect(field<HTMLInputElement>('Text for page 2').value).toBe('Second credit');
    enter('Page position in this document', '1');
    expect(field<HTMLInputElement>('Text for page 1').value).toBe('First credit');
    mode('all');
    expect(field<HTMLInputElement>('Text for every page').value).toBe('Common credit');
    act(() => field<HTMLInputElement>('Show vertical margin text').click());
    expect(useDoc.getState().doc.marginText).toMatchObject({ enabled: false, text: 'Common credit', pages: { 1: 'First credit', 2: 'Second credit' } });
  });

  it('opens the clicked page and keeps typography in the top toolbar', () => {
    act(() => useDoc.getState().update(d => { d.marginText = { enabled: true, pages: { 3: 'Third page' } }; }));
    act(() => requestEditorTargetFocus('design', 'page-margin-text-3'));
    expect(field<HTMLInputElement>('Text for page 3').value).toBe('Third page');
    const font = field<HTMLSelectElement>('Margin text font');
    expect(font.closest('.typography-toolbar')).not.toBeNull();
    expect(font.closest<HTMLElement>('.typography-control')!.hidden).toBe(false);
    act(() => { font.value = 'Playfair Display'; font.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(useDoc.getState().doc.marginText?.fontFamily).toBe('Playfair Display');
  });
});
