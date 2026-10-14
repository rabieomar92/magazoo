import { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { WritingGuide } from './WritingGuide';
let host:HTMLDivElement,root:ReturnType<typeof createRoot>;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();});
describe('writing guide interaction',()=>{
  it('highlights and selects the exact source without modifying it or making a network request',()=>{
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const ref=createRef<HTMLTextAreaElement>();const text='They is studying light.';
    act(()=>root.render(<><textarea ref={ref} defaultValue={text}/><WritingGuide text={text} editorRef={ref}/></>));
    ref.current!.scrollIntoView=vi.fn();const excerpt=host.querySelector<HTMLButtonElement>('.writing-excerpt')!;
    expect(excerpt.querySelector('mark')!.textContent).toBe('They is');act(()=>excerpt.click());
    expect(ref.current!.selectionStart).toBe(0);expect(ref.current!.selectionEnd).toBe(7);expect(ref.current!.value).toBe(text);expect(fetch).not.toHaveBeenCalled();
    act(()=>host.querySelector<HTMLButtonElement>('.writing-dismiss')!.click());expect(host.querySelector('.writing-excerpt')).toBeNull();
  });
  it('exposes both languages and a separate metric for each paragraph in a story',()=>{
    act(()=>root.render(<WritingGuide text={'Light travels fast.\n\nCahaya ini di gunakan untuk mengkaji zarah.'}/>));
    expect([...host.querySelectorAll('option')].map(o=>o.value)).toEqual(['auto','en','ms']);
    expect(host.querySelector('[aria-label="Readability by paragraph"]')!.textContent).toContain('Paragraph 2');
    const select=host.querySelector('select')!;act(()=>{select.value='ms';select.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(host.textContent).toContain('digunakan');
  });
  it('keeps the existing formatting action beside the paragraph',()=>{
    const format=vi.fn();act(()=>root.render(<WritingGuide text="A short sentence." onFormat={format}/>));
    act(()=>host.querySelector<HTMLButtonElement>('.writing-format')!.click());expect(format).toHaveBeenCalledOnce();
  });
  it('can target a paragraph textarea by its own id, not only a containing field',()=>{
    const text='They is studying light.';
    act(()=>root.render(<><textarea id="paragraph-editor" defaultValue={text}/><WritingGuide text={text} editorId="paragraph-editor"/></>));
    const editor=host.querySelector('textarea')!;editor.scrollIntoView=vi.fn();
    act(()=>host.querySelector<HTMLButtonElement>('.writing-excerpt')!.click());
    expect(editor.selectionStart).toBe(0);expect(editor.selectionEnd).toBe(7);
  });
});
