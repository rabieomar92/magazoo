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
    expect(active()).toBe(`news:${story.id}`);
    expect(visible().map(el => el.textContent).join(' ')).toContain('Line spacing');
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
