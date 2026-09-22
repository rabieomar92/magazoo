import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TypographyProvider, TypographyToolbar } from './TypographyToolbar';
import { Panel } from './Panel';
import { useDoc } from '../store/useDoc';
import { presetFor, TEMPLATE_META } from '../store/presets';
import { requestBlockEditorFocus, requestEditorTargetFocus } from '../lib/editorNavigation';
import { applyMark } from '../lib/activeEditor';

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
    const font = host.querySelector<HTMLSelectElement>('[data-typography-group=body] select')!;
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

  it('shows both existing cover teaser styles alongside the selected teaser overrides', () => {
    render('magazine-4');
    const id = useDoc.getState().doc.blocks.find(block => block.type === 'paragraph')!.id;
    act(() => requestBlockEditorFocus(id));
    const groups = visible().map(el => el.dataset.typographyGroup);
    expect(groups).toContain('teaserTitle');
    expect(groups).toContain('teaserBody');
    expect(groups).toContain(`block:${id}`);
  });

  it.each([['news-briefs', 'news-photo-example'], ['gallery-1', 'gallery-image-example']] as const)('hides typography for image navigation in %s', (template, target) => {
    render(template);
    act(() => requestEditorTargetFocus('images', target));
    expect(active()).toBe('');
    expect(visible()).toHaveLength(0);
  });
});
