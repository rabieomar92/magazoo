import {useDoc} from '../../store/useDoc';
import {usePdfPageSize} from '../../store/pdfPreferences';
import {PDF_PAGE_SIZES} from '../../lib/pdfPageSize';
import {documentBleed} from '../../lib/documentBleed';
import {LabeledNumber,Section} from '../Field';
export function BleedSection(){
 const bleed=useDoc(s=>documentBleed(s.doc.design.bleedMm)),update=useDoc(s=>s.update);
 const marks=useDoc(s=>s.doc.design.cropMarks??s.doc.design.projectLayout===true),project=useDoc(s=>s.doc.design.projectLayout===true);
 const [size]=usePdfPageSize(),trim=PDF_PAGE_SIZES[size];
 return <Section title="Print bleed">{project?<p className="hint">{bleed} mm per edge · managed in Project settings for all documents.</p>:<LabeledNumber label="Bleed per edge" unit="mm" min={0} max={10} step={.5} value={bleed} onChange={value=>update(doc=>{doc.design.bleedMm=documentBleed(value);doc.design.bleedCanvas=true;})}/>}
 <label><input type="checkbox" checked={marks} onChange={event=>update(doc=>{doc.design.cropMarks=event.target.checked;})}/> Include printed crop marks</label>
 <p className="hint">Trim {trim.width} × {trim.height} mm · canvas and bleed PDF {trim.width+bleed*2} × {trim.height+bleed*2} mm. {marks?'Cut marks appear only at the corners inside the bleed. ':''}Original PDFs crop back to the trim without reflowing the page.</p></Section>;
}
