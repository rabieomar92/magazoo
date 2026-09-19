import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDoc } from '../../store/useDoc';
import { makeFrontMatter } from '../../store/frontMatter';
import { detectSignatureCrop } from '../../lib/signature';
import { loadImage } from '../../lib/loadImage';
import { SignatureSection } from './SignatureSection';

vi.mock('../../lib/signature', async importOriginal => ({ ...await importOriginal<typeof import('../../lib/signature')>(), detectSignatureCrop: vi.fn() }));
vi.mock('../../lib/loadImage', async importOriginal => ({ ...await importOriginal<typeof import('../../lib/loadImage')>(), loadImage: vi.fn() }));

let host: HTMLDivElement;
let root: Root;
const crop = { x: .1, y: .2, width: .8, height: .6 };
const button = (name: string) => [...host.querySelectorAll('button')].find(b => b.textContent === name)!;
const number = (name: string) => [...host.querySelectorAll('label')].find(l => l.textContent?.startsWith(name))!.querySelector('input')!;
const changeNumber = (name: string, value: string) => act(() => {
  const input = number(name);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const upload = () => {
  const input = host.querySelector('input[type="file"]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['sample'], 'signature.png', { type: 'image/png' })] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  const doc = makeFrontMatter('frontmatter-dean');
  doc.assets.sig = { src: 'data:image/png;base64,sample', naturalWidth: 1200, naturalHeight: 300 };
  doc.frontMatter!.signature = { assetId: 'sig', scale: 3, offsetX: 50, offsetY: 50 };
  act(() => { useDoc.getState().load(doc); root.render(<SignatureSection />); });
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('signature editor', () => {
  it('offers one size control and one navigation target, with no competing crop/zoom sliders', () => {
    expect(host.querySelectorAll('#editor-target-image-signature')).toHaveLength(1);
    expect(host.querySelectorAll('input[type="range"]')).toHaveLength(0);
    changeNumber('Signature width', '49.5');
    act(() => button('End').click());
    changeNumber('Space above signature', '6');
    expect(useDoc.getState().doc.frontMatter).toMatchObject({ signatureWidth: 49.5, signatureAlign: 'end', signatureGap: 6 });
    expect(host.textContent).toContain('49.5 × 12.4 mm');
    act(() => button('Reset size & spacing').click());
    expect(useDoc.getState().doc.frontMatter).toMatchObject({ signatureWidth: 34, signatureAlign: 'start', signatureGap: 2 });
  });
  it('trims and restores reversibly, supports undo, and never changes the embedded pixels', async () => {
    const original = useDoc.getState().doc.assets.sig.src;
    vi.mocked(detectSignatureCrop).mockResolvedValue(crop);
    await act(async () => button('Trim blank margins').click());
    expect(useDoc.getState().doc.frontMatter!.signatureCrop).toEqual(crop);
    expect(host.querySelector('.signature-art')?.getAttribute('viewBox')).toBe('120 60 960 180');
    act(() => button('Restore full image').click());
    expect(useDoc.getState().doc.frontMatter!.signatureCrop).toBeUndefined();
    act(() => useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc.frontMatter!.signatureCrop).toEqual(crop);
    expect(useDoc.getState().doc.assets.sig.src).toBe(original);
  });
  it('preserves the full scan when no ink is detected', async () => {
    vi.mocked(detectSignatureCrop).mockResolvedValue(null);
    await act(async () => button('Trim blank margins').click());
    expect(useDoc.getState().doc.frontMatter!.signatureCrop).toBeUndefined();
    expect(host.textContent).toContain('No dark signature was detected');
  });
  it('clears the old crop on replacement and retains an asset still used by another slot', async () => {
    act(() => useDoc.getState().update(d => { d.frontMatter!.signatureCrop = crop; d.cover!.assetId = 'sig'; }));
    vi.mocked(loadImage).mockResolvedValue({ src: 'data:image/png;base64,new', naturalWidth: 900, naturalHeight: 100 });
    await act(async () => upload());
    const doc = useDoc.getState().doc;
    expect(doc.frontMatter!.signatureCrop).toBeUndefined();
    expect(doc.frontMatter!.signature?.assetId).not.toBe('sig');
    expect(doc.assets.sig).toBeDefined();
    expect(doc.frontMatter!.signatureWidth).toBe(34);
  });
  it('does not apply an unfinished upload to a newly opened document', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof loadImage>>) => void;
    vi.mocked(loadImage).mockReturnValue(new Promise(done => { resolve = done; }));
    act(() => upload());
    const next = makeFrontMatter('frontmatter-dean');
    act(() => useDoc.getState().load(next));
    await act(async () => resolve({ src: 'new', naturalWidth: 900, naturalHeight: 100 }));
    expect(useDoc.getState().doc).toBe(next);
    expect(host.textContent).toContain('document changed');
  });
});
