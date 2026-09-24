import { create } from 'zustand';
import { temporal } from 'zundo';
import { emptyDoc, type Doc, type TemplateId } from '../schema/document';
import { makeBackCover } from './backCover';

interface State {
  doc: Doc;
  /** Mutate a draft. Keep every edit going through here. */
  update: (fn: (d: Doc) => void) => void;
  load: (doc: Doc) => void;
  /** Switch layout template without replacing any document content. Undoable. */
  switchTemplate: (id: TemplateId) => void;
}

/** Mutable draft without copying multi-megabyte data URLs on every keystroke. */
export function cloneDocForUpdate(doc: Doc): Doc {
  return {
    ...doc,
    meta: { ...doc.meta },
    news: doc.news ? { stories: doc.news.stories.map(story => ({
      ...story,
      frame: story.frame ? { ...story.frame } : undefined,
      paragraphTops: story.paragraphTops ? [...story.paragraphTops] : undefined,
    })) } : undefined,
    footer: doc.footer ? { ...doc.footer } : undefined,
    marginText: doc.marginText ? { ...doc.marginText, pages: { ...doc.marginText.pages } } : undefined,
    frontMatter: doc.frontMatter ? {
      ...doc.frontMatter,
      entries: doc.frontMatter.entries.map(entry => ({ ...entry })),
      logo: doc.frontMatter.logo ? { ...doc.frontMatter.logo } : undefined,
      signature: doc.frontMatter.signature ? { ...doc.frontMatter.signature } : undefined,
      signatureCrop: doc.frontMatter.signatureCrop ? { ...doc.frontMatter.signatureCrop } : undefined,
    } : undefined,
    backCover: doc.backCover ? {
      ...doc.backCover,
      qr: { ...doc.backCover.qr },
      logo: { ...doc.backCover.logo },
      socialLinks: doc.backCover.socialLinks?.map(link => ({ ...link })),
    } : undefined,
    blocks: doc.blocks.map((block) =>
      block.type === 'figure' && block.frame
        ? { ...block, frame: { ...block.frame } }
        : { ...block },
    ),
    images: (doc.images ?? []).map((image) => ({
      ...image,
      anchor: { ...image.anchor },
      bleed: image.bleed ? { ...image.bleed } : undefined,
      wrapContour: image.wrapContour
        ? { top: [...image.wrapContour.top], bottom: [...image.wrapContour.bottom] }
        : undefined,
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
      frontCover: doc.design.frontCover ? { ...doc.design.frontCover, text: doc.design.frontCover.text ? Object.fromEntries(Object.entries(doc.design.frontCover.text).map(([role, style]) => [role, { ...style }])) : undefined } : undefined,
      gateTitle: doc.design.gateTitle ? { ...doc.design.gateTitle } : undefined,
      gateText: doc.design.gateText ? { ...doc.design.gateText } : undefined,
      gateTypography: doc.design.gateTypography ? Object.fromEntries(
        Object.entries(doc.design.gateTypography).map(([role, style]) => [role, { ...style }]),
      ) : undefined,
      backCover: doc.design.backCover ? {
        ...doc.design.backCover,
        text: doc.design.backCover.text ? Object.fromEntries(
          Object.entries(doc.design.backCover.text).map(([role, style]) => [role, { ...style }]),
        ) : undefined,
      } : undefined,
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
      load: (doc) => {
        set({ doc });
        // Loading a file is a new editing session. Keeping the previous
        // document in the undo stack is surprising and can resurrect unrelated
        // stories or embedded images after an import.
        useDoc.temporal.getState().clear();
      },
      switchTemplate: (id) => set((s) => {
        // A layout change is a presentation change, not a new-document action.
        // The old implementation loaded a fresh preset here, which silently
        // discarded the current title, copy, images, highlights, references,
        // assets and every editor setting (and autosave then persisted that
        // empty/preset document over the user's file). Clone the same document
        // used by normal edits and change only the active renderer.
        // Keep the no-op path only for an explicit match. Older v1 documents
        // may omit templateId; choosing Paper 1 should still normalize that
        // field without replacing the rest of the document.
        if (s.doc.templateId === id) return { doc: s.doc };
        const next = cloneDocForUpdate(s.doc);
        next.templateId = id;
        // A first visit to the dedicated back cover needs its own presentation
        // defaults, but this is deliberately limited to the new template's
        // presentation fields. Article copy, images, highlights, references
        // and the user's reading direction remain untouched.
        if (id === 'backcover-1' && !next.backCover) {
          const preset = makeBackCover();
          const direction = next.design.textDirection;
          const barSide = next.design.barSide;
          const customCss = next.design.customCss;
          next.backCover = preset.backCover ? { ...preset.backCover, brand: 'Magazoo!' } : preset.backCover;
          next.footer = preset.footer ? { ...preset.footer, text: 'Magazoo! · School of Physics' } : preset.footer;
          next.design = {
            ...preset.design,
            textDirection: direction,
            barSide,
            customCss,
          };
        }
        return { doc: next };
      }),
    }),
    {
      // Record the state before each edit immediately. Debouncing this callback
      // discarded earlier edits in a burst and could append stale history after
      // Undo had already run. Autosave can be delayed; recovery must not be.
      partialize: state => ({ doc: state.doc }),
      equality: (previous, current) => previous.doc === current.doc,
      limit: 100,
    },
  ),
);

/** Undo/redo, essentially free. */
export const useHistory = () => useDoc.temporal.getState();
