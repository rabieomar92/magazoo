import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { IssueAssignment, IssueItem, IssuePlan, IssuePrintSettings } from './model';
import type { PdfPageSize } from '../lib/pdfPageSize';
import { buildPrintBrief } from './printBrief';
import styles from './printBrief.css?inline';
import './printBrief.css';

function NumericSetting({label,value,min,max,step=1,placeholder='To confirm',onChange}:{label:string;value?:number;min:number;max:number;step?:number;placeholder?:string;onChange:(value:number|undefined)=>void}) {
  const [draft,setDraft]=useState(value===undefined?'':String(value));
  return <label>{label}<input type="number" min={min} max={max} step={step} placeholder={placeholder} value={draft} onChange={event=>{
    const text=event.target.value;setDraft(text);
    if(text===''){onChange(undefined);return;}
    const next=Number(text);if(Number.isFinite(next)&&next>=min&&next<=max&&(step!==1||Number.isInteger(next)))onChange(next);
  }} onBlur={()=>{
    if(draft==='')return;
    const value=Math.min(max,Math.max(min,Number(draft)||min));const next=step===1?Math.round(value):value;
    setDraft(String(next));onChange(next);
  }}/></label>;
}

export function IssuePrintBrief({title,plan,items,assignments,size,disabled,onChange}:{title:string;plan:IssuePlan;items:IssueItem[];assignments:IssueAssignment[];size:PdfPageSize;disabled:boolean;onChange:(plan:IssuePlan)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),sheet=useRef<HTMLDivElement>(null),preview=useRef<HTMLDivElement>(null);
  const titleId=useId();
  const [open,setOpen]=useState(false),[scale,setScale]=useState(.7),[error,setError]=useState('');
  const settings=plan.printSettings??{binding:'saddle-stitch',perfectMultiple:2};
  const update=(patch:Partial<IssuePrintSettings>)=>onChange({...plan,printSettings:{...settings,...patch}});
  const brief=disabled?null:buildPrintBrief(title,plan,items,assignments,size);
  useLayoutEffect(()=>{
    if(!open||!preview.current)return;
    const host=preview.current;
    const resize=()=>setScale(Math.min(1,host.clientWidth/(210*96/25.4)));
    resize();const observer=new ResizeObserver(resize);observer.observe(host);return()=>observer.disconnect();
  },[open]);
  const print=()=>{
    setError('');const original=sheet.current;if(!original)return;
    if(original.scrollHeight>original.clientHeight+2){setError('The brief exceeds one page. Shorten the production notes or document titles before exporting.');return;}
    const frame=document.createElement('iframe');frame.title='Printer specification PDF';frame.className='printer-brief-print-frame';
    frame.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;';document.body.append(frame);
    const doc=frame.contentDocument!,win=frame.contentWindow!;
    doc.open();doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');doc.close();
    doc.title=`${title} — Printer specification`;
    const css=doc.createElement('style');css.textContent=styles+'\n@page{size:A4;margin:0}html,body{margin:0;padding:0;background:white}.print-brief-sheet{transform:none!important;box-shadow:none!important}';doc.head.append(css);
    const clone=original.cloneNode(true) as HTMLElement;clone.style.transform='none';doc.body.append(clone);
    win.addEventListener('afterprint',()=>frame.remove(),{once:true});
    void doc.fonts.ready.then(()=>{win.focus();win.print();}).catch(()=>{frame.remove();setError('Could not open PDF printing. Please try again.');});
  };
  return <>
    <button type="button" className="issue-print-brief-button" disabled={disabled} onClick={()=>{setOpen(true);setError('');dialog.current?.showModal();}}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M14 3H5v18h14V8ZM14 3v5h5M8 12h8M8 16h8"/></svg>Printer brief
    </button>
    <dialog ref={dialog} className="print-brief-dialog" onClose={()=>setOpen(false)} aria-labelledby={titleId}>
      <header className="print-brief-dialog-header"><div><h2 id={titleId}>Printer brief</h2><p>One page · specifications &amp; page-order draft</p></div><button type="button" aria-label="Close printer brief" onClick={()=>dialog.current?.close()}>×</button></header>
      {open&&brief&&<>
        <div className="print-brief-inputs">
          <label>Binding<select value={settings.binding} onChange={event=>update({binding:event.target.value as IssuePrintSettings['binding']})}><option value="saddle-stitch">Stapled · saddle stitch</option><option value="perfect">Perfect bound</option></select></label>
          <NumericSetting label="Cover · GSM" value={settings.coverGsm} min={50} max={600} onChange={coverGsm=>update({coverGsm})}/>
          <NumericSetting label="Inner pages · GSM" value={settings.innerGsm} min={35} max={400} onChange={innerGsm=>update({innerGsm})}/>
          <NumericSetting label="Copies" value={settings.copies} min={1} max={1000000} onChange={copies=>update({copies})}/>
          {settings.binding==='perfect'&&<><label>Printer’s page multiple<select value={settings.perfectMultiple} onChange={event=>update({perfectMultiple:Number(event.target.value) as IssuePrintSettings['perfectMultiple']})}>{[2,4,8,16,32].map(value=><option key={value} value={value}>{value} pages</option>)}</select></label><NumericSetting label="Spine · mm" value={settings.spineMm} min={0} max={100} step={.1} placeholder="Printer to confirm" onChange={spineMm=>update({spineMm})}/></>}
          <label className="print-brief-wide">Paper / finish<input maxLength={140} placeholder="e.g. coated cover, matte lamination; uncoated interior" value={settings.paperFinish??''} onChange={event=>update({paperFinish:event.target.value})}/></label>
          <label className="print-brief-wide">Production notes<input maxLength={240} placeholder="Optional instructions for your vendor" value={settings.notes??''} onChange={event=>update({notes:event.target.value})}/></label>
        </div>
        <div className="print-brief-preview-scroll"><div ref={preview} className="print-brief-preview"><div style={{height:`${297*96/25.4*scale}px`}}>
          <div ref={sheet} className={`print-brief-sheet${brief.order.length>36?' is-dense':''}`} style={{transform:`scale(${scale})`}}>
            <header className="print-brief-masthead"><span>MAGAZOO / PRODUCTION</span><span>DRAFT · {new Date().toLocaleDateString('en-GB')}</span></header>
            <h1>{title}</h1><p className="print-brief-subtitle">Print specification &amp; page-order brief</p>
            <div className="print-brief-keyline"><strong>{settings.binding==='perfect'?'Perfect bound':'Stapled · saddle stitch'}</strong><span>{brief.pages.total} supplied PDF pages</span><span>{settings.copies?`${settings.copies} copies`:'Quantity to confirm'}</span></div>
            <section className="print-brief-facts">
              <div><h2>Format &amp; size</h2><dl><dt>Closed / trimmed</dt><dd>{brief.closed}</dd><dt>Opened reader spread</dt><dd>{brief.open}</dd><dt>Open cover, excluding bleed</dt><dd>{brief.coverOpen}</dd><dt>Spine</dt><dd>{brief.perfect?(settings.spineMm===undefined?'Printer to confirm':`${settings.spineMm} mm`):'Folded / stapled'}</dd><dt>Supplied bleed</dt><dd>{brief.bleedMm} mm per edge · {brief.output} output</dd></dl></div>
              <div><h2>Paper &amp; production</h2><dl><dt>Cover stock</dt><dd>{settings.coverGsm?`${settings.coverGsm} GSM`:'To be confirmed'}</dd><dt>Interior stock</dt><dd>{settings.innerGsm?`${settings.innerGsm} GSM`:'To be confirmed'}</dd><dt>Paper / finish</dt><dd>{settings.paperFinish||'Printer to confirm'}</dd><dt>Printing</dt><dd>Duplex · colour as supplied</dd><dt>Cover handling</dt><dd>{brief.perfect?'Separate cover + spine artwork required':'Verify inside-cover sides are included'}</dd></dl></div>
            </section>
            <section className="print-brief-pagination"><h2>Pagination check</h2><p><strong>{brief.pages.total} pages in supplied issue</strong> · {brief.pages.interior} interior + {brief.pages.cover} cover pages. All documents count, whether listed in the contents or not.</p><p>{brief.padding?`Add ${brief.padding} blank page${brief.padding===1?'':'s'} to ${brief.perfect?'the interior':'the issue'}: ${brief.basis} → ${brief.basis+brief.padding} pages`:'No additional pages needed for the selected page multiple'} ({brief.perfect?`multiple of ${settings.perfectMultiple}`:'multiple of 4'}). Blanks are not yet inserted. Vendor to confirm imposition, cover sides and minimum binding thickness.</p></section>
            <section className="print-brief-order"><div className="print-brief-section-heading"><h2>Page order / contents draft</h2><span>PDF sides · printed folios</span></div>
              <ol style={{columnCount:brief.order.length>48?3:2}}>{brief.order.map(row=><li key={row.id}><b>{row.physical}</b><div><strong>{row.title}</strong><small>{row.kind} · {row.folio==='Cover'?'unnumbered cover':row.folio==='Source PDF'?'source numbering retained':`folio ${row.folio}`}</small></div></li>)}</ol>
            </section>
            <footer className="print-brief-footer"><p>{settings.notes||'Vendor: please confirm stock, finishing, pagination and a production proof before printing.'}</p><p>{brief.hasImported?'Imported PDF pages are fixed artwork rendered at up to 300 dpi; original PDFs are retained in the arrangement. ':''}Reader-order pages supplied; printer to impose. {brief.bleedMm>0?'Bleed artwork is extended automatically; approve edge details with the printer.':'No bleed supplied; confirm whether the printer requires it.'} Sizes are width × height.</p></footer>
          </div>
        </div></div></div>
      </>}
      <footer className="print-brief-dialog-footer">{error&&<p role="alert">{error}</p>}<button type="button" onClick={()=>dialog.current?.close()}>Close</button><button type="button" className="primary" onClick={print} disabled={!brief}>Save as PDF</button></footer>
    </dialog>
  </>;
}
