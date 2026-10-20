import {useEffect,useRef,useState} from 'react';
import {PDF_PAGE_SIZES,customPageSize,paperSize} from '../lib/pdfPageSize';
import type {ProjectSettings} from '../lib/projectSettings';
export function ProjectSetup({name,onName,initial,busy,onSave,onCancel,editing=false}:{name:string;onName?:(name:string)=>void;initial?:ProjectSettings;busy:boolean;onSave:(settings:ProjectSettings)=>void;onCancel:()=>void;editing?:boolean}){
 const [step,setStep]=useState(editing?1:0),[settings,setSettings]=useState<ProjectSettings>(initial??{paperSize:'jis-b5',bleedMm:3});
 const [custom,setCustom]=useState(initial?.paperSize.startsWith('custom:')??false);
 const initialTrim=paperSize(initial?.paperSize??'jis-b5');
 const [width,setWidth]=useState(initialTrim.width),[height,setHeight]=useState(initialTrim.height);
 const validDimensions=Number.isFinite(width)&&Number.isFinite(height)&&width>=50&&height>=50&&width<=480&&height<=480;
 const effective=custom&&validDimensions?{...settings,paperSize:customPageSize(width,height)}:settings;
 const trim=paperSize(effective.paperSize),b=settings.bleedMm;
 return <form className="project-setup" onSubmit={e=>{e.preventDefault();if(custom&&!validDimensions)return;if(step<2)setStep(step+1);else onSave(effective);}}>
  <nav className="project-setup-progress" aria-label="Project setup progress">{['Identity','Format','Review'].map((label,i)=><span key={label} aria-current={step===i?'step':undefined}>{i+1} · {label}</span>)}</nav>
  <fieldset disabled={busy}>
  {step===0&&<label>Project name<input required maxLength={120} value={name} onChange={e=>onName?.(e.target.value)} placeholder="FIRST ISSUE, 2026" autoFocus/></label>}
  {step===1&&<><h3>One format for the whole issue</h3><p>Every document shares this editable canvas. Artwork can extend into the bleed; corner guides show where the printer cuts.</p><label>Trim paper size<select value={custom?'custom':settings.paperSize} onChange={e=>{setCustom(e.target.value==='custom');if(e.target.value!=='custom')setSettings({...settings,paperSize:e.target.value as ProjectSettings['paperSize']});}}>{Object.entries(PDF_PAGE_SIZES).map(([key,size])=><option key={key} value={key}>{size.label} · {size.width} × {size.height} mm</option>)}<option value="custom">Custom size…</option></select></label>
  {custom&&<><div className="project-custom-dimensions"><label>Trim width (mm)<input type="number" required min="50" max="480" step="0.01" value={Number.isFinite(width)?width:''} onChange={e=>setWidth(e.target.valueAsNumber)}/></label><label>Trim height (mm)<input type="number" required min="50" max="480" step="0.01" value={Number.isFinite(height)?height:''} onChange={e=>setHeight(e.target.valueAsNumber)}/></label></div><p>Enter the finished, closed-page size, before bleed. 50–480 mm per side.</p></>}
  <label>Bleed per edge (mm)<input type="number" required min="0" max="10" step="0.5" value={b} onChange={e=>setSettings({...settings,bleedMm:e.target.valueAsNumber})}/></label><p className="project-format-summary">Editable canvas <strong>{trim.width+2*b} × {trim.height+2*b} mm</strong><br/>Finished trim {trim.width} × {trim.height} mm</p></>}
  {step===2&&<><h3>{name}</h3><dl className="project-setup-review"><dt>Finished size</dt><dd>{trim.label} · {trim.width} × {trim.height} mm</dd><dt>Bleed</dt><dd>{b} mm on each edge</dd><dt>Editable canvas / bleed PDF</dt><dd>{trim.width+2*b} × {trim.height+2*b} mm</dd><dt>Original PDF</dt><dd>{trim.width} × {trim.height} mm, no marks</dd></dl><p>{editing?'Saving updates every document canvas. Save and close article editors first; content, image settings and reading order are preserved, but the new size may change pagination.':'Change these properties later in Project settings. Imported and new documents inherit this format automatically.'}</p></>}
  <div className="admin-actions"><button type="button" onClick={onCancel}>Cancel</button>{step>(editing?1:0)&&<button type="button" onClick={()=>setStep(step-1)}>Back</button>}<button className="primary" disabled={!name.trim()||!Number.isFinite(b)||b<0||b>10||(custom&&!validDimensions)}>{busy?'Saving…':step<2?'Continue':editing?'Save project settings':'Create project'}</button></div>
  </fieldset>
 </form>;
}
export function ProjectSettingsDialog({name,initial,save,close}:{name:string;initial?:ProjectSettings;save:(settings:ProjectSettings)=>Promise<void>;close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');useEffect(()=>dialog.current?.showModal(),[]);
 return <dialog ref={dialog} className="admin-dialog project-settings-dialog" aria-label="Project settings" onCancel={e=>{if(busy)e.preventDefault();else close();}}><h2>Project settings</h2>{error&&<p role="alert">{error}</p>}<ProjectSetup name={name} initial={initial} busy={busy} editing onCancel={close} onSave={settings=>{setBusy(true);setError('');void save(settings).catch(e=>setError(e instanceof Error?e.message:'Could not save project settings.')).finally(()=>setBusy(false));}}/></dialog>;
}
