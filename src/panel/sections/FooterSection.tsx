import { useDoc } from '../../store/useDoc';
import { pageFooter, footerBottomOffset, MAX_FOOTER_BOTTOM_OFFSET } from '../../lib/pageFooter';
import { Section, Toggle, LabeledInput, LabeledNumber, LabeledSelect } from '../Field';
import { ALL_FONTS, fontOptions } from '../../lib/fonts';

export function FooterSection() {
  const doc = useDoc(s => s.doc);
  const update = useDoc(s => s.update);
  const footer = pageFooter(doc, 0);
  return <Section title="Page footer">
    <Toggle label="Show page footer" checked={footer.enabled} onChange={v => update(d => { d.footer = { ...d.footer, enabled: v }; })} />
    <LabeledInput editorTarget="footer-text" label="Footer text / magazine name" value={footer.text} onChange={v => update(d => { d.footer = { ...d.footer, text: v }; })} />
    <LabeledNumber editorTarget="footer-number" label="Starting page number" value={footer.number} min={0} max={99999} onChange={v => update(d => { d.footer = { ...d.footer, startNumber: Math.max(0, Math.min(99999, Math.round(v))) }; })} />
    <LabeledNumber editorTarget="footer-distance" label="Distance from bottom edge" unit="mm" value={footerBottomOffset(doc)} min={0} max={MAX_FOOTER_BOTTOM_OFFSET} step={0.5} onChange={v => update(d => { d.footer = { ...d.footer, bottomOffset: Math.max(0, Math.min(MAX_FOOTER_BOTTOM_OFFSET, v)) }; })} />
    <LabeledSelect editorTarget="footer-font" label="Footer font" value={footer.fontFamily} options={fontOptions(ALL_FONTS)} onChange={v => update(d => { d.footer = { ...d.footer, fontFamily: v }; })} />
    <LabeledNumber editorTarget="footer-font-size" label="Footer size" unit="pt" value={footer.fontSize} min={5} max={18} step={0.5} onChange={v => update(d => { d.footer = { ...d.footer, fontSize: Math.max(5, Math.min(18, v)) }; })} />
    <LabeledSelect label="First masthead & footer side" value={doc.design.barSide ?? 'left'} options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]} onChange={v => update(d => { d.design.barSide = v as 'left' | 'right'; })} />
    <p className="hint">Numbers alternate with the masthead; magazine text sits opposite. Distance is measured below the footer text box. Increasing it moves both items up and reserves room below the content, without changing line spacing or column widths.</p>
  </Section>;
}
