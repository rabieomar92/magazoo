import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyDoc } from '../../schema/document';
import { useDoc } from '../../store/useDoc';
import { PhotoBackgroundSection } from './PhotoBackgroundSection';

const bitmap = 'data:image/png;base64,cGhvdG8=';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixture() {
  const images: { onload: (() => void) | null; onerror: (() => void) | null }[] = [];
  vi.stubGlobal('Image', class {
    onload: (() => void) | null = null; onerror: (() => void) | null = null;
    naturalWidth = 10000; naturalHeight = 6000;
    constructor() { images.push(this); }
    set src(_value: string) { /* Explicit test load. */ }
  });
  const context = { drawImage: vi.fn(), getImageData: vi.fn(() => ({ data: [80, 100, 130, 255] })) };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const doc = emptyDoc();
  doc.assets = { photo: { src: bitmap, naturalWidth: 10000, naturalHeight: 6000 } };
  doc.hero.assetId = 'photo'; doc.design.imageTheme = true; doc.design.pageBackgroundAssetId = 'photo';
  const host = document.createElement('div'); const root = createRoot(host);
  act(() => { useDoc.setState({ doc }); root.render(<PhotoBackgroundSection />); });
  return { host, root, images, context };
}

describe('PhotoBackgroundSection', () => {
  it('samples locally, limits canvas memory, and changes the page only on Apply', () => {
    const { host, root, images, context } = fixture();
    const before = JSON.stringify(useDoc.getState().doc);
    const picker = host.querySelector<HTMLButtonElement>('.photo-background-picker')!;
    expect(picker.disabled).toBe(true);
    act(() => images[0].onload?.());
    expect(context.drawImage.mock.calls[0].slice(-2)).toEqual([512, 307]);
    expect(picker.disabled).toBe(false);
    act(() => picker.click());
    expect(host.textContent).toContain('#506482');
    expect(JSON.stringify(useDoc.getState().doc)).toBe(before);
    const apply = [...host.querySelectorAll('button')].find(button => button.textContent === 'Apply sampled page colour')!;
    act(() => apply.click());
    expect(useDoc.getState().doc.design.paperBg).toBe('#506482');
    expect(useDoc.getState().doc.design.colors.ink).toBe('#ffffff');
    expect(useDoc.getState().doc.design.pageBackgroundAssetId).toBeUndefined();
    expect(useDoc.getState().doc.design.imageTheme).toBe(false);
    expect(images).toHaveLength(1);
    act(() => root.unmount());
  });

  it('supports keyboard points and does not redecode the photograph while typing', () => {
    const { host, root, images } = fixture();
    act(() => images[0].onload?.());
    const picker = host.querySelector<HTMLButtonElement>('.photo-background-picker')!;
    act(() => picker.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(host.textContent).toContain('52% across');
    act(() => useDoc.getState().update(doc => { doc.meta.title = 'An edited title'; }));
    expect(images).toHaveLength(1);
    expect(host.textContent).toContain('#506482');
    act(() => root.unmount());
  });

  it('handles a tainted/unreadable canvas without changing saved settings', () => {
    const { host, root, images, context } = fixture();
    context.getImageData.mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    const before = JSON.stringify(useDoc.getState().doc);
    act(() => images[0].onload?.());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('cannot be sampled');
    expect(JSON.stringify(useDoc.getState().doc)).toBe(before);
    act(() => root.unmount());
  });

  it('cancels late image loads when the document/source changes', () => {
    const { root, images } = fixture();
    const staleLoad = images[0].onload;
    act(() => useDoc.getState().load(emptyDoc()));
    act(() => staleLoad?.());
    expect(useDoc.getState().doc.assets).toEqual({});
    act(() => root.unmount());
  });

  it('does not decode SVG or remote images', () => {
    const { host, root, images } = fixture();
    act(() => useDoc.getState().update(doc => { doc.assets.photo.src = 'data:image/svg+xml,<svg/>'; }));
    expect(host.textContent).toContain('instead of an SVG or linked image');
    expect(images).toHaveLength(1);
    expect(host.querySelector('.photo-background-picker')).toBeNull();
    act(() => root.unmount());
  });

  it('rejects transparent sample points without enabling Apply', () => {
    const { host, root, images, context } = fixture();
    act(() => images[0].onload?.());
    context.getImageData.mockReturnValue({ data: [255, 0, 0, 0] });
    act(() => host.querySelector<HTMLButtonElement>('.photo-background-picker')!.click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('transparent');
    expect([...host.querySelectorAll('button')].find(button => button.textContent === 'Apply sampled page colour')?.disabled).toBe(true);
    act(() => root.unmount());
  });
});
