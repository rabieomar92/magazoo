import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AdminLibrary from './AdminLibrary';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const projects = [{ id: 'p', name: 'Physics', items: Array.from({ length: 23 }, (_, i) => ({ id: String(i), name: `story-${i}.json`, token: String(i), version: 1, updated: 0 })) }, { id: 'empty', name: 'Empty project', items: [] }];
const props = { busy: false, onDelete: vi.fn(), onCopy: vi.fn(), link: (token: string) => `#edit=${token}` };
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const render = (data = projects) => act(() => root.render(<AdminLibrary {...props} projects={data} />));
const click = (text: string) => act(() => (Array.from(host.querySelectorAll('button')).find(b => b.textContent === text)!).click());
it('offers rename for populated and empty projects, with the correct project identity', () => {
  const onRename = vi.fn();
  act(() => root.render(<AdminLibrary {...props} projects={projects} onRename={onRename} />));
  click('Rename'); expect(onRename).toHaveBeenLastCalledWith(projects[0]);
  act(() => root.render(<AdminLibrary {...props} projects={[projects[1]]} onRename={onRename} />));
  click('Rename'); expect(onRename).toHaveBeenLastCalledWith(projects[1]);
});
it('bounds results and navigates pages, including empty projects', () => {
  render(); expect(host.querySelectorAll('li')).toHaveLength(12);
  click('Next'); expect(host.textContent).toContain('Page 2 of 2');
  expect(document.activeElement).toBe(host.querySelector('.admin-result-count'));
  expect(host.querySelectorAll('li')).toHaveLength(11); expect(host.textContent).toContain('Empty project');
  render([{ ...projects[0], items: projects[0].items.slice(0, 2) }]);
  expect(host.textContent).toContain('Page 1 of 1'); expect(host.querySelectorAll('li')).toHaveLength(2);
});
it('searches filenames across all pages and clears filters', () => {
  render(); click('Next');
  const input = host.querySelector('input')!;
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'STORY-22'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(host.querySelectorAll('li')).toHaveLength(1); expect(host.textContent).toContain('story-22.json'); expect(host.textContent).toContain('Page 1 of 1');
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'missing'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(host.textContent).toContain('No matching documents'); click('Clear filters'); expect(host.querySelectorAll('li')).toHaveLength(12);
});
it('keeps card edit links and actions attached to their exact document', () => {
  const onCopy=vi.fn(),onDelete=vi.fn(),onCompile=vi.fn();
  act(()=>root.render(<AdminLibrary {...props} projects={projects} onCopy={onCopy} onDelete={onDelete} onCompile={onCompile}/>));
  expect(host.querySelector('[aria-label="Edit story-0.json"]')?.getAttribute('href')).toBe('#edit=0');
  act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Copy private link for story-0.json"]')!.click());
  expect(onCopy).toHaveBeenCalledWith(projects[0].items[0]);
  act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Delete story-0.json"]')!.click());
  expect(onDelete).toHaveBeenCalledWith({name:'story-0.json',path:'documents/0',project:false});
  click('Compile issue');expect(onCompile).toHaveBeenCalledWith('p');
  act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Delete project Physics"]')!.click());
  expect(onDelete).toHaveBeenLastCalledWith({name:'Physics',path:'projects/p',project:true});
});
it('loads versioned hero previews and recovers cleanly when an image is missing', () => {
  render();
  const preview=host.querySelector<HTMLImageElement>('.admin-article-hero img')!;
  expect(preview.getAttribute('src')).toBe('/api/documents/0/hero?v=1');
  expect(preview.getAttribute('loading')).toBe('lazy');
  expect(preview.closest('a')?.getAttribute('href')).toBe('#edit=0');
  act(()=>preview.dispatchEvent(new Event('error')));
  expect(host.querySelector('.admin-article-hero')?.textContent).toContain('No hero image');
  expect(host.querySelector('.admin-article-hero')?.querySelector('img')).toBeNull();
  render([{...projects[0],items:[{...projects[0].items[0],version:2}]}]);
  expect(host.querySelector('.admin-article-hero img')?.getAttribute('src')).toBe('/api/documents/0/hero?v=2');
});
it('keeps empty project actions, disables mutations while busy, and never prints private tokens', () => {
  const onCompile=vi.fn();
  act(()=>root.render(<AdminLibrary {...props} projects={[projects[1]]} onCompile={onCompile}/>));
  const compile=[...host.querySelectorAll('button')].find(b=>b.textContent==='Compile issue')!;
  expect(compile.disabled).toBe(true);
  expect(host.textContent).toContain('No articles yet');
  act(()=>root.render(<AdminLibrary {...props} projects={[{...projects[0],items:[{...projects[0].items[0],token:'private-token-never-visible'}]}]} busy onCompile={onCompile}/>));
  expect(host.querySelector<HTMLButtonElement>('[aria-label="Delete story-0.json"]')!.disabled).toBe(true);
  expect(host.querySelector<HTMLButtonElement>('[aria-label="Copy private link for story-0.json"]')!.disabled).toBe(true);
  expect(host.textContent).not.toContain('private-token-never-visible');
});
it('combines search with project filtering, sorting and page size', () => {
  render();
  const change=(field:HTMLSelectElement,value:string)=>act(()=>{field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));});
  change(host.querySelectorAll('select')[2],'24');
  expect(host.querySelectorAll('li')).toHaveLength(23);
  change(host.querySelectorAll('select')[0],'empty');
  expect(host.querySelectorAll('li')).toHaveLength(0);
  expect(host.querySelectorAll('.admin-project')).toHaveLength(1);
  change(host.querySelectorAll('select')[0],'p');
  change(host.querySelectorAll('select')[1],'name');
  expect(host.querySelector('h4')?.textContent).toBe('story 0');
  expect(host.textContent).toContain('Page 1 of 1');
});
