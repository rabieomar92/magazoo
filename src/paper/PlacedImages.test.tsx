import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { presetFor } from '../store/presets';
import { articleGridDesign } from '../lib/articleLayouts';
import { placedHighlightsGeometry } from '../lib/placedHighlights';
import { grid } from '../lib/geometry';
import { placedImageGeometry } from '../lib/placedImage';
import { useDoc } from '../store/useDoc';
import { PlacedImages } from './PlacedImages';
import { PreviewReadOnly, PreviewPreserveSourceAnchors } from './PreviewReadOnly';

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

  it('materialises the default free highlights placement so autosave can retain it', () => {
    const doc = emptyDoc();
    doc.design.sidebar = true;
    doc.design.highlightsPlacement = 'free';
    doc.highlights = ['Keep this highlight'];
    useDoc.getState().load(doc);

    const host = document.createElement('div');
    host.className = 'page';
    document.body.append(host);
    Object.defineProperty(host, 'offsetWidth', { configurable: true, value: 420 });
    host.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 420, bottom: 594, width: 420, height: 594,
      toJSON: () => ({}),
    });
    const root = createRoot(host);

    act(() => {
      root.render(<PlacedImages doc={useDoc.getState().doc} pageIndex={0} />);
    });

    expect(host.querySelector('.placed-highlights')).not.toBeNull();
    expect(useDoc.getState().doc.highlightBox).toEqual(expect.objectContaining({
      widthCols: 2,
      anchor: expect.objectContaining({ page: 1 }),
    }));
    expect(useDoc.getState().doc.highlights).toEqual(['Keep this highlight']);

    act(() => root.unmount());
    host.remove();
  });
  it('measures native magazine image dragging in the same physical millimetres as the sheet', () => {
    const doc = emptyDoc();
    doc.design.pageFormat = 'magazine';
    doc.design.sidebar = false;
    doc.assets.asset = { src: 'data:image/png;base64,', naturalWidth: 800, naturalHeight: 400 };
    doc.images = [{ id: 'native', assetId: 'asset', caption: '', widthCols: 2,
      anchor: { page: 1, column: 0, y: 20 } }];
    useDoc.getState().load(doc);
    const host = document.createElement('div');
    host.className = 'page';
    document.body.append(host);
    host.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 406, bottom: 534,
      width: 406, height: 534, toJSON: () => ({}) });
    const root = createRoot(host);
    act(() => root.render(<PlacedImages doc={useDoc.getState().doc} pageIndex={0} />));
    const placed = host.querySelector<HTMLElement>('.placed-image')!;
    act(() => {
      placed.dispatchEvent(pointerEvent('pointerdown', 10, 40));
      placed.dispatchEvent(pointerEvent('pointermove', 10, 80));
    });
    expect(useDoc.getState().doc.images[0].anchor.y).toBe(20);
    act(() => placed.dispatchEvent(pointerEvent('pointerup', 10, 80)));
    expect(useDoc.getState().doc.images[0].anchor.y).toBe(40);
    act(() => root.unmount());
    host.remove();
  });

  it.each([
    ['native', 'magazine', false],
    ['A4 round trip', undefined, true],
  ] as const)('does not materialise or clamp stored highlights while rendering a %s output proof', (_label, pageFormat, preserve) => {
    for (const existing of [false, true]) {
      const doc = emptyDoc();
      doc.design.sidebar = true;
      doc.design.highlightsPlacement = 'free';
      doc.highlights = ['Keep the original source anchors'];
      if (existing) doc.highlightBox = { widthCols: 2, anchor: { page: 1, column: 0, y: 999 } };
      useDoc.getState().load(doc);
      const original = useDoc.getState().doc;
      const before = JSON.stringify(original);
      const proof = { ...original, design: { ...original.design, pageFormat } };
      const host = document.createElement('div');
      host.className = 'page';
      document.body.append(host);
      Object.defineProperty(host, 'offsetWidth', { configurable: true, value: 406 });
      host.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 406, bottom: 534,
        width: 406, height: 534, toJSON: () => ({}) });
      const root = createRoot(host);
      act(() => root.render(<PreviewPreserveSourceAnchors.Provider value={preserve}>
        <PlacedImages doc={proof} pageIndex={0} />
      </PreviewPreserveSourceAnchors.Provider>));
      expect(host.querySelector('.placed-highlights')).not.toBeNull();
      expect(JSON.stringify(useDoc.getState().doc)).toBe(before);
      act(() => root.unmount());
      host.remove();
    }
  });

  it('still saves an intentional highlight drag in a native source-preserving proof', () => {
    const doc = emptyDoc();
    doc.design.sidebar = true;
    doc.design.highlightsPlacement = 'free';
    doc.highlights = ['Deliberate dragging remains editable'];
    doc.highlightBox = { widthCols: 2, anchor: { page: 1, column: 0, y: 30 } };
    useDoc.getState().load(doc);
    const original = useDoc.getState().doc;
    const proof = { ...original, design: { ...original.design, pageFormat: 'magazine' as const } };
    const host = document.createElement('div');
    host.className = 'page';
    document.body.append(host);
    host.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 406, bottom: 534,
      width: 406, height: 534, toJSON: () => ({}) });
    const root = createRoot(host);
    act(() => root.render(<PreviewPreserveSourceAnchors.Provider value={true}>
      <PlacedImages doc={proof} pageIndex={0} />
    </PreviewPreserveSourceAnchors.Provider>));
    const box = host.querySelector<HTMLElement>('.placed-highlights')!;
    box.getBoundingClientRect = () => ({ x: 0, y: 60, left: 0, top: 60, right: 180, bottom: 140,
      width: 180, height: 80, toJSON: () => ({}) });
    act(() => {
      box.dispatchEvent(pointerEvent('pointerdown', 40, 70));
      box.dispatchEvent(pointerEvent('pointermove', 40, 110));
    });
    expect(useDoc.getState().doc.highlightBox?.anchor.y).toBe(30);
    act(() => box.dispatchEvent(pointerEvent('pointerup', 40, 110)));
    expect(useDoc.getState().doc.highlightBox?.anchor.y).toBe(50);
    expect(useDoc.getState().doc.design.pageFormat).toBeUndefined();
    act(() => root.unmount());
    host.remove();
  });

  it.each(['paper-4','paper-5','paper-6','paper-7','paper-8'] as const)('%s drags the shared box, saves it and undoes it independently', template=> {
    const doc=presetFor(template);doc.design.highlightsPlacement='free';
    doc.highlightBox={widthCols:2,anchor:{page:1,column:0,y:30}};
    useDoc.getState().load(doc);
    const host=document.createElement('div');host.className='page';document.body.append(host);
    host.getBoundingClientRect=()=>({left:0,top:0,right:420,bottom:552,width:420,height:552,x:0,y:0,toJSON:()=>({})});
    const root=createRoot(host);
    act(()=>root.render(<PlacedImages doc={useDoc.getState().doc} pageIndex={0} pageHeight={276}/>));
    const box=host.querySelector<HTMLElement>('.placed-highlights')!;
    box.getBoundingClientRect=()=>({left:28,top:60,right:206,bottom:140,width:178,height:80,x:28,y:60,toJSON:()=>({})});
    act(()=>{box.dispatchEvent(pointerEvent('pointerdown',40,70));box.dispatchEvent(pointerEvent('pointermove',1000,1000));});
    expect(useDoc.getState().doc.highlightBox).toEqual(doc.highlightBox);
    act(()=>box.dispatchEvent(pointerEvent('pointerup',1000,1000)));
    const moved=useDoc.getState().doc.highlightBox!;
    expect(moved.anchor).toEqual({page:1,column:2,y:236});
    expect(placedHighlightsGeometry(moved,articleGridDesign(doc.design),40,276).width).toBe(89);
    act(()=>useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc.highlightBox).toEqual(doc.highlightBox);
    act(()=>useDoc.temporal.getState().redo());
    expect(useDoc.getState().doc.highlightBox).toEqual(moved);
    act(()=>root.unmount());host.remove();
  });

  it('never writes a read-only or measuring document into the open editor',()=> {
    const editor=emptyDoc();editor.meta.title='User’s open draft';
    useDoc.getState().load(editor);
    const other=presetFor('paper-4');other.design.highlightsPlacement='free';delete other.highlightBox;
    const host=document.createElement('div');host.className='page';document.body.append(host);
    const root=createRoot(host);
    const before=JSON.stringify(useDoc.getState().doc);
    act(()=>root.render(<PreviewReadOnly.Provider value={true}><PlacedImages doc={other} pageIndex={0} pageHeight={276}/></PreviewReadOnly.Provider>));
    expect(host.querySelector('.placed-highlights')).not.toBeNull();
    expect(JSON.stringify(useDoc.getState().doc)).toBe(before);
    act(()=>root.render(<PlacedImages doc={other} pageIndex={0} pageHeight={276} readOnly includeHighlights={false}/>));
    expect(host.querySelector('.placed-highlights')).toBeNull();
    act(()=>root.unmount());host.remove();
  });
});
