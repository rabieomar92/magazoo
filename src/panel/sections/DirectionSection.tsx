import { useDoc } from '../../store/useDoc';
import { setTextDirection, dropCapEnabled } from '../../lib/textDirection';
import { Section, SegmentField, Toggle } from '../Field';

/** Shared by every family, including covers and front matter. */
export function DirectionSection() {
  const direction=useDoc(s=>s.doc.design.textDirection??'ltr');
  const update=useDoc(s=>s.update);
  const template=useDoc(s=>s.doc.templateId);
  const initial=useDoc(s=>dropCapEnabled(s.doc.design,s.doc.templateId));
  const hasParagraphs=!template?.startsWith('gallery') && !['magazine-4','frontmatter-board','frontmatter-contents'].includes(template??'');
  return <Section title="Reading direction">
    <SegmentField<'ltr'|'rtl'> label="Text direction" value={direction} options={[{value:'ltr',label:'Left to right'},{value:'rtl',label:'Arabic · right to left'}]} onChange={v=>update(d=>setTextDirection(d.design,v))}/>
    <p className="hint">Applies to headings, text, captions and column order. Arabic letters stay joined. Masthead, footer and placed-image sides keep your chosen settings.</p>
    {hasParagraphs && <Toggle label="First paragraph drop cap" checked={initial} onChange={v=>update(d=>{d.design.dropCap=v;})}/>}
  </Section>;
}
