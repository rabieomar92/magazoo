import { useDoc } from '../../store/useDoc';
import { topBarVisible } from '../../lib/topBar';
import { LabeledInput, Section, Toggle } from '../Field';

export function TopBarSection() {
  const doc = useDoc(s => s.doc);
  const update = useDoc(s => s.update);
  return <Section title="Top bar visibility">
    <Toggle label="Show top bar" checked={topBarVisible(doc)} onChange={visible => update(d => { d.design.showTopBar = visible; })} />
    {doc.templateId === 'backcover-1' && topBarVisible(doc) && <LabeledInput label="Top bar text" editorTarget="meta-masthead" value={doc.meta.masthead ?? ''} onChange={value => update(d => { d.meta.masthead = value; })} />}
    <p className="hint">Show or hide the running bar on every page of this document. Its text, colours and alternating side are kept. Cover titles, page numbers and margin text are independent.</p>
  </Section>;
}
