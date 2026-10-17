import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyDoc, migrate, type TemplateId } from '../../schema/document';
import { presetFor } from '../../store/presets';
import { useDoc } from '../../store/useDoc';
import { placedImageGeometry } from '../../lib/placedImage';
import { articleGridDesign, articlePageHeight, isReferenceArticle } from '../../lib/articleLayouts';
import { ArticleImagesSection } from './ArticleImagesSection';
import { cloneDocForUpdate } from '../../store/useDoc';
import {PlacedImages} from '../../paper/PlacedImages';

let host: HTMLDivElement;
let root: Root;
const edit = (input: HTMLInputElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const heightInput = () => [...host.querySelectorAll('label')].find(label => label.textContent?.startsWith('Image height'))!.querySelector<HTMLInputElement>('input')!;
const resetButton = () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Use original proportions')!;
const mount = (template: TemplateId = 'paper-2') => {
  const doc = presetFor(template);
  doc.assets.test = { src: '', naturalWidth: 800, naturalHeight: 400 };
  doc.images = [{ id: 'first', assetId: 'test', widthCols: 2, caption: 'Caption stays', anchor: {page: 1, column: 0, y: 60}, frame: {scale: 1.3, offsetX: 10, offsetY: -15} },
    { id: 'second', assetId: 'test', widthCols: 1, caption: '', anchor: {page: 2, column: 1, y: 100} }];
  act(() => { useDoc.getState().load(doc); root.render(<ArticleImagesSection/>); });
};

beforeEach(() => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); useDoc.getState().load(emptyDoc()); });

describe('page-image height controls', () => {
  it.each(['paper-1','paper-2','paper-3','paper-4','paper-5','paper-6','paper-7','paper-8','magazine-1','magazine-2','magazine-3'] as const)('%s caption alignment overrides saved shared caption styling',template=>{
    mount(template);
    act(()=>useDoc.getState().update(doc=>{doc.design.textStyles={caption:{align:'left'}};}));
    const control=host.querySelector('[aria-label="Caption align"]')!;
    act(()=>([...control.querySelectorAll('button')].find(b=>b.textContent==='Right') as HTMLButtonElement).click());
    const doc=useDoc.getState().doc;
    expect(doc.images[0].align).toBe('right');
    expect(doc.design.textStyles?.['image-caption:first']?.align).toBe('right');
    expect(doc.design.textStyles?.caption?.align).toBe('left');
    expect(doc.images[1].align).toBeUndefined();
  });
  it.each(['paper-1','paper-2','paper-3','paper-4','paper-5','paper-6','paper-7','paper-8','magazine-1','magazine-2','magazine-3'] as const)('%s saves independent height, preserves framing and resets to natural proportions', template => {
    mount(template);
    expect(resetButton().disabled).toBe(true);
    edit(heightInput(), '95.5');
    const doc = useDoc.getState().doc;
    expect(doc.images[0].heightMm).toBe(95.5);
    expect(doc.images[0].widthCols).toBe(2);
    expect(doc.images[0].caption).toBe('Caption stays');
    expect(doc.images[0].frame).toEqual({scale: 1.3, offsetX: 10, offsetY: -15});
    expect(doc.images[1].heightMm).toBeUndefined();
    expect(migrate(JSON.parse(JSON.stringify(doc))).images[0].heightMm).toBe(95.5);
    act(() => useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc.images[0].heightMm).toBeUndefined();
    act(() => useDoc.temporal.getState().redo());
    expect(useDoc.getState().doc.images[0].heightMm).toBe(95.5);
    act(() => resetButton().click());
    const restored = useDoc.getState().doc;
    expect(restored.images[0].heightMm).toBeUndefined();
    const design = isReferenceArticle(template) ? articleGridDesign(restored.design) : restored.design;
    const geometry = placedImageGeometry(restored.images[0], restored.assets.test, design);
    expect(geometry.height).toBeCloseTo(geometry.width / 2);
  });
  it('supports heights up to the full composition, clamps the anchor and retains the height after a width change', () => {
    mount('paper-4');
    const max = articlePageHeight(useDoc.getState().doc.design);
    expect(heightInput().max).toBe(String(max));
    edit(heightInput(), String(max));
    expect(useDoc.getState().doc.images[0].anchor.y).toBe(0);
    const width = host.querySelector('[aria-label="Width"]')!;
    act(() => (width.querySelector('button') as HTMLButtonElement).click());
    expect(useDoc.getState().doc.images[0].heightMm).toBe(max);
    expect(useDoc.getState().doc.images[0].widthCols).toBe(1);
  });
  it('offers the same resize through the slider without changing other images', () => {
    mount();
    const slider = [...host.querySelectorAll('label')].find(label => label.textContent?.startsWith('Adjust image height'))!.querySelector<HTMLInputElement>('input')!;
    edit(slider, '160');
    expect(useDoc.getState().doc.images[0].heightMm).toBe(160);
    expect(useDoc.getState().doc.images[1].heightMm).toBeUndefined();
  });
});

describe('freeform page-image controls', () => {
  it('saves independent caption coordinates, clones them safely, and preserves them through JSON and undo',()=>{
    mount('paper-8');useDoc.temporal.getState().clear();
    const before=useDoc.getState().doc;
    const free=[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Free position')!;
    act(()=>free.click());
    const width=[...host.querySelectorAll('label')].find(l=>l.textContent?.startsWith('Caption width'))!.querySelector<HTMLInputElement>('input')!;
    edit(width,'26.5');
    const saved=useDoc.getState().doc;
    expect(saved.images[0].captionPlacement!.widthMm).toBe(26.5);
    expect(saved.images[0].anchor).toEqual(before.images[0].anchor);
    expect(saved.blocks).toEqual(before.blocks);
    const clone=cloneDocForUpdate(saved);clone.images[0].captionPlacement!.x=99;
    expect(saved.images[0].captionPlacement!.x).not.toBe(99);
    expect(migrate(JSON.parse(JSON.stringify(saved))).images[0].captionPlacement).toEqual(saved.images[0].captionPlacement);
    act(()=>useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc.images[0].captionPlacement!.widthMm).not.toBe(26.5);
  });
  it.each(['paper-1','paper-2','paper-3','paper-4','paper-5','paper-6','paper-7','paper-8','magazine-1','magazine-2','magazine-3'] as const)('%s offers a saved, undoable outline without changing copy or image framing', template => {
    mount(template);
    const before = useDoc.getState().doc;
    act(()=>root.render(<><ArticleImagesSection/><div className="page"><PlacedImages doc={before} pageIndex={0} includeHighlights={false}/></div></>));
    const firstGroup = host.querySelector('[aria-label="Text wrap shape"]')!;
    const button = [...firstGroup.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Draw outline')!;
    act(()=>button.click());
    expect(useDoc.getState().doc.images[0].wrapShape).toBeUndefined();
    expect(host.querySelector('[aria-label="Point X"]')).toBeNull();
    const svg=host.querySelector<SVGSVGElement>('[aria-label="Draw image border on canvas"]')!;
    svg.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,width:100,height:100,right:100,bottom:100,toJSON(){}});
    const pointer=(type:string,x:number,y:number)=>{const event=new MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:5});svg.dispatchEvent(event);};
    act(()=>{pointer('pointerdown',20,10);pointer('pointermove',90,20);pointer('pointermove',80,90);pointer('pointermove',10,80);pointer('pointerup',20,10);});
    expect(useDoc.getState().doc.images[0].wrapPolygon).toBeUndefined();
    const apply = [...document.querySelectorAll<HTMLButtonElement>('.canvas-outline-tools button')].find(b=>b.textContent==='Apply border')!;
    act(()=>apply.click());
    const saved = useDoc.getState().doc;
    expect(saved.images[0].wrapShape).toBe('polygon');
    expect(saved.images[0].wrapPolygon?.[0]).toEqual({x:20,y:10});
    expect(saved.images[0].frame).toEqual(before.images[0].frame);
    expect(saved.images[0].caption).toBe('Caption stays');
    expect(saved.blocks).toEqual(before.blocks);
    expect(saved.meta).toEqual(before.meta);
    expect(saved.images[1]).toEqual(before.images[1]);
    expect(migrate(JSON.parse(JSON.stringify(saved))).images[0].wrapPolygon).toEqual(saved.images[0].wrapPolygon);
    act(()=>useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc.images[0].wrapPolygon).toBeUndefined();
    act(()=>useDoc.temporal.getState().redo());
    expect(useDoc.getState().doc.images[0].wrapPolygon).toEqual(saved.images[0].wrapPolygon);
    const draft=cloneDocForUpdate(saved);
    draft.images[0].wrapPolygon![0].x=95;
    expect(saved.images[0].wrapPolygon![0].x).toBe(20);
  });

  it('can reuse the hero as an outlined page image without losing its caption or source',()=>{
    mount('paper-8');
    const before=useDoc.getState().doc;
    const button=[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Use hero as a wrapped page image')!;
    act(()=>button.click());
    const saved=useDoc.getState().doc;
    expect(saved.design.showHero).toBe(false);
    expect(saved.images).toHaveLength(3);
    expect(saved.images[2]).toMatchObject({assetId:before.hero.assetId,caption:before.meta.heroCaption??'',wrapShape:'polygon'});
    expect(saved.hero).toEqual(before.hero);
    expect(saved.meta).toEqual(before.meta);
    expect(saved.assets).toEqual(before.assets);
    expect(saved.blocks).toEqual(before.blocks);
    act(()=>useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc.images).toEqual(before.images);
    expect(useDoc.getState().doc.design.showHero).toBe(before.design.showHero);
  });
});
