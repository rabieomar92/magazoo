import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AdminPage from './AdminPage';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const projects=[{id:'p',name:'Physics',items:[]}];
let request:ReturnType<typeof vi.fn>;
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  request=vi.fn(async(url:string,options:RequestInit)=>({ok:true,json:async()=>url.endsWith('auth/session')?{csrf:'test-csrf'}:url.endsWith('projects')&&options.method==='POST'?{id:'new'}:projects}));
  vi.stubGlobal('fetch',request);
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();});
const render=()=>act(async()=>root.render(<AdminPage/>));
const click=(text:string)=>act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent===text)!.click());
const fill=(field:HTMLInputElement,value:string)=>act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));});
const submit=(form:HTMLFormElement)=>act(async()=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
it('shows the library first, with creation forms closed and no API mutations',async()=>{
  await render();
  expect(host.querySelector('h1')!.textContent).toBe('Article library');
  expect(host.querySelector<HTMLElement>('#admin-create-panel')!.hidden).toBe(true);
  expect(request.mock.calls.every(([,options])=>options.method==='GET')).toBe(true);
});
it('opens the requested form and preserves its draft when closed',async()=>{
  await render();await click('New project');
  const form=host.querySelector<HTMLFormElement>('form:not([hidden])')!;
  const field=form.querySelector('input')!;
  expect(document.activeElement).toBe(field);
  fill(field,'Next issue');
  await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Close create panel"]')!.click());
  expect(document.activeElement?.textContent).toBe('New project');
  await click('New project');expect(field.value).toBe('Next issue');
});
it('creates a project with the existing API and closes the form after success',async()=>{
  await render();await click('New project');
  const form=host.querySelector<HTMLFormElement>('form:not([hidden])')!;
  fill(form.querySelector('input')!,'New issue');await submit(form);
  const post=request.mock.calls.find(([url,options])=>url.endsWith('projects')&&options.method==='POST')!;
  expect(JSON.parse(String(post[1].body))).toEqual({name:'New issue'});
  expect((post[1].headers as Record<string,string>)['X-CSRF-Token']).toBe('test-csrf');
  expect(host.querySelector<HTMLElement>('#admin-create-panel')!.hidden).toBe(true);
  expect(host.textContent).toContain('Project created');
});
it('creates a blank article with its correct project, title and filename',async()=>{
  await render();await click('Add article');
  const form=host.querySelector<HTMLFormElement>('form:not([hidden])')!;
  fill(form.querySelector('input')!,'A new article.json');await submit(form);
  const post=request.mock.calls.find(([url,options])=>url.endsWith('projects/p/documents')&&options.method==='POST')!;
  const body=JSON.parse(String(post[1].body));
  expect(body.name).toBe('A new article.json');expect(body.doc.meta.title).toBe('A new article');
  expect(host.textContent).toContain('Article created');
});
it('keeps the form and entered name when a request fails',async()=>{
  await render();await click('New project');
  const form=host.querySelector<HTMLFormElement>('form:not([hidden])')!;
  fill(form.querySelector('input')!,'Keep this draft');
  request.mockResolvedValueOnce({ok:false,json:async()=>({error:'That name is already used.'})});
  await submit(form);
  expect(host.querySelector('[role=alert]')?.textContent).toContain('already used');
  expect(form.querySelector('input')!.value).toBe('Keep this draft');
  expect(host.querySelector<HTMLElement>('#admin-create-panel')!.hidden).toBe(false);
});
it('requires a project before adding an article',async()=>{
  request.mockImplementation(async(url:string)=>({ok:true,json:async()=>url.endsWith('auth/session')?{csrf:'test-csrf'}:[]}));
  await render();
  expect([...host.querySelectorAll('button')].find(b=>b.textContent==='Add article')!.disabled).toBe(true);
  expect(host.textContent).toContain('Your next issue starts here');
});
