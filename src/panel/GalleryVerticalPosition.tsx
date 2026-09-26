import { LabeledRange, SegmentField } from './Field';
import { galleryTextPosition } from '../lib/galleryTextPosition';

export function GalleryVerticalPosition({ value, onChange, label, caption = false }: {
  value?: number;
  onChange: (value: number) => void;
  label: string;
  caption?: boolean;
}) {
  const position = galleryTextPosition(value, caption ? 100 : 50);
  return <div className="gallery-card-position" role="group" aria-label={label}>
    <SegmentField<number>
      label="Vertical alignment"
      value={position}
      options={[
        { value: 0, label: 'Top' },
        { value: 50, label: 'Middle' },
        { value: 100, label: 'Bottom' },
      ]}
      onChange={onChange}
    />
    <LabeledRange label="Fine position" value={position} min={0} max={100} step={1}
      format={value => `${value}%`} onChange={onChange} />
    <p className="gallery-card-position-hint">Within this {caption ? 'photo' : 'text card'} · 0% top, 100% bottom.</p>
  </div>;
}
