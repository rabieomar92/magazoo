import { useRef, useState } from 'react';
import { BusyIndicator } from '../components/BusyIndicator';
import { importIssuePdf } from './externalPdf';
import type { ExternalIssuePdf } from './model';

export function IssuePdfImport({disabled,onImport}:{disabled:boolean;onImport:(pdf:ExternalIssuePdf)=>void}) {
  const input=useRef<HTMLInputElement>(null);
  const [loading,setLoading]=useState(false),[error,setError]=useState('');
  return <div className="issue-pdf-import">
    <input ref={input} type="file" accept=".pdf,application/pdf" hidden aria-label="Choose PDF to import" disabled={disabled||loading} onChange={async event=>{
      const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(!file)return;
      setLoading(true);setError('');
      try { onImport(await importIssuePdf(file)); }
      catch(failure){setError(failure instanceof Error?failure.message:'Could not import this PDF.');}
      finally{setLoading(false);}
    }} />
    <button type="button" className="issue-pdf-import-button" disabled={disabled||loading} onClick={()=>input.current?.click()} title="Up to 20 pages, 8 MB. Original PDF retained; printed as fixed artwork at up to 300 dpi.">
      {loading?<BusyIndicator label="Importing PDF…"/>:<><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M14 3H5v18h14V8ZM14 3v5h5M12 11v7m-3-3 3 3 3-3" /></svg>Import PDF</>}
    </button>
    {error&&<p className="inline-alert" role="alert">{error}</p>}
  </div>;
}
