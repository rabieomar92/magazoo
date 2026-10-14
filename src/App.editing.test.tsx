import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { useEditLease } from './store/editLease';
import { loadSharedProject } from './store/sharedProject';
import { startAutosave } from './store/persist';
vi.mock('./store/persist',()=>({hydrate:vi.fn().mockResolvedValue('restored'),startAutosave:vi.fn(()=>vi.fn())}));
vi.mock('./store/sharedProject',()=>({sharedToken:()=>location.hash.match(/^#edit=(.+)$/)?.[1],loadSharedProject:vi.fn()}));
vi.mock('./panel/Toolbar',()=>({Toolbar:()=> <div>Editing toolbar</div>}));
vi.mock('./panel/Panel',()=>({Panel:()=> <textarea aria-label="Editable paragraph"/>}));
vi.mock('./panel/TypographyToolbar',()=>({TypographyProvider:({children}:{children:React.ReactNode})=>children,TypographyToolbar:()=>null}));
vi.mock('./paper/PaperPreview',()=>({PaperPreview:()=> <div>Preview</div>}));
vi.mock('./components/SharedEditingAccess',()=>({SharedEditingAccess:()=> <div>Editing access</div>}));
let host:HTMLDivElement,root:ReturnType<typeof createRoot>;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.clearAllMocks();history.replaceState(null,'','/#edit=test');useEditLease.setState({status:'blocked',deadline:0});host=document.createElement('div');root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());history.replaceState(null,'','/');vi.unstubAllGlobals();});
describe('editor access gate',()=>{
  it('does not mount any editing controls or autosave while another editor holds access',async()=>{
    await act(async()=>root.render(<App/>));expect(host.querySelector('textarea')).toBeNull();expect(startAutosave).not.toHaveBeenCalled();
  });
  it('unmounts editing controls and stops autosave immediately when ownership is lost',async()=>{
    vi.mocked(loadSharedProject).mockImplementationOnce(async()=>{useEditLease.setState({status:'active',deadline:Date.now()+180000});});
    await act(async()=>root.render(<App/>));expect(host.querySelector('textarea')).not.toBeNull();expect(startAutosave).toHaveBeenCalledOnce();
    const stop=vi.mocked(startAutosave).mock.results[0].value;
    act(()=>useEditLease.setState({status:'lost'}));expect(host.querySelector('textarea')).toBeNull();expect(stop).toHaveBeenCalledOnce();
  });
  it('restarts local autosave after switching a shared project to a local file',async()=>{
    useEditLease.setState({status:'active',deadline:Date.now()+180000});await act(async()=>root.render(<App/>));
    const stop=vi.mocked(startAutosave).mock.results[0].value;
    act(()=>{history.replaceState(null,'','/');useEditLease.setState({status:'local'});});
    expect(stop).toHaveBeenCalledOnce();expect(startAutosave).toHaveBeenCalledTimes(2);expect(host.querySelector('textarea')).not.toBeNull();
  });
});
