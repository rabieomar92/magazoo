import {act} from 'react';import {createRoot} from 'react-dom/client';import {expect,it,vi} from 'vitest';import {ProjectSetup} from './ProjectSetup';
it('reviews paper and per-edge bleed before creating a project',()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const host=document.createElement('div');document.body.append(host);const root=createRoot(host),save=vi.fn();
 try{
  act(()=>root.render(<ProjectSetup name="Issue" busy={false} onSave={save} onCancel={()=>{}}/>));
  const submit=()=>act(()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  submit();expect(save).not.toHaveBeenCalled();expect(host.textContent).toContain('188 × 263 mm');
  submit();expect(save).not.toHaveBeenCalled();expect(host.textContent).toContain('Original PDF');
  submit();expect(save).toHaveBeenCalledWith({paperSize:'jis-b5',bleedMm:3});
 }finally{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
