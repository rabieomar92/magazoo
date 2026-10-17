import {act} from 'react';import {createRoot} from 'react-dom/client';import {expect,it,vi} from 'vitest';import {PasswordDialog} from './PasswordDialog';
it('requires confirmation and leaves credentials out of notices while rotating the session through its handler',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const original=Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'showModal');Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:vi.fn()});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host),save=vi.fn().mockResolvedValue(undefined),close=vi.fn();
  const edit=(input:HTMLInputElement,value:string)=>act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
  try{act(()=>root.render(<PasswordDialog save={save} close={close}/>));const inputs=host.querySelectorAll('input');edit(inputs[0],'fake-current-only');edit(inputs[1],'fake-new-long-passphrase');edit(inputs[2],'not-the-same-password');
    await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));expect(save).not.toHaveBeenCalled();expect(host.querySelector('[role=alert]')!.textContent).toContain('do not match');
    edit(inputs[2],'fake-new-long-passphrase');await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(save).toHaveBeenCalledExactlyOnceWith({currentPassword:'fake-current-only',newPassword:'fake-new-long-passphrase',confirmation:'fake-new-long-passphrase'});expect(close).toHaveBeenCalledOnce();expect(host.textContent).not.toContain('fake-new');
  }finally{act(()=>root.unmount());host.remove();if(original)Object.defineProperty(HTMLDialogElement.prototype,'showModal',original);else delete (HTMLDialogElement.prototype as unknown as {showModal?:unknown}).showModal;vi.restoreAllMocks();vi.unstubAllGlobals();}
});
