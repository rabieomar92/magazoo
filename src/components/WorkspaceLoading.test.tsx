import {readFileSync} from 'node:fs';
import {act} from 'react';import {createRoot} from 'react-dom/client';import {expect,it,vi} from 'vitest';import {WorkspaceLoading} from './WorkspaceLoading';
it('keeps the loading paper borderless rather than drawing fake trim lines',()=>{
 expect(readFileSync('src/components/WorkspaceLoading.css','utf8')).toMatch(/\.workspace-loading-paper\{[^}]*border:0;/);
});
it('matches destination chrome and reserves paper only when its size is actually known',()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const host=document.createElement('div'),root=createRoot(host);
 try{
  act(()=>root.render(<WorkspaceLoading destination="editor" panelWidth={352}>Opening editor</WorkspaceLoading>));
  expect(host.querySelector('[data-loading-destination="editor"]')).not.toBeNull();
  expect(host.querySelector('.workspace-loading-inspector')).not.toBeNull();
  expect(host.querySelector<HTMLElement>('.workspace-loading')!.style.getPropertyValue('--loading-panel')).toBe('352px');
  expect(host.querySelector('.workspace-loading-paper')).toBeNull();
  act(()=>root.render(<WorkspaceLoading destination="issue" canvasOnly pageSize="jis-b5">Compiling</WorkspaceLoading>));
  expect(host.querySelector('.workspace-loading-toolbar,.workspace-loading-inspector')).toBeNull();
  expect(host.querySelector('.workspace-loading-paper')).not.toBeNull();
  expect(host.querySelector<HTMLElement>('.workspace-loading')!.style.getPropertyValue('--loading-paper-ratio')).toBe('182 / 257');
  act(()=>root.render(<WorkspaceLoading destination="library">Opening library</WorkspaceLoading>));
  expect(host.querySelector('.workspace-loading-inspector,.workspace-loading-paper')).toBeNull();
  expect(host.querySelector('.workspace-loading-filters')).not.toBeNull();
 }finally{act(()=>root.unmount());vi.unstubAllGlobals();}
});
