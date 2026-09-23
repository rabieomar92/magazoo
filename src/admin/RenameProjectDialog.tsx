import { useEffect, useRef, useState } from 'react';

export default function RenameProjectDialog({ name, close, rename }: {
  name: string; close: () => void; rename: (name: string) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="admin-dialog" aria-labelledby="rename-project-title" onCancel={event => { if (busy) event.preventDefault(); else close(); }}>
    <form onSubmit={async event => {
      event.preventDefault();
      if (busy || !value.trim() || value.trim() === name) return;
      setBusy(true); setError('');
      try { await rename(value.trim()); }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not rename this project. Please try again.'); }
      finally { setBusy(false); }
    }}>
      <h2 id="rename-project-title">Rename project</h2>
      <p>Documents, private editing links and the saved issue arrangement stay unchanged.</p>
      <label>Project name<input autoFocus required maxLength={120} value={value} disabled={busy} onChange={event => setValue(event.target.value)} /></label>
      {error && <p className="admin-alert" role="alert">{error}</p>}
      <div className="admin-actions"><button type="button" disabled={busy} onClick={close}>Cancel</button><button type="submit" className="primary" disabled={busy || !value.trim() || value.trim() === name}>{busy ? 'Renaming…' : 'Save name'}</button></div>
    </form>
  </dialog>;
}
