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
import {requestImageOutline} from '../lib/imageCanvas';

const pointerEvent = (type: string, x: number, y: number) => {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: 7 });
  return event;
};

describe('PlacedImages', () => {
  it.each(['paper-1','paper-2','paper-3','paper-4','paper-5','paper-6','paper-7','paper-8','magazine-1','magazine-2','magazine-3'] as const)('%s retains an explicitly placed caption inside the image frame in editor and compilation',template=>{
    const doc=presetFor(template);doc.design.sidebar=false;doc.assets.art={src:'data:image/png;base64,AA',naturalWidth:500,naturalHeight:500};
    doc.images=[{id:'inside',assetId:'art',caption:'In the empty area beside the subject',widthCols:2,heightMm:80,anchor:{page:1,column:0,y:100},wrapShape:'polygon',wrapPolygon:[{x:60,y:0},{x:100,y:0},{x:100,y:100}],captionPlacement:{x:25,y:110,widthMm:25}}];
    const host=document.createElement('div'),root=createRoot(host);document.body.append(host);
    for(const readOnly of [false,true]){
      act(()=>root.render(<div className="page"><PlacedImages doc={doc} pageIndex={0} readOnly={readOnly}/></div>));
      const figure=host.querySelector<HTMLElement>('.placed-image')!,caption=host.querySelector<HTMLElement>('figcaption')!;
      expect(parseFloat(figure.style.left)+parseFloat(caption.style.left)).toBeCloseTo(25);
      expect(parseFloat(figure.style.top)+parseFloat(caption.style.top)).toBeCloseTo(110);
      expect(caption.dataset.captionUnplaced).toBe('false');
    }
    expect(doc.images[0].captionPlacement).toEqual({x:25,y:110,widthMm:25});act(()=>root.unmount());host.remove();
  });
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

  it('treats a click as selection, cancels incomplete drags, and allows keyboard positioning',()=>{
    const doc=emptyDoc();doc.design.sidebar=false;
    doc.assets.art={src:'',naturalWidth:200,naturalHeight:200};
    doc.images=[{id:'gesture',assetId:'art',caption:'',widthCols:1,heightMm:40,anchor:{page:1,column:0,y:50}}];
    useDoc.getState().load(doc);useDoc.temporal.getState().clear();
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
    act(()=>root.render(<div className="page"><PlacedImages doc={useDoc.getState().doc} pageIndex={0}/></div>));
    const page=host.querySelector<HTMLElement>('.page')!,image=host.querySelector<HTMLElement>('.placed-image')!;
    page.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,width:420,height:594,right:420,bottom:594,toJSON(){}});
    const original=image.getAttribute('style');
    act(()=>{image.dispatchEvent(pointerEvent('pointerdown',10,10));image.dispatchEvent(pointerEvent('pointermove',11,11));image.dispatchEvent(pointerEvent('pointerup',11,11));});
    expect(useDoc.temporal.getState().pastStates).toHaveLength(0);
    act(()=>{image.dispatchEvent(pointerEvent('pointerdown',10,10));image.dispatchEvent(pointerEvent('pointermove',10,90));});
    expect(image.dataset.dragging).toBe('true');
    act(()=>image.dispatchEvent(pointerEvent('pointercancel',10,90)));
    expect(image.getAttribute('style')).toBe(original);
    expect(useDoc.getState().doc.images[0].anchor.y).toBe(50);
    expect(useDoc.temporal.getState().pastStates).toHaveLength(0);
    const button=host.querySelector<HTMLButtonElement>('[aria-label="Move image"]')!;
    expect(button.dataset.editorOnly).toBe('true');
    act(()=>button.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',shiftKey:true,bubbles:true})));
    expect(useDoc.getState().doc.images[0].anchor.y).toBe(55);
    expect(useDoc.temporal.getState().pastStates).toHaveLength(1);
    act(()=>useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc.images[0].anchor.y).toBe(50);
    act(()=>root.unmount());host.remove();
  });

  it('does not expose move controls or save image gestures in read-only mode',()=>{
    const doc=emptyDoc();doc.assets.art={src:'',naturalWidth:200,naturalHeight:200};
    doc.images=[{id:'readonly-image',assetId:'art',caption:'',widthCols:1,anchor:{page:1,column:0,y:30}}];
    useDoc.getState().load(doc);useDoc.temporal.getState().clear();
    const host=document.createElement('div'),root=createRoot(host);
    act(()=>root.render(<div className="page"><PreviewReadOnly.Provider value={true}><PlacedImages doc={doc} pageIndex={0}/></PreviewReadOnly.Provider></div>));
    const image=host.querySelector<HTMLElement>('.placed-image')!;
    expect(image.dataset.imageReadonly).toBe('true');
    expect(image.querySelector('button')).toBeNull();
    act(()=>requestImageOutline('readonly-image'));
    expect(document.querySelector('.canvas-outline-tools')).toBeNull();
    act(()=>{image.dispatchEvent(pointerEvent('pointerdown',10,10));image.dispatchEvent(pointerEvent('pointermove',90,90));image.dispatchEvent(pointerEvent('pointerup',90,90));});
    expect(useDoc.getState().doc.images[0].anchor.y).toBe(30);
    expect(useDoc.temporal.getState().pastStates).toHaveLength(0);
    act(()=>root.unmount());
  });

  it('opens drawing from the canvas button without capturing it as an image drag',()=>{
    const doc=emptyDoc();doc.design.sidebar=false;doc.assets.art={src:'',naturalWidth:200,naturalHeight:200};
    doc.images=[{id:'draw-on-canvas',assetId:'art',caption:'',widthCols:1,anchor:{page:1,column:0,y:60}}];
    useDoc.getState().load(doc);useDoc.temporal.getState().clear();
    const host=document.createElement('div'),root=createRoot(host);document.body.append(host);
    act(()=>root.render(<div className="page"><PlacedImages doc={doc} pageIndex={0}/></div>));
    const image=host.querySelector<HTMLElement>('.placed-image')!;
    let captured=false;Object.defineProperty(image,'setPointerCapture',{value:()=>{captured=true;}});
    const button=host.querySelector<HTMLButtonElement>('.placed-image-draw')!;
    act(()=>{button.dispatchEvent(pointerEvent('pointerdown',20,20));button.click();});
    expect(captured).toBe(false);expect(host.querySelector('[aria-label="Edit polygon points"]')).not.toBeNull();
    expect(useDoc.temporal.getState().pastStates).toHaveLength(0);
    act(()=>document.querySelector<HTMLButtonElement>('.canvas-outline-apply')!.click());
    expect(useDoc.getState().doc.images[0].wrapShape).toBe('polygon');
    expect(useDoc.temporal.getState().pastStates).toHaveLength(1);
    expect(document.querySelector('.canvas-outline-tools')).toBeNull();
    act(()=>useDoc.temporal.getState().undo());expect(useDoc.getState().doc.images[0].wrapShape).toBeUndefined();
    act(()=>root.unmount());host.remove();
  });

  it.each(['left','right'] as const)('resizes the caption from its %s canvas handle with one undoable save',side=>{
    const doc=emptyDoc();doc.design.sidebar=false;doc.assets.art={src:'',naturalWidth:200,naturalHeight:200};
    doc.images=[{id:'resize',assetId:'art',caption:'Exact caption text',widthCols:1,heightMm:30,anchor:{page:1,column:0,y:120}}];
    useDoc.getState().load(doc);useDoc.temporal.getState().clear();
    const host=document.createElement('div'),root=createRoot(host);document.body.append(host);
    act(()=>root.render(<div className="page"><PlacedImages doc={useDoc.getState().doc} pageIndex={0}/></div>));
    const page=host.querySelector<HTMLElement>('.page')!,cap=host.querySelector<HTMLElement>('figcaption')!;
    page.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,width:420,height:594,right:420,bottom:594,toJSON(){}});
    cap.getBoundingClientRect=()=>({x:240,y:80,left:240,top:80,width:80,height:20,right:320,bottom:100,toJSON(){}});
    Object.defineProperty(cap,'offsetHeight',{value:20});
    const handle=host.querySelector<HTMLButtonElement>(`[aria-label="Resize caption from ${side}"]`)!;
    const start=side==='left'?240:320,end=side==='left'?220:360;
    act(()=>{handle.dispatchEvent(pointerEvent('pointerdown',start,90));handle.dispatchEvent(pointerEvent('pointermove',end,90));});
    expect(useDoc.getState().doc.images[0].captionPlacement).toBeUndefined();
    expect(useDoc.temporal.getState().pastStates).toHaveLength(0);
    act(()=>handle.dispatchEvent(pointerEvent('pointerup',end,90)));
    const saved=useDoc.getState().doc.images[0];
    expect(saved.captionPlacement).toMatchObject(side==='left'?{x:110,y:40,widthMm:50}:{x:120,y:40,widthMm:60});
    expect(saved.caption).toBe('Exact caption text');expect(saved.anchor).toEqual(doc.images[0].anchor);
    expect(useDoc.temporal.getState().pastStates).toHaveLength(1);
    act(()=>useDoc.temporal.getState().undo());expect(useDoc.getState().doc.images[0].captionPlacement).toBeUndefined();
    act(()=>root.unmount());host.remove();
  });

  it.each(['move','resize'] as const)('restores caption fit status and geometry when a %s gesture is canceled',kind=>{
    const doc=emptyDoc();doc.design.sidebar=false;doc.assets.art={src:'data:image/png;base64,AA',naturalWidth:200,naturalHeight:200};
    doc.images=[{id:'cancel-caption',assetId:'art',caption:'Unchanged caption',widthCols:1,anchor:{page:1,column:0,y:120}}];
    useDoc.getState().load(doc);useDoc.temporal.getState().clear();
    const host=document.createElement('div'),root=createRoot(host);document.body.append(host);
    act(()=>root.render(<div className="page"><PlacedImages doc={doc} pageIndex={0}/></div>));
    const page=host.querySelector<HTMLElement>('.page')!,cap=host.querySelector<HTMLElement>('figcaption')!;
    page.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,width:420,height:594,right:420,bottom:594,toJSON(){}});
    cap.getBoundingClientRect=()=>({x:240,y:80,left:240,top:80,width:80,height:2000,right:320,bottom:2080,toJSON(){}});
    Object.defineProperty(cap,'offsetHeight',{value:10000});
    const before=cap.getAttribute('style'),target=kind==='move'?cap:cap.querySelector<HTMLElement>('[aria-label="Resize caption from right"]')!;
    act(()=>{target.dispatchEvent(pointerEvent('pointerdown',320,90));target.dispatchEvent(pointerEvent('pointermove',360,110));});
    expect(cap.dataset.captionUnplaced).toBe('true');
    act(()=>target.dispatchEvent(pointerEvent('pointercancel',360,110)));
    expect(cap.getAttribute('style')).toBe(before);expect(cap.dataset.captionUnplaced).toBeUndefined();
    expect(useDoc.temporal.getState().pastStates).toHaveLength(0);
    expect(useDoc.getState().doc.images[0].captionPlacement).toBeUndefined();
    act(()=>root.unmount());host.remove();
  });

  it('keeps a freeform caption below the visible subject and outside the clipped frame',()=>{
    const doc=emptyDoc();doc.design.sidebar=false;
    doc.assets.art={src:'data:image/png;base64,',naturalWidth:500,naturalHeight:500};
    doc.images=[{id:'cutout',assetId:'art',caption:'Protected caption',widthCols:2,heightMm:100,anchor:{page:1,column:0,y:100},wrapShape:'polygon',wrapPolygon:[{x:0,y:0},{x:100,y:0},{x:100,y:80},{x:0,y:80}]}];
    const host=document.createElement('div'),root=createRoot(host);
    act(()=>root.render(<PlacedImages doc={doc} pageIndex={0} readOnly/>));
    const figure=host.querySelector<HTMLElement>('.placed-image')!;
    expect(figure.classList.contains('placed-image--polygon')).toBe(true);
    expect(parseFloat(figure.style.getPropertyValue('--placed-polygon-tail'))).toBe(0);
    expect(figure.style.getPropertyValue('--placed-contour-clip')).toBe('');
    expect(figure.querySelector('.placed-image-frame figcaption')).toBeNull();
    expect(figure.querySelector(':scope > figcaption')?.textContent).toBe('Protected caption');
    expect(doc.images[0].wrapPolygon![2].y).toBe(80);
    act(()=>root.unmount());
  });

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

  it('drags a caption independently, commits once, preserves the image, and supports undo',()=>{
    const doc=emptyDoc();doc.design.sidebar=false;
    doc.assets.art={src:'data:image/png;base64,',naturalWidth:500,naturalHeight:500};
    doc.images=[{id:'caption-drag',assetId:'art',caption:'Caption stays outside the image',widthCols:1,heightMm:40,anchor:{page:1,column:0,y:120}}];
    useDoc.getState().load(doc);useDoc.temporal.getState().clear();
    const host=document.createElement('div'),root=createRoot(host);document.body.append(host);
    act(()=>root.render(<div className="page"><PlacedImages doc={useDoc.getState().doc} pageIndex={0}/></div>));
    const page=host.querySelector<HTMLElement>('.page')!,cap=host.querySelector<HTMLElement>('figcaption')!;
    page.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,width:420,height:594,right:420,bottom:594,toJSON(){}});
    cap.getBoundingClientRect=()=>({x:240,y:80,left:240,top:80,width:80,height:20,right:320,bottom:100,toJSON(){}});
    act(()=>{cap.dispatchEvent(pointerEvent('pointerdown',250,90));cap.dispatchEvent(pointerEvent('pointermove',270,120));});
    expect(useDoc.getState().doc.images[0].captionPlacement).toBeUndefined();
    expect(useDoc.getState().doc.images[0].anchor).toEqual(doc.images[0].anchor);
    act(()=>cap.dispatchEvent(pointerEvent('pointerup',270,120)));
    expect(useDoc.getState().doc.images[0].captionPlacement).toEqual({x:130,y:55,widthMm:40});
    expect(useDoc.getState().doc.images[0].anchor).toEqual(doc.images[0].anchor);
    expect(useDoc.temporal.getState().pastStates).toHaveLength(1);
    act(()=>useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc.images[0].captionPlacement).toBeUndefined();
    act(()=>root.unmount());host.remove();
  });

  it('does not save caption movements in read-only mode',()=>{
    const doc=emptyDoc();doc.assets.art={src:'',naturalWidth:200,naturalHeight:200};
    doc.images=[{id:'ro-caption',assetId:'art',caption:'Read only',widthCols:1,anchor:{page:1,column:0,y:100},captionPlacement:{x:100,y:80,widthMm:30}}];
    useDoc.getState().load(doc);useDoc.temporal.getState().clear();
    const host=document.createElement('div'),root=createRoot(host);
    act(()=>root.render(<div className="page"><PlacedImages doc={useDoc.getState().doc} pageIndex={0} readOnly/></div>));
    const cap=host.querySelector('figcaption')!;
    act(()=>{cap.dispatchEvent(pointerEvent('pointerdown',10,10));cap.dispatchEvent(pointerEvent('pointermove',120,120));cap.dispatchEvent(pointerEvent('pointerup',120,120));});
    expect(useDoc.getState().doc.images[0].captionPlacement).toEqual({x:100,y:80,widthMm:30});
    expect(useDoc.temporal.getState().pastStates).toHaveLength(0);
    act(()=>root.unmount());
  });

  it('drags a caption into its own photo without snapping away, then retains the overlap after rendering',()=>{
    const doc=emptyDoc();doc.design.sidebar=false;doc.assets.art={src:'',naturalWidth:500,naturalHeight:500};
    doc.images=[{id:'overlap-caption',assetId:'art',caption:'Over the photo',widthCols:2,heightMm:80,anchor:{page:1,column:0,y:100}}];
    useDoc.getState().load(doc);const host=document.createElement('div'),root=createRoot(host);document.body.append(host);
    const render=()=>act(()=>root.render(<div className="page"><PlacedImages doc={useDoc.getState().doc} pageIndex={0}/></div>));render();
    const page=host.querySelector<HTMLElement>('.page')!,cap=host.querySelector<HTMLElement>('figcaption')!;
    page.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,width:210,height:297,right:210,bottom:297,toJSON(){}});
    cap.getBoundingClientRect=()=>({x:14,y:181,left:14,top:181,width:80,height:10,right:94,bottom:191,toJSON(){}});
    act(()=>{cap.dispatchEvent(pointerEvent('pointerdown',20,185));cap.dispatchEvent(pointerEvent('pointermove',30,130));});
    expect(cap.dataset.captionDragging).toBe('true');expect(cap.style.top).toBe('26mm');
    act(()=>cap.dispatchEvent(pointerEvent('pointerup',30,130)));render();
    expect(useDoc.getState().doc.images[0].captionPlacement).toEqual({x:24,y:126,widthMm:80});
    expect(host.querySelector<HTMLElement>('figcaption')!.style.top).toBe('26mm');
    expect(host.querySelector<HTMLElement>('figcaption')!.dataset.captionDragging).toBeUndefined();
    expect(useDoc.getState().doc.images[0].anchor.y).toBe(100);
    act(()=>root.unmount());host.remove();
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
