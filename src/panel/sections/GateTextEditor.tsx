import type { ReactNode } from 'react';
import type { GateTextRole, GateTextStyle } from '../../schema/document';
import { useDoc } from '../../store/useDoc';
import { fontOptions } from '../../lib/fonts';
import { gateTypography } from '../../lib/gateTypography';
import { clampSpacing, TEXT_SPACE_AFTER } from '../../lib/spacing';
import { editorTargetId } from '../../lib/editorNavigation';
import { LabeledColor, LabeledNumber, LabeledSelect, LabeledTextarea, Toggle } from '../Field';

const fields = {
  title: ['title', 'Title', 'meta-title'],
  kicker: ['categoryLabel', 'Category / kicker', 'meta-category'],
  subtitle: ['subtitle', 'Subtitle', 'meta-subtitle'],
  quote: ['pullQuote', 'Pull quote', 'meta-pull-quote'],
  attribution: ['pullQuoteBy', 'Quote attribution', 'meta-pull-quote-by'],
  author: ['author', 'Author', 'meta-author'],
  photoCredit: ['photoCredit', 'Photo credit', 'meta-photo-credit'],
} as const;

/** Copy and its typography stay together; preview clicks open this exact group. */
export function GateTextEditor({ role, children }: { role: GateTextRole; children?: ReactNode }) {
  const doc = useDoc(s => s.doc);
  const update = useDoc(s => s.update);
  const [field, label, target] = fields[role];
  const style = gateTypography(doc.design, role);
  const set = (patch: GateTextStyle) => update(d => {
    d.design.gateTypography = { ...d.design.gateTypography, [role]: { ...d.design.gateTypography?.[role], ...patch } };
  });
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  return <details className="gate-text-editor" id={editorTargetId(target)} open={role === 'title' || role === 'subtitle'}>
    <summary>{label}<span>Text & typography</span></summary>
    <div className="gate-control-stack">
      <LabeledTextarea label={`${label} text`} rows={role === 'subtitle' || role === 'quote' ? 4 : 2} value={doc.meta[field] ?? ''} onChange={v => update(d => { d.meta[field] = v; })} />
      <LabeledSelect label={`${label} font`} value={style.fontFamily} options={fontOptions()} onChange={fontFamily => set({ fontFamily })} />
      <LabeledNumber label={`${label} size`} unit="pt" value={style.fontSize} min={6} max={100} step={.5} onChange={v => set({ fontSize: clamp(v, 6, 100) })} />
      <LabeledSelect label={`${label} weight`} value={String(style.fontWeight)} options={[{ value: '300', label: 'Light' }, { value: '400', label: 'Regular' }, { value: '500', label: 'Medium' }, { value: '600', label: 'Semibold' }, { value: '700', label: 'Bold' }, { value: '800', label: 'Extra bold' }, { value: '900', label: 'Black' }]} onChange={v => set({ fontWeight: Number(v) })} />
      <Toggle label={`${label} italic`} checked={style.italic} onChange={italic => set({ italic })} />
      <LabeledColor label={`${label} colour`} value={style.color} onChange={color => set({ color })} />
      <div className="gate-spacing-fields">
        <LabeledNumber label={`${label} line height`} unit="×" value={style.lineHeight} min={.8} max={2.5} step={.05} onChange={v => set({ lineHeight: clamp(v, .8, 2.5) })} />
        {doc.design.textDirection === 'rtl' ? <p className="hint">Letter spacing is natural in Arabic to preserve joined letters. Your Latin spacing is kept for switching back.</p> : <LabeledNumber label={`${label} letter spacing`} unit="px" value={Math.round(style.letterSpacing * 100) / 100} min={-3} max={12} step={.1} onChange={v => set({ letterSpacing: clamp(v, -3, 12) })} />}
        {['kicker', 'subtitle', 'quote', 'author'].includes(role) && <>
          <LabeledNumber label={`Space after ${label.toLowerCase()}`} unit="px" value={style.spaceAfter} min={TEXT_SPACE_AFTER.min} max={TEXT_SPACE_AFTER.max} onChange={v => set({ spaceAfter: clampSpacing(v, TEXT_SPACE_AFTER) })} />
          <p className="hint">Negative spacing brings the next text closer and can overlap it. Line height and font size must remain positive.</p>
        </>}
      </div>
      {children}
      {role === 'quote' && <>
        <LabeledNumber
          label="Quote divider thickness"
          unit="px"
          value={doc.design.gateQuoteRule ?? 3}
          min={0}
          max={12}
          step={.5}
          onChange={v => update(d => { d.design.gateQuoteRule = clamp(v, 0, 12); })}
        />
        <p className="hint">Set to 0 to remove the line above the quote.</p>
      </>}
      <button type="button" className="add-btn" onClick={() => update(d => { if (d.design.gateTypography) delete d.design.gateTypography[role]; })}>Reset {label.toLowerCase()} style</button>
    </div>
  </details>;
}
