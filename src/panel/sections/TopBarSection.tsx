import { useDoc } from '../../store/useDoc';
import { topBarVisible } from '../../lib/topBar';
import { LabeledColor,LabeledInput,LabeledNumber,SegmentField,Section,Toggle } from '../Field';
import {DEFAULT_TOP_BAR_OFFSET} from '../../schema/document';
import {TypographyControl} from '../TypographyToolbar';
import {useProjectFile} from '../../store/projectFiles';

export function TopBarSection({complete=false}:{complete?:boolean}) {
  const doc = useDoc(s => s.doc);
  const update = useDoc(s => s.update);
  const target=useProjectFile(s=>s.target);
  const projectName=target?.kind==='online'?target.projectName:undefined;
  return <Section title={complete?'Top bar & masthead':'Top bar visibility'} collapsible defaultOpen={complete} editorTarget={complete?'design-topbar':undefined}>
    <Toggle label="Show top bar" checked={topBarVisible(doc)} onChange={visible => update(d => { d.design.showTopBar = visible; })} />
    {(complete||doc.templateId === 'backcover-1') && <LabeledInput label="Top bar text" editorTarget="meta-masthead" value={doc.meta.masthead ?? ''} onChange={value => update(d => { d.meta.masthead = value; })} />}
    {complete&&<>
      <LabeledInput label="Issue / date" editorTarget="meta-volume" value={doc.meta.volume??''} onChange={value=>update(d=>{d.meta.volume=value;d.meta.volumeMode='custom';})}/>
      {projectName && <button type="button" disabled={doc.meta.volumeMode==='project'} onClick={()=>update(d=>{d.meta.volume=projectName;d.meta.volumeMode='project';})}>Use project name</button>}
      <SegmentField label="First masthead side" value={doc.design.barSide??'left'} options={[{value:'left',label:'Left'},{value:'right',label:'Right'}]} onChange={value=>update(d=>{d.design.barSide=value;})}/>
      <Toggle label="Align masthead box to text margin" checked={doc.design.mastheadAlignMargin!==false} onChange={value=>update(d=>{d.design.mastheadAlignMargin=value;})}/>
      <LabeledNumber label="Distance from top edge" unit="mm" min={0} max={40} step={.5} value={doc.design.topBarOffset??DEFAULT_TOP_BAR_OFFSET} onChange={value=>update(d=>{d.design.topBarOffset=value;})}/>
      <LabeledColor label="Bar line" value={doc.design.barColor??'#111418'} onChange={value=>update(d=>{d.design.barColor=value;})}/>
      <LabeledColor label="Masthead background" value={doc.design.barTagColor??'#bfbfbf'} onChange={value=>update(d=>{d.design.barTagColor=value;})}/>
      <TypographyControl group="masthead" order={40} property="color"><LabeledColor label="Masthead text colour" value={doc.design.barTagInk??'#111418'} onChange={value=>update(d=>{d.design.barTagInk=value;})}/></TypographyControl>
      <p className="hint">The masthead, page number and side text alternate together. Text is uppercase; its typography is in the top formatting bar.</p>
    </>}
    <p className="hint">Show or hide the running bar on every page of this document. Its text, colours and alternating side are kept. Cover titles, page numbers and margin text are independent.</p>
  </Section>;
}
