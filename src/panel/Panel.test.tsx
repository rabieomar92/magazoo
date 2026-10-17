import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { presetFor,TEMPLATE_META } from '../store/presets';
import { useDoc } from '../store/useDoc';
import { Panel } from './Panel';
import { IMAGE_LED_COMPOSITIONS } from '../lib/templateChoices';

describe('layout change warning', () => {
  let root: ReturnType<typeof createRoot> | null = null;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
  });
  it.each(TEMPLATE_META.map(t=>[t.id]))('%s opens every editor category without mutating the document',template=>{
    const host=document.createElement('div');root=createRoot(host);const doc=presetFor(template),before=JSON.stringify(doc);
    act(()=>{useDoc.getState().load(doc);root?.render(<Panel/>);});
    const tabs=[...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs).toHaveLength(8);
    for(const tab of tabs){act(()=>tab.click());expect(tab.getAttribute('aria-selected')).toBe('true');expect(JSON.stringify(useDoc.getState().doc)).toBe(before);}
  });

  it('does not change the renderer until the editor explicitly confirms', () => {
    const host = document.createElement('div');
    root = createRoot(host);
    act(() => {
      useDoc.setState({ doc: presetFor('paper-1') });
      root?.render(<Panel />);
    });

    const select = host.querySelector<HTMLSelectElement>('select[aria-label="Layout template"]')!;
    act(() => {
      select.value = 'frontmatter-board';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(useDoc.getState().doc.templateId).toBe('paper-1');
    expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(host.textContent).toContain('Changing the layout can reflow every page');

    const keep = [...host.querySelectorAll('button')].find(button => button.textContent === 'Keep current layout')!;
    act(() => keep.click());
    expect(useDoc.getState().doc.templateId).toBe('paper-1');
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();

    act(() => {
      select.value = 'frontmatter-board';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const confirm = [...host.querySelectorAll('button')].find(button => button.textContent === 'Change layout')!;
    act(() => confirm.click());
    expect(useDoc.getState().doc.templateId).toBe('frontmatter-board');
  });

  it.each(IMAGE_LED_COMPOSITIONS)('opens $id in one image-led family without rewriting the document', composition => {
    const host = document.createElement('div');
    root = createRoot(host);
    const doc = presetFor(composition.id);
    const before = JSON.stringify(doc);
    act(() => {
      useDoc.setState({ doc });
      root?.render(<Panel />);
    });
    const layout = host.querySelector<HTMLSelectElement>('select[aria-label="Layout template"]')!;
    expect(layout.value).toBe('paper-3');
    expect([...layout.options].filter(option => ['paper-3', 'paper-4', 'paper-5'].includes(option.value))).toHaveLength(1);
    expect(host.querySelector<HTMLSelectElement>('select[aria-label="Image-led composition"]')?.value).toBe(composition.id);
    expect(JSON.stringify(useDoc.getState().doc)).toBe(before);
    act(() => layout.dispatchEvent(new Event('change', { bubbles: true })));
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('confirms composition changes through the existing safe switch and preserves content and assets', () => {
    const host = document.createElement('div');
    root = createRoot(host);
    const doc = presetFor('paper-3');
    doc.meta.title = 'My edited article';
    doc.meta.heroCaption = 'My hero description and photo credit';
    const meta = structuredClone(doc.meta);
    const hero = structuredClone(doc.hero);
    const design = structuredClone(doc.design);
    const blocks = structuredClone(doc.blocks);
    const assets = structuredClone(doc.assets);
    act(() => {
      useDoc.setState({ doc });
      root?.render(<Panel />);
    });
    const composition = host.querySelector<HTMLSelectElement>('select[aria-label="Image-led composition"]')!;
    act(() => {
      composition.value = 'paper-5';
      composition.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(useDoc.getState().doc.templateId).toBe('paper-3');
    expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain('Image-led Feature — Panoramic bleed');
    act(() => [...host.querySelectorAll('button')].find(button => button.textContent === 'Change layout')!.click());
    expect(useDoc.getState().doc.templateId).toBe('paper-5');
    expect(useDoc.getState().doc.meta.title).toBe('My edited article');
    expect(useDoc.getState().doc.meta).toEqual(meta);
    expect(useDoc.getState().doc.hero).toEqual(hero);
    expect(useDoc.getState().doc.design).toEqual(design);
    expect(useDoc.getState().doc.blocks).toEqual(blocks);
    expect(useDoc.getState().doc.assets).toEqual(assets);
    expect(host.querySelector<HTMLSelectElement>('select[aria-label="Layout template"]')?.value).toBe('paper-3');
    expect(composition.value).toBe('paper-5');
    act(() => useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc.templateId).toBe('paper-3');
    expect(useDoc.getState().doc.meta.heroCaption).toBe('My hero description and photo credit');
  });
});
