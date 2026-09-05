import { useDoc } from '../../store/useDoc';
import { headingTextStyle, type HeadingTextRole } from '../../lib/headingText';
import { LabeledColor, Toggle } from '../Field';

export function HeadingTextEditor({ role, label }: { role: HeadingTextRole; label: string }) {
  const design = useDoc((state) => state.doc.design);
  const templateId = useDoc((state) => state.doc.templateId);
  const update = useDoc((state) => state.update);
  const style = headingTextStyle(design, templateId, role);
  const colorKey = `${role}Color` as const;
  return (
    <details className="cover-style-group">
      <summary>{label}</summary>
      <div className="cover-style-fields">
        <LabeledColor label={`${label} color`} value={style.color}
          onChange={(value) => update((doc) => { doc.design[colorKey] = value; })} />
        <Toggle label={`${label} bold`} checked={style.fontWeight >= 700}
          onChange={(value) => update((doc) => { doc.design[`${role}Weight`] = value ? 700 : 400; })} />
        <Toggle label={`${label} italic`} checked={style.fontStyle === 'italic'}
          onChange={(value) => update((doc) => { doc.design[`${role}Italic`] = value; })} />
        <button type="button" className="add-btn cover-style-reset"
          onClick={() => update((doc) => {
            delete doc.design[colorKey];
          })}>
          Use theme color for {label.toLowerCase()}
        </button>
      </div>
    </details>
  );
}
