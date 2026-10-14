import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyDoc, migrate, type TemplateId } from '../../schema/document';
import { presetFor } from '../../store/presets';
import { useDoc } from '../../store/useDoc';
import { placedImageGeometry } from '../../lib/placedImage';
import { articleGridDesign, articlePageHeight, isReferenceArticle } from '../../lib/articleLayouts';
import { ArticleImagesSection } from './ArticleImagesSection';

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
