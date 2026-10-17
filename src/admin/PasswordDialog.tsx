import {useEffect,useRef,useState} from 'react';
import {AdminIcon} from './AdminIcon';

/** Transient credentials only: never included in article JSON or storage. */
export function PasswordDialog({close,save}:{close:()=>void;save:(data:{currentPassword:string;newPassword:string;confirmation:string})=>Promise<void>}){
  const dialog=useRef<HTMLDialogElement>(null);
  const[currentPassword,setCurrent]=useState(''),[newPassword,setNext]=useState(''),[confirmation,setConfirmation]=useState('');
  const[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const opener=document.activeElement as HTMLElement|null,element=dialog.current;element?.showModal();element?.querySelector('input')?.focus();return()=>{if(element?.open)element.close();if(opener?.isConnected)opener.focus();};},[]);
  return <dialog ref={dialog} className="admin-password-dialog" aria-labelledby="password-dialog-title" onCancel={event=>{event.preventDefault();if(!busy)close();}}>
    <header><h2 id="password-dialog-title">Change administrator password</h2><button type="button" className="admin-icon-button" aria-label="Close password settings" disabled={busy} onClick={close}><AdminIcon name="close"/></button></header>
    <p>Use a unique passphrase of at least 15 characters. Other administrator sessions will be signed out. Article links and data stay unchanged.</p>
    {error&&<div className="admin-alert" role="alert">{error}</div>}
    <form onSubmit={async event=>{event.preventDefault();setError('');if(newPassword!==confirmation){setError('The new passwords do not match.');return;}setBusy(true);
      try{await save({currentPassword,newPassword,confirmation});setCurrent('');setNext('');setConfirmation('');close();}
      catch(e){setError(e instanceof Error?e.message:'Password could not be changed.');}finally{setBusy(false);}}}>
      <fieldset disabled={busy}><label>Current password<input type="password" autoComplete="current-password" autoFocus required maxLength={512} value={currentPassword} onChange={e=>setCurrent(e.target.value)}/></label>
        <label>New password<input type="password" autoComplete="new-password" required minLength={15} maxLength={512} value={newPassword} onChange={e=>setNext(e.target.value)}/></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" required minLength={15} maxLength={512} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
        <div className="admin-actions"><button type="button" onClick={close}>Cancel</button><button type="submit" className="primary" disabled={!currentPassword||newPassword.trim().length<15||!confirmation}>{busy?'Updating…':'Change password'}</button></div>
      </fieldset>
    </form>
  </dialog>;
}
