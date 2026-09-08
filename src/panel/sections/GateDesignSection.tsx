import type { GateTextPlacement } from '../../schema/document';
import { DEFAULT_TOP_BAR_OFFSET } from '../../schema/document';
import { useDoc } from '../../store/useDoc';
import { gatePlacement, clampGate } from '../../lib/gatePlacement';
import { LabeledColor, LabeledInput, LabeledNumber, Section, SegmentField, Toggle } from '../Field';
import { GateTextEditor } from './GateTextEditor';
import { FooterSection } from './FooterSection';
import { clampSpacing, SUBTITLE_GAP } from '../../lib/spacing';

function GatePositionEditor({ kind }: { kind: 'title' | 'text' }) {
  const design = useDoc(s => s.doc.design);
  const update = useDoc(s => s.update);
  const rtl = design.textDirection === 'rtl';
  const key = kind === 'title' ? 'gateTitle' : 'gateText';
  const title = kind === 'title';
  const box = design[key] ?? (title && (design.firstPageTopMargin ?? 0) > 0 ? { top: design.firstPageTopMargin } : undefined);
  const position = gatePlacement(box, design.margin);
  const auto = box?.top === undefined;
  const set = (patch: Partial<GateTextPlacement>) => update(d => {
    const next = { ...box, ...patch };
    d.design[key] = { ...next, ...gatePlacement(next, d.design.margin) };
  });
  return <Section title="Block position" editorTarget={`gate-${kind}-position`}>
    <p className="hint">Drag the block up or down on the sheet itself — that writes the distance below. Width and side stay numeric here, so the block keeps its column.</p>
    <Toggle label={title ? 'Centre title vertically' : 'Centre facing text vertically'} checked={auto} onChange={v => set({ top: v ? undefined : title ? 65 : 105 })} />
    {!auto && <LabeledNumber label={title ? 'Title block from top' : 'Facing text from top'} unit="mm" min={0} max={260} value={position.top!} onChange={v => set({ top: clampGate(v, 0, 260) })} />}
    <LabeledNumber label={`Distance from ${rtl ? 'right' : 'left'} edge`} unit="mm" min={8} max={152} value={position.inset} onChange={v => set({ inset: v })} />
    <LabeledNumber label="Text block width" unit="mm" min={50} max={210 - position.inset - 8} value={position.width} onChange={v => set({ width: v })} />
    <SegmentField label="Block alignment" value={box?.align ?? (!title && !rtl ? 'end' : 'start')} options={[{ value: 'start', label: rtl ? 'Right' : 'Left' }, { value: 'center', label: 'Centre' }, { value: 'end', label: rtl ? 'Left' : 'Right' }]} onChange={align => set({ align })} />
    <button type="button" className="add-btn" onClick={() => update(d => { delete d.design[key]; if (title) delete d.design.firstPageTopMargin; })}>Reset block position</button>
  </Section>;
}

export function GateDesignSection() {
  const doc = useDoc(s => s.doc);
  const update = useDoc(s => s.update);
  const { design, meta } = doc;
  const rtl = design.textDirection === 'rtl';
  const natural = (design.gateTitleLayout ?? (rtl ? 'natural' : 'stacked')) === 'natural';
  return <div className="gate-editor" id="editor-target-gate-positions">
    <p className="hint gate-editor-intro">Edit one block at a time. Each group keeps its text, typography and position together. You can also click text in the preview to open its settings.</p>
    <details className="gate-editor-group">
      <summary>1 · Title page<span>Category, headline & position</span></summary>
      <div className="gate-control-stack">
        <GateTextEditor role="title">
          <SegmentField label="Title line breaks" value={natural ? 'natural' : 'stacked'} options={[{ value: 'stacked', label: 'One word per line' }, { value: 'natural', label: 'Wrap to width' }]} onChange={gateTitleLayout => update(d => { d.design.gateTitleLayout = gateTitleLayout; })} />
          {!natural && <Toggle label="Accent colour on last word" checked={design.gateAccentLastWord !== false} onChange={v => update(d => { d.design.gateAccentLastWord = v; })} />}
        </GateTextEditor>
        <GateTextEditor role="kicker" />
        <GatePositionEditor kind="title" />
      </div>
    </details>
    <details className="gate-editor-group">
      <summary>2 · Facing-page text<span>Subtitle, quote & position</span></summary>
      <div className="gate-control-stack">
        <GateTextEditor role="subtitle">
          <LabeledNumber label="Space above subtitle" unit="mm" value={design.subtitleGap ?? 0} min={SUBTITLE_GAP.min} max={SUBTITLE_GAP.max} step={.5} onChange={v => update(d => { d.design.subtitleGap = clampSpacing(v, SUBTITLE_GAP); })} />
          <p className="hint">This is the gap above the subtitle, not the block's position. While the block is centred it also re-centres as the gap changes, so the copy appears to move only half as far — drag the block instead to place it, and use this to tune the space.</p>
        </GateTextEditor>
        <GateTextEditor role="quote" />
        <GateTextEditor role="attribution" />
        <GatePositionEditor kind="text" />
      </div>
    </details>
    <details className="gate-editor-group">
      <summary>3 · Credits<span>Author & photo credit</span></summary>
      <div className="gate-control-stack">
        <GateTextEditor role="author" />
        <GateTextEditor role="photoCredit" />
        <p className="hint">Credits stay at the foot of the facing page. Text positioning reserves space above them.</p>
      </div>
    </details>
    <details className="gate-editor-group">
      <summary>4 · Masthead & footer<span>Publication details, sides & edge distances</span></summary>
      <div className="gate-control-stack">
        <Section title="Masthead" editorTarget="design-topbar">
          <LabeledInput label="Masthead text" editorTarget="meta-masthead" value={meta.masthead ?? ''} onChange={v => update(d => { d.meta.masthead = v; })} />
          <LabeledInput label="Volume / date" editorTarget="meta-volume" value={meta.volume ?? ''} onChange={v => update(d => { d.meta.volume = v; })} />
          <LabeledNumber label="Distance from top edge" unit="mm" value={design.topBarOffset ?? DEFAULT_TOP_BAR_OFFSET} min={0} max={40} onChange={v => update(d => { d.design.topBarOffset = clampGate(v, 0, 40); })} />
          <LabeledColor label="Bar line" value={design.barColor ?? '#111418'} onChange={v => update(d => { d.design.barColor = v; })} />
          <LabeledColor label="Masthead background" value={design.barTagColor ?? '#bfbfbf'} onChange={v => update(d => { d.design.barTagColor = v; })} />
          <LabeledColor label="Masthead text colour" value={design.barTagInk ?? '#111418'} onChange={v => update(d => { d.design.barTagInk = v; })} />
        </Section>
        <FooterSection />
      </div>
    </details>
    <p className="hint gate-editor-intro">Line height is a multiplier: 1.2 means 120% of the font size. Side insets mirror for Arabic. Large blocks move up if needed to protect credits and the footer.</p>
  </div>;
}
