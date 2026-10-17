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
  vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
  request=vi.fn(async(url:string,options:RequestInit)=>({ok:true,json:async()=>url.endsWith('auth/session')?{csrf:'test-csrf'}:url.endsWith('projects')&&options.method==='POST'?{id:'new'}:projects}));
  vi.stubGlobal('fetch',request);
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
const render=()=>act(async()=>root.render(<AdminPage/>));
const click=(text:string)=>act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent===text)!.click());
const fill=(field:HTMLInputElement,value:string)=>act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));});
const submit=(form:HTMLFormElement)=>act(async()=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
it('layers the supplied film separately from the sign-in form, without a top bar or marketing introduction',async()=>{
  request.mockImplementation(async()=>({ok:false,json:async()=>({error:'Sign in required.'})}));
  await render();
  expect(host.querySelector('.admin-header')).toBeNull();expect(host.querySelector('.admin-intro')).toBeNull();
  expect(host.querySelector('.admin-footnote')).toBeNull();expect(host.textContent).not.toContain('Good stories start here');
  const card=host.querySelector('.admin-login')!;
  expect(card.querySelector('img[alt="Magazoo!"]')).not.toBeNull();expect(card.querySelector('h1')!.textContent).toBe('Sign in');
  expect(card.querySelector('a')!.getAttribute('href')).toBe('/#editor');
  const layout=host.querySelector('.admin-login-layout')!;
  expect(layout.children[0].className).toBe('admin-login-visual');expect(layout.children[1]).toBe(card);
  expect(card.querySelector('video')).toBeNull(); // film never interferes with form input or readability.
  expect(host.querySelector('.admin-page--signin')).not.toBeNull();
});
it('lets the author reveal and conceal their password without submitting or changing it',async()=>{
  request.mockImplementation(async()=>({ok:false,json:async()=>({error:'Sign in required.'})}));
  await render();const field=host.querySelector<HTMLInputElement>('#admin-login-password')!;
  fill(field,'Local-test-only');const requestsBefore=request.mock.calls.length;
  const reveal=host.querySelector<HTMLButtonElement>('[aria-label="Show password"]')!;
  await act(async()=>reveal.click());expect(field.type).toBe('text');expect(field.value).toBe('Local-test-only');
  expect(reveal.getAttribute('aria-label')).toBe('Hide password');expect(reveal.getAttribute('aria-pressed')).toBe('true');
  await act(async()=>reveal.click());expect(field.type).toBe('password');expect(field.value).toBe('Local-test-only');
  expect(request.mock.calls.length).toBe(requestsBefore);expect(reveal.type).toBe('button');
});
it('preserves the existing sign-in request and switches to the normal library after successful login',async()=>{
  request.mockImplementation(async(url:string)=>({ok:!url.endsWith('auth/session'),json:async()=>url.endsWith('auth/session')?{error:'Sign in required.'}:url.endsWith('auth/login')?{csrf:'test-csrf'}:projects}));
  await render();const form=host.querySelector('form')!;
  fill(form.querySelector('input')!,'Local-test-only');await submit(form);
  const login=request.mock.calls.find(([url])=>url.endsWith('auth/login'))!;
  expect(login[1].method).toBe('POST');expect(JSON.parse(String(login[1].body))).toEqual({password:'Local-test-only'});
  expect(host.querySelector('.admin-login')).toBeNull();expect(host.querySelector('video')).toBeNull();
  expect(host.querySelector('.admin-header')).not.toBeNull();expect(host.querySelector('h1')!.textContent).toBe('Article library');
});
it('keeps a failed sign-in inside the card and preserves the entered password for correction',async()=>{
  request.mockImplementation(async(url:string)=>({ok:false,json:async()=>({error:url.endsWith('auth/login')?'Incorrect admin password.':'Sign in required.'})}));
  await render();const form=host.querySelector('form')!;fill(form.querySelector('input')!,'Local-test-only');await submit(form);
  expect(host.querySelector('.admin-login [role=alert]')?.textContent).toBe('Incorrect admin password.');
  expect(form.querySelector('input')!.value).toBe('Local-test-only');expect(host.querySelector('.admin-login-editor')).not.toBeNull();
});
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
  expect(host.textContent).toContain('No projects yet.');
});

it('keeps dashboard copy functional without promotional taglines',async()=>{
  await render();
  for(const phrase of ['A little more organised','A lot more room','Pick up where you left off','Made for editorial work','place to grow','blank canvas for your next issue'])expect(host.textContent).not.toContain(phrase);
  expect(host.querySelector('.admin-intro p')).toBeNull();
  expect(host.querySelector('.admin-library-title p')).toBeNull();
  await click('New project');
  expect(host.textContent).toContain('Group articles in a named project.');
  expect(request.mock.calls.every(([,options])=>options.method==='GET')).toBe(true);
});
