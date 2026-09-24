import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GallerySection } from './GallerySection';
import { GalleryPage } from '../../paper/GalleryPage';
import { useDoc } from '../../store/useDoc';
import { presetFor } from '../../store/presets';
import { migrate, type TemplateId } from '../../schema/document';
import { loadImage } from '../../lib/loadImage';

vi.mock('../../lib/loadImage', async original => ({ ...await original<typeof import('../../lib/loadImage')>(), loadImage: vi.fn() }));

let host: HTMLDivElement;
let root: Root;
function Preview() {
  const doc = useDoc(state => state.doc);
  return <GalleryPage doc={doc} vars={{}} />;
}
const figures = () => useDoc.getState().doc.blocks.filter(block => block.type === 'figure');
const cards = () => useDoc.getState().doc.blocks.filter(block => block.type !== 'figure');
function render(template: TemplateId) {
  const doc = presetFor(template);
  doc.blocks = doc.blocks.filter(block => block.type !== 'figure');
  act(() => {
    useDoc.getState().load(doc);
    root.render(<><GallerySection /><Preview /></>);
  });
  return doc;
}
function choose(slot: number, file: File | null = new File(['sample'], 'photo.png', { type: 'image/png' })) {
  host.querySelectorAll<HTMLElement>('.gallery-slot')[slot].querySelector<HTMLButtonElement>('button')!.click();
  const input = host.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: file ? [file] : [] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
async function upload(slot: number, src: string) {
  vi.mocked(loadImage).mockResolvedValue({ src, naturalWidth: 1200, naturalHeight: 800 });
  await act(async () => choose(slot));
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe('independent gallery image slots', () => {
  it.each([
    ['gallery-1', 5, 1], ['gallery-2', 7, 0], ['gallery-3', 8, 0], ['gallery-4', 5, 0],
  ] as const)('uploads the last tile first in %s and preserves skipped slots through save and undo', async (template, count, fold) => {
    const original = render(template);
    const originalCards = structuredClone(cards());
    const targets = [...host.querySelectorAll<HTMLElement>('.gallery .g-img')].map(tile => tile.dataset.editorTarget!);
    expect(new Set(targets).size).toBe(count);
    expect(targets.filter(target => target === `gallery-image-slot-${fold}`)).toHaveLength(2);
    for (const target of targets) expect(host.querySelector(`#editor-target-${target}`)).not.toBeNull();
    expect(host.querySelectorAll('.gallery .g-img img')).toHaveLength(0);

    await upload(count - 1, 'data:image/png;base64,last');
    const last = structuredClone(figures()[count - 1]);
    expect(figures()).toHaveLength(count);
    expect(figures().slice(0, -1).every(figure => figure.assetId === '')).toBe(true);
    const slotPanels = [...host.querySelectorAll('.gallery-slot')];
    for (const emptySlot of slotPanels.slice(0, -1)) {
      expect(emptySlot.querySelector('input, textarea')).toBeNull();
      expect(emptySlot.textContent).toContain('No image');
    }
    expect(slotPanels[count - 1].querySelector('textarea')).not.toBeNull();
    expect(host.querySelectorAll('.gallery .g-img img')).toHaveLength(1);
    expect(host.querySelector(`.gallery [data-editor-target="gallery-image-${last.id}"] img`)?.getAttribute('src')).toBe('data:image/png;base64,last');
    expect(cards()).toEqual(originalCards);
    const saved = JSON.stringify(useDoc.getState().doc);
    expect(migrate(JSON.parse(saved)).blocks).toEqual(useDoc.getState().doc.blocks);
    act(() => useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc).toEqual(original);
    act(() => useDoc.temporal.getState().redo());
    expect(figures()[count - 1]).toEqual(last);

    await upload(fold, 'data:image/png;base64,fold');
    expect(host.querySelectorAll('.gallery .g-fold img')).toHaveLength(2);
    expect(figures()[count - 1]).toEqual(last);
    expect(cards()).toEqual(originalCards);
    expect(figures().filter(figure => !!figure.assetId)).toHaveLength(2);
  });

  it('replaces a chosen photo without losing captions, framing, or shared assets', async () => {
    render('gallery-3');
    await upload(7, 'data:image/png;base64,shared');
    const old = figures()[7].assetId;
    act(() => useDoc.getState().update(doc => {
      const slots = doc.blocks.filter(block => block.type === 'figure');
      slots[0].assetId = old;
      slots[7].caption = '**Keep caption**';
      slots[7].frame = { scale: 1.5, offsetX: 12, offsetY: -8 };
    }));
    const before = structuredClone(figures());
    await upload(7, 'data:image/png;base64,replacement');
    expect(figures().slice(0, 7)).toEqual(before.slice(0, 7));
    expect(figures()[7]).toEqual({ ...before[7], assetId: figures()[7].assetId });
    expect(figures()[7].assetId).not.toBe(old);
    expect(useDoc.getState().doc.assets[old]).toBeDefined();
  });

  it('creates no empty blocks or assets for a cancelled or failed upload', async () => {
    const doc = render('gallery-3');
    await act(async () => choose(7, null));
    expect(useDoc.getState().doc).toBe(doc);
    vi.mocked(loadImage).mockRejectedValue(new Error('broken file'));
    await act(async () => choose(7));
    expect(useDoc.getState().doc).toBe(doc);
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Failed to load image');
  });

  it('does not place a pending gallery upload in a different document', async () => {
    render('gallery-3');
    let finish!: (value: Awaited<ReturnType<typeof loadImage>>) => void;
    vi.mocked(loadImage).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    act(() => choose(7));
    const next = presetFor('gallery-4');
    act(() => useDoc.getState().load(next));
    await act(async () => finish({ src: 'new', naturalWidth: 600, naturalHeight: 400 }));
    expect(useDoc.getState().doc).toBe(next);
    expect(host.querySelector('[role=alert]')?.textContent).toContain('document changed');
  });
});
