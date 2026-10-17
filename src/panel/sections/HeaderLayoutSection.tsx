import {useDoc} from '../../store/useDoc';
import {articleGeometry,isReferenceArticle} from '../../lib/articleLayouts';
import {LabeledNumber,Section} from '../Field';
export function HeaderLayoutSection(){
  const doc=useDoc(s=>s.doc),update=useDoc(s=>s.update);
  if(doc.templateId==='frontmatter-dean')return <Section title="Heading layout & spacing">
    <LabeledNumber label="Gap above category" unit="mm" min={0} max={40} step={.5} value={doc.design.deanCategoryTopGap??0} onChange={value=>update(d=>{d.design.deanCategoryTopGap=value;})}/>
    <LabeledNumber label="Gap below title" unit="mm" min={0} max={35} step={.5} value={doc.design.deanTitleBottomGap??(doc.meta.subtitle?4:8)} onChange={value=>update(d=>{d.design.deanTitleBottomGap=value;})}/>
  </Section>;
  return <Section title="Heading layout & spacing" editorTarget="header-layout">
    <p className="hint">Font, weight, colour and character spacing follow the selected heading in the top formatting bar.</p>
    <LabeledNumber label="Top to title" unit="mm" min={0} max={250} step={.5} value={isReferenceArticle(doc.templateId)?articleGeometry(doc.templateId,doc.design).titleTop:doc.design.firstPageTopMargin??0} onChange={value=>update(d=>{d.design.firstPageTopMargin=value;})}/>
    <button type="button" className="add-btn" onClick={()=>update(d=>{delete d.design.firstPageTopMargin;})}>Reset heading position</button>
  </Section>;
}
