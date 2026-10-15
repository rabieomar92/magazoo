import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { draggedValue, useVerticalDrag } from './useVerticalDrag';
import { clampGate } from '../lib/gatePlacement';
import { clampSpacing, COVER_STORY_GAP } from '../lib/spacing';
import { presetFor } from '../store/presets';
import { MagGateA, MagGateB } from './MagGate';
import { MagazineFrontCover } from './MagazineFrontCover';

const gate = (value: number) => clampGate(value, 0, 260);

describe('dragging a cover block', () => {
  it('converts pointer travel into page millimetres', () => {
    // A 64% preview of an A4 sheet: 793.7 device pixels across 210mm.
    const pxPerMm = 793.7 / 210;
    expect(draggedValue(116.1, 0, pxPerMm, gate)).toBe(116.1);
    expect(draggedValue(116.1, -113.4, pxPerMm, gate)).toBe(86.1);
    expect(draggedValue(110.6, 94.5, pxPerMm, gate)).toBe(135.6);
    // Zoom cancels out: the same gesture at a different scale moves the same
    // distance on the printed sheet.
    expect(draggedValue(50, 200, 2 * pxPerMm, gate)).toBe(draggedValue(50, 100, pxPerMm, gate));
  });
  it('never leaves the sheet, whatever the gesture', () => {
    const pxPerMm = 3.78;
    expect(draggedValue(20, -10_000, pxPerMm, gate)).toBe(0);
    expect(draggedValue(200, 10_000, pxPerMm, gate)).toBe(260);
    const story = (v: number) => clampSpacing(v, COVER_STORY_GAP, 15);
    expect(draggedValue(15, -10_000, pxPerMm, story)).toBe(COVER_STORY_GAP.min);
    expect(draggedValue(15, 10_000, pxPerMm, story)).toBe(COVER_STORY_GAP.max);
  });
  it('reports the starting value when the sheet has no measurable width', () => {
    expect(draggedValue(42, 500, 0, gate)).toBe(42);
  });
  it.each([203, 210])('uses the rendered %smm sheet width rather than an assumed A4 width', width => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    let committed: number | undefined;
    function Handle() {
      const drag = useVerticalDrag({ start: () => 50, clamp: value => value, commit: value => { committed = value; } });
      return <div className="page" data-page-width-mm={width}><div className="handle" {...drag.handlers} /></div>;
    }
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(<Handle />));
    const page = host.querySelector<HTMLElement>('.page')!;
    page.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: width * 2, bottom: 534,
      width: width * 2, height: 534, toJSON: () => ({}) });
    const handle = host.querySelector<HTMLElement>('.handle')!;
    handle.setPointerCapture = () => {};
    handle.releasePointerCapture = () => {};
    const pointer = (type: string, y: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientY: y });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      return event;
    };
    act(() => {
      handle.dispatchEvent(pointer('pointerdown', 20));
      handle.dispatchEvent(pointer('pointermove', 60));
    });
    expect(committed).toBeUndefined();
    expect(handle.style.transform).toBe('translateY(20.00mm)');
    act(() => handle.dispatchEvent(pointer('pointerup', 60)));
    expect(committed).toBe(70);
    act(() => root.unmount());
    host.remove();
  });
});

describe('cover blocks offer the handle', () => {
  it('marks the gatefold title and facing text as draggable', () => {
    const doc = presetFor('magazine-3');
    expect(renderToStaticMarkup(<MagGateA doc={doc} vars={{}} />)).toContain('mag-gate-mid--draggable');
    expect(renderToStaticMarkup(<MagGateB doc={doc} vars={{}} />)).toContain('mag-gate-mid--draggable');
  });
  it('marks the front cover story block as draggable', () => {
    const doc = presetFor('magazine-4');
    expect(renderToStaticMarkup(<MagazineFrontCover doc={doc} vars={{}} />)).toContain('front-cover-story--draggable');
  });
});
