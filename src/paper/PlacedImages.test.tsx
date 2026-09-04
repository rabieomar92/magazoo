import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { grid } from '../lib/geometry';
import { placedImageGeometry } from '../lib/placedImage';
import { useDoc } from '../store/useDoc';
import { PlacedImages } from './PlacedImages';

const pointerEvent = (type: string, x: number, y: number) => {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: 7 });
  return event;
};

describe('PlacedImages', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperties(HTMLElement.prototype, {
      setPointerCapture: { configurable: true, value: () => undefined },
      hasPointerCapture: { configurable: true, value: () => true },
      releasePointerCapture: { configurable: true, value: () => undefined },
    });
  });

  afterEach(() => useDoc.getState().load(emptyDoc()));

  it('snaps horizontal dragging and clamps vertical dragging to the page', () => {
    const doc = emptyDoc();
    doc.assets.asset = { src: 'data:image/png;base64,', naturalWidth: 800, naturalHeight: 400 };
    doc.images.push({
      id: 'placed',
      assetId: 'asset',
      caption: '',
      widthCols: 2,
      anchor: { page: 1, column: 0, y: 20 },
    });
    useDoc.getState().load(doc);

    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    act(() => {
      root.render(
        <div className="page">
          <PlacedImages doc={useDoc.getState().doc} pageIndex={0} />
        </div>,
      );
    });

    const page = host.querySelector<HTMLElement>('.page')!;
    page.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 420,
      bottom: 594,
      width: 420,
      height: 594,
      toJSON: () => ({}),
    });
    const placed = host.querySelector<HTMLElement>('.placed-image')!;

    act(() => {
      placed.dispatchEvent(pointerEvent('pointerdown', 50, 50));
      placed.dispatchEvent(pointerEvent('pointermove', 1000, 1000));
    });

    // Pointer movement is DOM-only: no full document clone/re-pagination until
    // the gesture finishes.
    expect(useDoc.getState().doc.images[0].anchor).toEqual({ page: 1, column: 0, y: 20 });

    act(() => {
      placed.dispatchEvent(pointerEvent('pointerup', 1000, 1000));
    });

    const current = useDoc.getState().doc;
    const moved = current.images[0];
    const geometry = placedImageGeometry(moved, current.assets.asset, current.design);
    expect(moved.anchor.column).toBe(grid(current.design).totalCols - moved.widthCols);
    expect(moved.anchor.y).toBe(Math.round(geometry.maxTop * 10) / 10);

    act(() => root.unmount());
    host.remove();
  });
});
