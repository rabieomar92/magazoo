import { useState } from 'react';

/** Empty means template default, not zero. Drafts never put NaN into a file. */
export function LetterSpacingField({ value, label = 'Letter spacing', onChange }: {
  value?: number; label?: string; onChange: (value: number | undefined) => void;
}) {
  const [draft, setDraft] = useState<{ text: string; value?: number } | null>(null);
  return <>
    <label className="field field--inline" title="Spacing between letters, in em. Auto preserves the template setting. Negative values tighten; positive values spread letters apart.">
      <span className="field-label">{label}<span className="field-unit"> (em)</span></span>
      <input className="field-input field-input--num" type="number" min={-.1} max={1} step={.01} placeholder="Auto"
        value={draft && draft.value === value ? draft.text : value ?? ''}
        onChange={event => {
          const text = event.target.value;
          const next = event.target.valueAsNumber;
          const valid = Number.isFinite(next) && next >= -.1 && next <= 1;
          setDraft({ text, value: valid ? next : value });
          if (valid) onChange(next);
        }}
        onBlur={event => {
          if (!event.target.value.trim()) onChange(undefined);
          else if (Number.isFinite(event.target.valueAsNumber)) onChange(Math.min(1, Math.max(-.1, event.target.valueAsNumber)));
          setDraft(null);
        }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
    </label>
    <button type="button" className="tracking-reset" title={`Reset ${label.toLowerCase()} to template default`} aria-label={`Reset ${label.toLowerCase()}`}
      disabled={value === undefined} onClick={() => { setDraft(null); onChange(undefined); }}>↺</button>
  </>;
}
