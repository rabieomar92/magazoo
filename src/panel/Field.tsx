import type { ReactNode } from 'react';
import { editorTargetId } from '../lib/editorNavigation';

interface EditorTargetProps {
  /** Stable destination used by clicks in the page preview. */
  editorTarget?: string;
}

interface LabeledProps extends EditorTargetProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function LabeledInput({ label, value, onChange, placeholder, editorTarget }: LabeledProps) {
  return (
    <label className="field" id={editorTarget ? editorTargetId(editorTarget) : undefined}>
      <span className="field-label">{label}</span>
      <input
        className="field-input"
        dir="auto"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function LabeledTextarea({ label, value, onChange, placeholder, editorTarget, rows = 4 }: LabeledProps & { rows?: number }) {
  return (
    <label className="field" id={editorTarget ? editorTargetId(editorTarget) : undefined}>
      <span className="field-label">{label}</span>
      <textarea
        className="field-input field-textarea"
        dir="auto"
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

interface NumberProps extends EditorTargetProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export function LabeledNumber({ label, value, onChange, min, max, step, unit, editorTarget }: NumberProps) {
  return (
    <label className="field field--inline" id={editorTarget ? editorTargetId(editorTarget) : undefined}>
      <span className="field-label">
        {label}
        {unit && <span className="field-unit"> ({unit})</span>}
      </span>
      <input
        className="field-input field-input--num"
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
    </label>
  );
}

export function LabeledRange({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
  editorTarget,
}: NumberProps & { format?: (v: number) => string }) {
  return (
    <label className="field" id={editorTarget ? editorTargetId(editorTarget) : undefined}>
      <span className="field-label range-label">
        {label}
        <span className="field-unit">{format ? format(value) : value}</span>
      </span>
      <input
        className="range-input"
        type="range"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function LabeledColor({ label, value, onChange, editorTarget }: LabeledProps) {
  return (
    <label className="field field--inline" id={editorTarget ? editorTargetId(editorTarget) : undefined}>
      <span className="field-label">{label}</span>
      <span className="color-input">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <input
          className="field-input field-input--hex"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </label>
  );
}

interface SelectProps extends EditorTargetProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

export function LabeledSelect({ label, value, options, onChange, editorTarget }: SelectProps) {
  return (
    <label className="field field--inline" id={editorTarget ? editorTargetId(editorTarget) : undefined}>
      <span className="field-label">{label}</span>
      <select className="field-input select-control" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  editorTarget,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
} & EditorTargetProps) {
  return (
    <label className="field field--inline toggle" id={editorTarget ? editorTargetId(editorTarget) : undefined}>
      <span className="field-label">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Segmented single-choice control (e.g. column count). */
export function SegmentField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  editorTarget,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
} & EditorTargetProps) {
  return (
    <div className="field field--inline" id={editorTarget ? editorTargetId(editorTarget) : undefined}>
      <span className="field-label">{label}</span>
      <div className="segment">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            className={`segment-btn${o.value === value ? ' is-active' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A titled group of controls. */
export function Section({
  title,
  children,
  editorTarget,
}: { title: string; children: ReactNode } & EditorTargetProps) {
  return (
    <section className="section" id={editorTarget ? editorTargetId(editorTarget) : undefined}>
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

/** Small icon-ish button row used by list items (up / down / delete). */
export function RowButtons({
  onUp,
  onDown,
  onRemove,
  disableUp,
  disableDown,
}: {
  onUp?: () => void;
  onDown?: () => void;
  onRemove: () => void;
  disableUp?: boolean;
  disableDown?: boolean;
}) {
  return (
    <div className="row-buttons">
      {onUp && (
        <button type="button" className="icon-btn" onClick={onUp} disabled={disableUp} title="Move up">
          ↑
        </button>
      )}
      {onDown && (
        <button
          type="button"
          className="icon-btn"
          onClick={onDown}
          disabled={disableDown}
          title="Move down"
        >
          ↓
        </button>
      )}
      <button type="button" className="icon-btn icon-btn--danger" onClick={onRemove} title="Delete">
        ✕
      </button>
    </div>
  );
}
