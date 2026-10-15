import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { editorTargetId } from '../../lib/editorNavigation';
import { heroCaptionText } from '../../lib/heroCaption';
import { emptyDoc, migrate, type TemplateId } from '../../schema/document';
import { presetFor } from '../../store/presets';
import { emptyBackCover } from '../../store/backCover';
import { useDoc } from '../../store/useDoc';
import { ImagePicker, type ImageSlot } from './HeroSection';

let node: HTMLDivElement;
let root: Root;

beforeEach(() => {
  node = document.createElement('div');
  document.body.append(node);
  root = createRoot(node);
});

afterEach(() => {
  act(() => root.unmount());
  node.remove();
  useDoc.getState().load(emptyDoc());
});

function mount(templateId: TemplateId, slot: ImageSlot = 'hero', missing = false) {
  const doc = presetFor(templateId);
  doc.assets.testPhoto = { src: 'data:image/png;base64,test-photo', naturalWidth: 1200, naturalHeight: 800 };
  doc.hero = { assetId: 'testPhoto', scale: 1.4, offsetX: 7, offsetY: -8 };
  doc.cover = { ...doc.hero };
  doc.meta.heroCaption = 'Original hero description.';
  doc.meta.coverCaption = 'Original cover description.';
  if (missing) {
    doc.meta.heroCaption = '';
    doc.meta.coverCaption = '';
  }
  act(() => {
    useDoc.getState().load(doc);
    root.render(<ImagePicker slot={slot} title="Image proof" />);
  });
  return doc;
}

function edit(input: HTMLTextAreaElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const heroTemplates: TemplateId[] = [
  'paper-1', 'paper-2', 'paper-3', 'paper-4', 'paper-5', 'paper-6', 'paper-7', 'paper-8',
  'magazine-1', 'magazine-2', 'frontmatter-dean', 'frontmatter-contents',
];

describe('caption controls beside each actual primary image', () => {
  it.each(heroTemplates)('%s edits only its hero description and supports undo, redo and JSON round-trip', templateId => {
    const original = mount(templateId);
    const input = node.querySelector<HTMLTextAreaElement>(`#${editorTargetId('meta-hero-caption')} textarea`)!;
    expect(input?.value).toBe('Original hero description.');
    const text = 'Revised image description.\nA second line is preserved.';
    edit(input, text);
    const saved = useDoc.getState().doc;
    expect(saved.meta.heroCaption).toBe(text);
    expect(saved.meta.coverCaption).toBe(original.meta.coverCaption);
    expect(saved.hero).toEqual(original.hero);
    expect(saved.blocks).toEqual(original.blocks);
    expect(migrate(JSON.parse(JSON.stringify(saved))).meta.heroCaption).toBe(text);
    act(() => useDoc.temporal.getState().undo());
    expect(input.value).toBe('Original hero description.');
    act(() => useDoc.temporal.getState().redo());
    expect(input.value).toBe(text);
  });

  it.each(['magazine-1', 'magazine-3', 'magazine-4', 'frontmatter-dean', 'frontmatter-contents'] as const)('%s edits its cover description without changing its hero description', templateId => {
    mount(templateId, 'cover');
    const input = node.querySelector<HTMLTextAreaElement>(`#${editorTargetId('meta-cover-caption')} textarea`)!;
    expect(input?.value).toBe('Original cover description.');
    edit(input, 'Independent cover caption.');
    expect(useDoc.getState().doc.meta.coverCaption).toBe('Independent cover caption.');
    expect(useDoc.getState().doc.meta.heroCaption).toBe('Original hero description.');
    expect(migrate(JSON.parse(JSON.stringify(useDoc.getState().doc))).meta.coverCaption).toBe('Independent cover caption.');
  });

  it('keeps the editorial-board banner on its existing hero-caption field', () => {
    mount('frontmatter-board', 'cover');
    const input = node.querySelector<HTMLTextAreaElement>(`#${editorTargetId('meta-hero-caption')} textarea`)!;
    expect(input?.value).toBe('Original hero description.');
    expect(node.querySelector(`#${editorTargetId('meta-cover-caption')}`)).toBeNull();
    edit(input, 'Board photograph caption.');
    expect(useDoc.getState().doc.meta.heroCaption).toBe('Board photograph caption.');
    expect(heroCaptionText(useDoc.getState().doc, true)).toBe('Board photograph caption.');
  });

  it('warns about missing captions and clears the warning immediately after an author supplies one', () => {
    mount('paper-1', 'hero', true);
    expect(node.querySelector('[role="status"]')?.textContent).toContain('This image has no caption yet');
    const input = node.querySelector<HTMLTextAreaElement>(`#${editorTargetId('meta-hero-caption')} textarea`)!;
    edit(input, 'A verified, author-supplied description.');
    expect(node.querySelector('[role="status"]')).toBeNull();
    edit(input, '  \n  ');
    expect(node.querySelector('[role="status"]')?.textContent).toContain('This image has no caption yet');
  });

  it('does not ask for captions on signatures, publication logos or QR codes', () => {
    const doc = mount('frontmatter-dean');
    doc.frontMatter!.signature = { ...doc.hero };
    doc.frontMatter!.logo = { ...doc.hero };
    doc.backCover = emptyBackCover();
    doc.backCover.qr = { ...doc.hero };
    doc.backCover.logo = { ...doc.hero };
    for (const slot of ['frontmatter-signature', 'frontmatter-logo', 'backcover-qr', 'backcover-logo'] as const) {
      act(() => {
        useDoc.getState().load(doc);
        root.render(<ImagePicker slot={slot} title="Image proof" />);
      });
      expect(node.querySelector('textarea')).toBeNull();
      expect(node.querySelector('[role="status"]')).toBeNull();
    }
  });
});
