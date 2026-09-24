import { describe, expect, it } from 'vitest';
import { emptyDoc, migrate } from '../schema/document';
import { cloneDocForUpdate, useDoc } from '../store/useDoc';
import { marginTextSettings, pageMarginText } from './pageMarginText';

describe('page margin text', () => {
  it('is disabled in existing documents and omits blank page entries', () => {
    const doc = emptyDoc();
    expect(pageMarginText(doc, 0)).toBe('');
    doc.marginText = { enabled: true, pages: { 2: ' © 2026 USM\n Photo: Alice ' } };
    doc.footer = { startNumber: 52 };
    expect(pageMarginText(doc, 0)).toBe('');
    expect(pageMarginText(doc, 1)).toBe('© 2026 USM Photo: Alice');
    expect(pageMarginText(doc, 2)).toBe('');
    expect(pageMarginText(doc, -1)).toBe('');
  });

  it('shares text only when explicitly requested, retaining separate entries', () => {
    const doc = emptyDoc();
    doc.marginText = { enabled: true, mode: 'all', text: 'Shared credit', pages: { 1: 'First', 2: 'Second' } };
    expect([0, 1, 20].map(i => pageMarginText(doc, i))).toEqual(['Shared credit', 'Shared credit', 'Shared credit']);
    doc.marginText.mode = 'per-page';
    expect([0, 1, 20].map(i => pageMarginText(doc, i))).toEqual(['First', 'Second', '']);
    doc.marginText.enabled = false;
    expect(pageMarginText(doc, 0)).toBe('');
    expect(doc.marginText.pages).toEqual({ 1: 'First', 2: 'Second' });
  });

  it('bounds imported styling and rejects unsafe colour values', () => {
    const doc = emptyDoc();
    doc.marginText = { fontSize: Infinity, edgeOffset: -100, bottomOffset: 900, fontFamily: 'bogus', color: 'url(https://example.test)' };
    expect(marginTextSettings(doc)).toMatchObject({ fontSize: 6.5, edgeOffset: 2, bottomOffset: 80, fontFamily: 'Helvetica', color: undefined });
    doc.marginText.fontSize = 30;
    doc.marginText.color = '#abc';
    expect(marginTextSettings(doc)).toMatchObject({ fontSize: 12, color: '#abc' });
  });

  it('preserves settings through save/reopen, template changes and undo', () => {
    const original = emptyDoc();
    original.marginText = { enabled: true, mode: 'per-page', pages: { 1: 'Original', 4: 'Later page' } };
    const draft = cloneDocForUpdate(original);
    draft.marginText!.pages![1] = 'Changed';
    expect(original.marginText.pages![1]).toBe('Original');
    useDoc.getState().load(original);
    useDoc.getState().update(d => { d.marginText!.pages![1] = 'Edited'; });
    useDoc.temporal.getState().undo();
    expect(useDoc.getState().doc.marginText).toEqual(original.marginText);
    useDoc.temporal.getState().redo();
    expect(pageMarginText(useDoc.getState().doc, 0)).toBe('Edited');
    useDoc.getState().switchTemplate('backcover-1');
    const reopened = migrate(JSON.parse(JSON.stringify(useDoc.getState().doc)));
    expect(reopened.marginText).toEqual({ ...original.marginText, pages: { 1: 'Edited', 4: 'Later page' } });
    useDoc.getState().load(emptyDoc());
  });
});
