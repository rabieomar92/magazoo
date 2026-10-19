import {useDoc} from '../../store/useDoc';
import {usePdfPageSize} from '../../store/pdfPreferences';
import {PDF_PAGE_SIZES} from '../../lib/pdfPageSize';
import {documentBleed} from '../../lib/documentBleed';
import {LabeledNumber,Section} from '../Field';
export function BleedSection(){
 const bleed=useDoc(s=>documentBleed(s.doc.design.bleedMm)),update=useDoc(s=>s.update);
 const marks=useDoc(s=>s.doc.design.cropMarks===true),extra=marks?12:0;
 const [size]=usePdfPageSize(),trim=PDF_PAGE_SIZES[size];
 return <Section title="Print bleed"><LabeledNumber label="Bleed per edge" unit="mm" min={0} max={10} step={.5} value={bleed} onChange={value=>update(doc=>{doc.design.bleedMm=documentBleed(value);})}/>
 <label><input type="checkbox" checked={marks} onChange={event=>update(doc=>{doc.design.cropMarks=event.target.checked;})}/> Include printed crop marks</label>
 <p className="hint">Trim {trim.width} × {trim.height} mm · exported PDF {trim.width+bleed*2+extra} × {trim.height+bleed*2+extra} mm. {marks?'Crop marks sit in an extra 6 mm white area outside each bleed edge. ':''}Faint cut lines appear only on the canvas. Text keeps its original size. Use 0 for no bleed.</p></Section>;
}
