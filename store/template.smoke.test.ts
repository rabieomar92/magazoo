import { afterEach, describe, expect, it } from 'vitest';
import { useDoc } from './useDoc';
import { presetFor, TEMPLATES, TEMPLATE_META } from './presets';
import { emptyDoc, familyOf } from '../schema/document';

afterEach(() => {
  useDoc.getState().load(emptyDoc());
});

describe('template registry', () => {
  it('has the supported paper designs and 3+ magazine templates', () => {
    const paper = TEMPLATE_META.filter((t) => t.family === 'paper');
    const magazine = TEMPLATE_META.filter((t) => t.family === 'magazine');
    expect(paper.map((t) => t.id)).toEqual(['paper-1', 'paper-2', 'paper-3']);
    expect(magazine.length).toBeGreaterThanOrEqual(3);
  });

  it('every preset carries a matching templateId and family', () => {
    for (const t of TEMPLATES) {
      const doc = t.make();
      expect(doc.templateId).toBe(t.id);
      expect(familyOf(doc.templateId)).toBe(t.family);
    }
  });

  it('magazine presets ship a hero photo; editorial spreads have pull-quotes and each has its own accent', () => {
    const mags = TEMPLATES.filter((t) => t.family === 'magazine').map((t) => t.make());
    for (const d of mags) {
      expect(d.hero.assetId).toBeTruthy();
      if (d.templateId !== 'magazine-4') expect(d.meta.pullQuote).toBeTruthy();
    }
    const accents = mags.map((d) => d.design.colors.accent);
    expect(new Set(accents).size).toBe(accents.length); // all distinct
  });

  it('presetFor returns fresh docs (independent asset ids)', () => {
    const a = presetFor('magazine-2');
    const b = presetFor('magazine-2');
    expect(a.hero.assetId).not.toBe(b.hero.assetId);
  });

  it('fresh presets carry the Magazoo sample identity without touching loaded documents', () => {
    for (const template of TEMPLATES) {
      const doc = template.make();
      expect(doc.meta.masthead).toBe('Magazoo!');
      if (doc.templateId === 'backcover-1') expect(doc.backCover?.brand).toBe('Magazoo!');
    }
  });

  it('switchTemplate changes only the renderer and preserves the edited document', () => {
    const doc = presetFor('paper-1');
    doc.meta.title = 'Edited title';
    doc.meta.subtitle = 'Edited subtitle';
    doc.meta.masthead = 'Edited masthead';
    doc.blocks[0] = { ...doc.blocks[0], type: 'paragraph', text: 'Edited paragraph' };
    doc.highlights = ['Edited highlight'];
    doc.references = [{ id: 'reference', authors: 'Author', title: 'Title', journal: 'Journal', year: '2026', doi: '10.0000/example' }];
    doc.footer = { enabled: true, text: 'Edited footer', startNumber: 7 };
    doc.design.colors.accent = '#123456';
    const before = {
      meta: structuredClone(doc.meta),
      blocks: structuredClone(doc.blocks),
      highlights: [...doc.highlights],
      references: structuredClone(doc.references),
      footer: structuredClone(doc.footer),
      colors: { ...doc.design.colors },
      assets: structuredClone(doc.assets),
    };

    useDoc.getState().load(doc);
    useDoc.getState().switchTemplate('magazine-2');

    const switched = useDoc.getState().doc;
    expect(switched.templateId).toBe('magazine-2');
    expect(switched.meta).toEqual(before.meta);
    expect(switched.blocks).toEqual(before.blocks);
    expect(switched.highlights).toEqual(before.highlights);
    expect(switched.references).toEqual(before.references);
    expect(switched.footer).toEqual(before.footer);
    expect(switched.design.colors).toEqual(before.colors);
    expect(switched.assets).toEqual(before.assets);
    expect(switched).not.toBe(doc);

    // Switching again must keep the same edits rather than loading the second
    // template's sample story.
    useDoc.getState().switchTemplate('paper-2');
    expect(useDoc.getState().doc.templateId).toBe('paper-2');
    expect(useDoc.getState().doc.meta.title).toBe('Edited title');
    expect(useDoc.getState().doc.highlights).toEqual(['Edited highlight']);
  });

  it('normalizes a legacy document without a template id non-destructively', () => {
    const doc = emptyDoc();
    delete doc.templateId;
    doc.meta.title = 'Legacy title';
    doc.highlights = ['Legacy highlight'];
    useDoc.getState().load(doc);

    useDoc.getState().switchTemplate('paper-1');

    expect(useDoc.getState().doc.templateId).toBe('paper-1');
    expect(useDoc.getState().doc.meta.title).toBe('Legacy title');
    expect(useDoc.getState().doc.highlights).toEqual(['Legacy highlight']);
  });
});
