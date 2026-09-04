import { create } from 'zustand';
import { temporal } from 'zundo';
import { emptyDoc, type Doc, type TemplateId } from '../schema/document';
import { presetFor } from './presets';

interface State {
  doc: Doc;
  /** Mutate a draft. Keep every edit going through here. */
  update: (fn: (d: Doc) => void) => void;
  load: (doc: Doc) => void;
  /** Switch layout template and load that template's preset content. Undoable. */
  switchTemplate: (id: TemplateId) => void;
}

/** Mutable draft without copying multi-megabyte data URLs on every keystroke. */
export function cloneDocForUpdate(doc: Doc): Doc {
  return {
    ...doc,
    meta: { ...doc.meta },
    blocks: doc.blocks.map((block) =>
      block.type === 'figure' && block.frame
        ? { ...block, frame: { ...block.frame } }
        : { ...block },
    ),
    images: (doc.images ?? []).map((image) => ({
      ...image,
      anchor: { ...image.anchor },
      bleed: image.bleed ? { ...image.bleed } : undefined,
    })),
    highlightBox: doc.highlightBox
      ? { ...doc.highlightBox, anchor: { ...doc.highlightBox.anchor } }
      : undefined,
    highlights: [...doc.highlights],
    references: doc.references.map((reference) => ({ ...reference })),
    hero: { ...doc.hero },
    cover: doc.cover ? { ...doc.cover } : undefined,
    assets: Object.fromEntries(
      Object.entries(doc.assets).map(([id, asset]) => [id, { ...asset }]),
    ),
    design: {
      ...doc.design,
      colors: { ...doc.design.colors },
      sizes: { ...doc.design.sizes },
    },
  };
}

export const useDoc = create<State>()(
  temporal(
    (set) => ({
      doc: emptyDoc(),
      update: (fn) =>
        set((s) => {
          const next = cloneDocForUpdate(s.doc);
          fn(next);
          return { doc: next };
        }),
      load: (doc) => set({ doc }),
      switchTemplate: (id) => set({ doc: presetFor(id) }),
    }),
    {
      // Don't push a history entry on every keystroke.
      handleSet: (handleSet) => {
        let t: ReturnType<typeof setTimeout>;
        return (...args: Parameters<typeof handleSet>) => {
          clearTimeout(t);
          t = setTimeout(() => handleSet(...args), 400);
        };
      },
      limit: 100,
    },
  ),
);

/** Undo/redo, essentially free. */
export const useHistory = () => useDoc.temporal.getState();
