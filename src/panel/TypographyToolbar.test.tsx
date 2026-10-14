import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TypographyProvider, TypographyToolbar } from './TypographyToolbar';
import { Panel } from './Panel';
import { useDoc } from '../store/useDoc';
import { presetFor, TEMPLATE_META } from '../store/presets';
import { requestBlockEditorFocus, requestEditorTargetFocus } from '../lib/editorNavigation';
import { applyMark } from '../lib/activeEditor';
import { migrate } from '../schema/document';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  // Navigation scheduling is tested separately; here we observe the same signals.
  vi.stubGlobal('requestAnimationFrame', () => 0);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
function render(template: Parameters<typeof presetFor>[0]) {
  const doc = presetFor(template);
  useDoc.setState({ doc }); useDoc.temporal.getState().clear();
  const before = JSON.stringify(doc);
  act(() => root.render(<TypographyProvider><TypographyToolbar /><Panel /></TypographyProvider>));
  expect(JSON.stringify(useDoc.getState().doc)).toBe(before);
}
const active = () => host.querySelector<HTMLSelectElement>('[aria-label="Typography group"]')!.value;
const visible = () => [...host.querySelectorAll<HTMLElement>('.typography-control:not([hidden])')];
function group(value: string) {
  const select = host.querySelector<HTMLSelectElement>('[aria-label="Typography group"]')!;
  act(() => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
}

describe('typography relocation', () => {
  it.each(TEMPLATE_META.map(meta=>[meta.id]))('adds missing font controls and a reversible top-bar option in %s',template=>{
    render(template);
    const before=structuredClone(useDoc.getState().doc);
    const toggle=[...host.querySelectorAll<HTMLLabelElement>('label')].find(label=>label.querySelector('.field-label')?.textContent==='Show top bar')!.querySelector<HTMLInputElement>('input')!;
    act(()=>toggle.click());
    expect(useDoc.getState().doc.design.showTopBar).toBe(toggle.checked);
    expect(useDoc.getState().doc.meta).toEqual(before.meta);
    act(()=>useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc.design.showTopBar).toBe(before.design.showTopBar);
    for(const key of ['masthead','footer','caption','highlights']) {
      group(key);
      const properties=visible().map(node=>node.dataset.completeProperty ?? node.dataset.styleProperty);
      for(const property of ['fontFamily','fontSize','fontWeight','italic','underline','color','lineHeight','align'])expect(properties,`${template} ${key} ${property}`).toContain(property);
    }
  });
  it('saves added styles only on the selected paragraph, with undo, redo and reset',()=>{
    render('paper-1');
    const before=structuredClone(useDoc.getState().doc);
    const id=before.blocks.find(b=>b.type==='paragraph')!.id;
    act(()=>requestBlockEditorFocus(id));
    act(()=>host.querySelector<HTMLButtonElement>('[data-complete-property="fontWeight"] button')!.click());
    act(()=>host.querySelector<HTMLButtonElement>('[data-complete-property="italic"] button')!.click());
    act(()=>host.querySelector<HTMLButtonElement>('[data-complete-property="underline"] button')!.click());
    const doc=useDoc.getState().doc;
    expect(doc.design.textStyles).toEqual({[`block:${id}`]:{fontWeight:700,italic:true,underline:true}});
    expect(doc.blocks).toEqual(before.blocks);
    expect(doc.design.fontBody).toBe(before.design.fontBody);
    expect(migrate(JSON.parse(JSON.stringify(doc))).design.textStyles).toEqual(doc.design.textStyles);
    act(()=>useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc.design.textStyles?.[`block:${id}`].underline).toBeUndefined();
    act(()=>useDoc.temporal.getState().redo());
    expect(useDoc.getState().doc.design.textStyles?.[`block:${id}`].underline).toBe(true);
    act(()=>visible().flatMap(el=>[...el.querySelectorAll<HTMLButtonElement>('button')]).find(b=>b.textContent==='Reset added styling')!.click());
    expect(useDoc.getState().doc.design.textStyles?.[`block:${id}`]).toBeUndefined();
  });
  it('edits caption tracking independently, restores it after reload, and supports undo/reset', () => {
    render('magazine-2');
    const before = structuredClone(useDoc.getState().doc);
    act(() => requestEditorTargetFocus('content', 'meta-location'));
    expect(active()).toBe('storyTag');
    const input = host.querySelector<HTMLInputElement>('[data-typography-group="storyTag"] input[type=number]')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '0.025');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(useDoc.getState().doc.design.textTracking).toEqual({ storyTag: .025 });
    expect(useDoc.getState().doc.blocks).toEqual(before.blocks);
    expect(migrate(JSON.parse(JSON.stringify(useDoc.getState().doc))).design.textTracking).toEqual({ storyTag: .025 });
    act(() => useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc.design.textTracking).toBeUndefined();
    act(() => useDoc.temporal.getState().redo());
    act(() => host.querySelector<HTMLButtonElement>('[data-typography-group="storyTag"] button')!.click());
    expect(useDoc.getState().doc.design.textTracking?.storyTag).toBeUndefined();
  });
  it.each(['paper-1','paper-3','frontmatter-dean','gallery-2'] as const)('keeps selected paragraph tracking separate in %s', template => {
    render(template);
    const id = useDoc.getState().doc.blocks.find(block => block.type === 'paragraph')!.id;
    act(() => requestBlockEditorFocus(id));
    const inputs = visible().flatMap(el => [...el.querySelectorAll<HTMLInputElement>('input[placeholder="Auto"]')]);
    expect(inputs).toHaveLength(1);
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(inputs[0], '-0.02');
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(useDoc.getState().doc.design.textTracking).toEqual({ [`block:${id}`]: -.02 });
  });
  it('toggles decorative quotes only on the selected paragraph without rewriting its text', () => {
    render('paper-3');
    const original=structuredClone(useDoc.getState().doc);
    const first=original.blocks.find(block=>block.type==='paragraph')!;
    act(()=>requestBlockEditorFocus(first.id));
    const buttons=()=>[...host.querySelectorAll<HTMLButtonElement>('.typography-control:not([hidden]) button')];
    act(()=>buttons().find(button=>button.textContent==='❝ Quote ❞')!.click());
    expect(useDoc.getState().doc.blocks.find(block=>block.id===first.id)).toEqual({...first,decorativeQuote:true});
    expect(useDoc.getState().doc.blocks.filter(block=>block.id!==first.id)).toEqual(original.blocks.filter(block=>block.id!==first.id));
    expect(migrate(JSON.parse(JSON.stringify(useDoc.getState().doc))).blocks.find(block=>block.id===first.id)).toMatchObject({decorativeQuote:true});
    act(()=>buttons().find(button=>button.textContent==='Text')!.click());
    expect(useDoc.getState().doc.blocks).toEqual(original.blocks);
    act(()=>useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc.blocks.find(block=>block.id===first.id)).toMatchObject({decorativeQuote:true});
  });
  it.each(TEMPLATE_META.map(meta => [meta.id]))('relocates existing font selectors for %s without editing the document', template => {
    render(template);
    const topFonts = [...host.querySelectorAll<HTMLSelectElement>('.typography-toolbar select')].filter(select => [...select.options].some(option => option.value === 'Helvetica'));
    expect(topFonts.length).toBeGreaterThan(0);
    const leftFonts = [...host.querySelectorAll<HTMLSelectElement>('.panel select')].filter(select => [...select.options].some(option => option.value === 'Helvetica'));
    expect(leftFonts).toHaveLength(0);
    expect(host.querySelector('.panel [aria-label="Layout template"]')).not.toBeNull();
    expect(host.querySelectorAll('.panel input[type="color"]').length).toBeGreaterThan(0);
  });

  it('shows title controls on focus without switching the sidebar or changing copy', () => {
    render('paper-1');
    const before = JSON.stringify(useDoc.getState().doc);
    act(() => host.querySelector<HTMLTextAreaElement>('#editor-target-meta-title textarea')!.focus());
    expect(active()).toBe('title');
    expect(visible().some(el => el.textContent?.includes('Display'))).toBe(true);
    expect(visible().some(el => el.dataset.typographyGroup === 'title' && el.querySelector('input[type=number]'))).toBe(true);
    expect(host.querySelector('[role=tab][aria-selected=true]')?.textContent).toBe('Content');
    expect(JSON.stringify(useDoc.getState().doc)).toBe(before);
  });

  it('uses the original font handler and undo, without remounting controls on group changes', () => {
    render('paper-1');
    const select = host.querySelector<HTMLSelectElement>('[data-typography-group=body] select')!;
    const original = useDoc.getState().doc.design.fontBody;
    act(() => { select.value = 'Arial'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(useDoc.getState().doc.design.fontBody).toBe('Arial');
    group('title'); group('body');
    expect(host.querySelector('[data-typography-group=body] select')).toBe(select);
    act(() => useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc.design.fontBody).toBe(original);
  });

  it('keeps paragraph selection and the existing inline-format handler working', () => {
    render('paper-1');
    const textarea = host.querySelector<HTMLTextAreaElement>('[data-block-editor-id]')!;
    const id = textarea.dataset.blockEditorId!;
    act(() => { textarea.focus(); textarea.setSelectionRange(0, 4); });
    expect(active()).toBe(`block:${id}`);
    const before = textarea.value;
    const font = host.querySelector<HTMLInputElement>(`[data-typography-group="block:${id}"] input[type=number]`)!;
    act(() => font.focus());
    expect(textarea.selectionStart).toBe(0); expect(textarea.selectionEnd).toBe(4);
    act(() => applyMark('b'));
    expect(useDoc.getState().doc.blocks.find(block => block.id === id)).toMatchObject({ text: `**${before.slice(0, 4)}**${before.slice(4)}` });
  });

  it('follows news and cover navigation without changing their original targets', () => {
    render('news-briefs');
    const story = useDoc.getState().doc.news!.stories[0];
    act(() => requestEditorTargetFocus('content', `news-title-${story.id}`));
    expect(active()).toBe(`news:${story.id}:title`);
    expect(visible().map(el => el.textContent).join(' ')).toContain('Headline size');
    act(() => host.querySelector<HTMLButtonElement>('[data-complete-property="fontWeight"] button')!.click());
    expect(useDoc.getState().doc.design.textStyles).toEqual({ [`news:${story.id}:title`]: {fontWeight:700} });
    act(() => requestEditorTargetFocus('content', `news-text-${story.id}`));
    expect(active()).toBe(`news:${story.id}:body`);
    expect(visible().map(el => el.textContent).join(' ')).toContain('Body size');
    expect(visible().map(el => el.textContent).join(' ')).not.toContain('Headline size');
    act(() => requestEditorTargetFocus('images', `news-caption-${story.id}`));
    expect(active()).toBe(`news:${story.id}:caption`);
    act(() => requestEditorTargetFocus('images', `news-credit-${story.id}`));
    expect(active()).toBe(`news:${story.id}:credit`);
    act(() => useDoc.setState({ doc: presetFor('magazine-4') }));
    act(() => requestEditorTargetFocus('design', 'front-cover-style-title'));
    expect(active()).toBe('title');
    expect(visible().map(el => el.textContent).join(' ')).toContain('Letter spacing');
    expect(host.querySelector('[role=tab][aria-selected=true]')?.textContent).toBe('Design');
    act(() => requestEditorTargetFocus('images', 'image-cover'));
    expect(active()).toBe('');
    expect(visible()).toHaveLength(0);
  });

  it('keeps the selected paragraph’s controls available when its content tab opens', () => {
    render('frontmatter-dean');
    const id = useDoc.getState().doc.blocks.find(block => block.type === 'paragraph')!.id;
    act(() => requestBlockEditorFocus(id));
    expect(active()).toBe(`block:${id}`);
    expect(visible().some(el => el.dataset.typographyGroup === `block:${id}`)).toBe(true);
  });

  it('keeps shared cover teaser styles separate from the selected teaser overrides', () => {
    render('magazine-4');
    const id = useDoc.getState().doc.blocks.find(block => block.type === 'paragraph')!.id;
    act(() => requestBlockEditorFocus(id));
    const groups = visible().map(el => el.dataset.typographyGroup);
    expect(groups).not.toContain('teaserTitle');
    expect(groups).not.toContain('teaserBody');
    expect(groups).toContain(`block:${id}`);
    group('teaserTitle');
    expect(visible().some(el => el.dataset.typographyGroup === 'teaserTitle')).toBe(true);
  });

  it.each(['paper-1', 'paper-3', 'frontmatter-dean', 'gallery-1'] as const)('keeps paragraph sizes independent through save/reload and undo in %s', template => {
    render(template);
    const original = structuredClone(useDoc.getState().doc);
    const paragraphs = original.blocks.filter(block => block.type === 'paragraph');
    const setSize = (id: string, value: string) => {
      act(() => requestBlockEditorFocus(id));
      expect(visible().every(el => !['body', 'theme'].includes(el.dataset.typographyGroup!))).toBe(true);
      const input = host.querySelector<HTMLInputElement>(`[data-typography-group="block:${id}"] input[type=number]`)!;
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    setSize(paragraphs[0].id, '14');
    setSize(paragraphs[1].id, '18');
    const doc = useDoc.getState().doc;
    expect(doc.design).toEqual(original.design);
    expect(doc.blocks.find(block => block.id === paragraphs[0].id)).toMatchObject({ fontSize: 14 });
    expect(doc.blocks.find(block => block.id === paragraphs[1].id)).toMatchObject({ fontSize: 18 });
    for (const paragraph of paragraphs.slice(2)) expect(doc.blocks.find(block => block.id === paragraph.id)).toEqual(paragraph);
    const reopened = migrate(JSON.parse(JSON.stringify(doc)));
    expect(reopened.blocks.find(block => block.id === paragraphs[0].id)).toMatchObject({ fontSize: 14 });
    expect(reopened.blocks.find(block => block.id === paragraphs[1].id)).toMatchObject({ fontSize: 18 });
    act(() => useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc.blocks.find(block => block.id === paragraphs[1].id)).toEqual(paragraphs[1]);
    expect(useDoc.getState().doc.blocks.find(block => block.id === paragraphs[0].id)).toMatchObject({ fontSize: 14 });
  });

  it.each([['news-briefs', 'news-photo-example'], ['gallery-1', 'gallery-image-example']] as const)('hides typography for image navigation in %s', (template, target) => {
    render(template);
    act(() => requestEditorTargetFocus('images', target));
    expect(active()).toBe('');
    expect(visible()).toHaveLength(0);
  });
});
