import { useEffect, useState } from 'react';
import { useDoc } from '../../store/useDoc';
import type { PageMarginTextSettings } from '../../schema/document';
import { marginTextSettings } from '../../lib/pageMarginText';
import { FOCUS_EDITOR_TARGET_EVENT, type EditorTargetDetail } from '../../lib/editorNavigation';
import { ALL_FONTS, fontOptions } from '../../lib/fonts';
import { LabeledColor, LabeledInput, LabeledNumber, LabeledSelect, Section, Toggle } from '../Field';
import { TypographyControl } from '../TypographyToolbar';

export function PageMarginTextSection() {
  const doc = useDoc(s => s.doc);
  const update = useDoc(s => s.update);
  const [page, setPage] = useState(1);
  const settings = marginTextSettings(doc);
  const set = <K extends keyof PageMarginTextSettings>(key: K, value: PageMarginTextSettings[K]) =>
    update(d => { d.marginText = { ...d.marginText, [key]: value }; });

  useEffect(() => {
    const focusPage = (event: Event) => {
      const target = (event as CustomEvent<EditorTargetDetail>).detail?.target;
      const match = target?.match(/^page-margin-text-(\d+)$/);
      if (match) setPage(Math.max(1, Math.min(9999, Number(match[1]))));
    };
    window.addEventListener(FOCUS_EDITOR_TARGET_EVENT, focusPage);
    return () => window.removeEventListener(FOCUS_EDITOR_TARGET_EVENT, focusPage);
  }, []);

  const text = settings.mode === 'all' ? doc.marginText?.text ?? '' : doc.marginText?.pages?.[String(page)] ?? '';
  return <Section title="Page margin text">
    <Toggle label="Show vertical margin text" checked={settings.enabled} onChange={v => set('enabled', v)} />
    <p className="hint">Optional small vertical text for a copyright notice, photo credit or source. It sits outside the text columns.</p>
    {settings.enabled && <>
      <LabeledSelect label="Text on pages" value={settings.mode} options={[
        { value: 'per-page', label: 'Different text for each page' },
        { value: 'all', label: 'Same text on every page' },
      ]} onChange={v => update(d => {
        d.marginText = { ...d.marginText, mode: v as 'per-page' | 'all',
          text: d.marginText?.text ?? d.marginText?.pages?.[String(page)] ?? '' };
      })} />
      {settings.mode === 'per-page' && <LabeledNumber label="Page position in this document" value={page} min={1} max={9999} onChange={v => setPage(Math.round(v))} />}
      <LabeledInput editorTarget={`page-margin-text-${page}`} label={settings.mode === 'all' ? 'Text for every page' : `Text for page ${page}`}
        value={text} placeholder="© 2026 School of Physics, USM" onChange={v => update(d => {
          d.marginText = settings.mode === 'all' ? { ...d.marginText, text: v }
            : { ...d.marginText, pages: { ...d.marginText?.pages, [String(page)]: v } };
        })} />
      <p className="hint">Page 1 is the first sheet of this document, regardless of its printed page number. Leave text blank to show nothing. Switching modes or turning this off keeps your saved text.</p>
      <LabeledSelect label="Page edge" value={settings.side} options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]}
        onChange={v => set('side', v as 'left' | 'right')} />
      <LabeledNumber label="Distance from side edge" unit="mm" value={settings.edgeOffset} min={2} max={30} step={0.5} onChange={v => set('edgeOffset', v)} />
      <LabeledNumber label="Distance from bottom edge" unit="mm" value={settings.bottomOffset} min={8} max={80} step={0.5} onChange={v => set('bottomOffset', v)} />
      <p className="hint">Position and styling apply to all margin text in this document. Keep it inside a clear margin; it does not move body text or photos.</p>
      <TypographyControl group="marginText" order={10}><LabeledSelect label="Margin text font" value={settings.fontFamily} options={fontOptions(ALL_FONTS)} onChange={v => set('fontFamily', v)} /></TypographyControl>
      <TypographyControl group="marginText" order={20}><LabeledNumber label="Margin text size" unit="pt" value={settings.fontSize} min={5} max={12} step={0.5} onChange={v => set('fontSize', v)} /></TypographyControl>
      <TypographyControl group="marginText" order={30}><Toggle label="Automatic text colour" checked={!settings.color} onChange={v => set('color', v ? undefined : '#777777')} /></TypographyControl>
      {settings.color && <TypographyControl group="marginText" order={40}><LabeledColor label="Margin text colour" value={settings.color} onChange={v => set('color', v)} /></TypographyControl>}
    </>}
  </Section>;
}
