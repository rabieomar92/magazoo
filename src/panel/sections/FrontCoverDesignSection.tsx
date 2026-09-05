import {
  defaultSubtitleGap,
  type FrontCoverDesign,
  type FrontCoverTextRole,
  type FrontCoverTextStyle,
} from '../../schema/document';
import { ALL_FONTS, fontOptions } from '../../lib/fonts';
import {
  defaultFrontCoverTextStyle,
  FRONT_COVER_TEXT_ROLES,
} from '../../lib/frontCoverDesign';
import { useDoc } from '../../store/useDoc';
import {
  LabeledColor,
  LabeledNumber,
  LabeledRange,
  LabeledSelect,
  LabeledTextarea,
  Section,
  SegmentField,
  Toggle,
} from '../Field';

function CoverTextEditor({ role, label }: { role: FrontCoverTextRole; label: string }) {
  const design = useDoc((state) => state.doc.design);
  const update = useDoc((state) => state.update);
  const style = defaultFrontCoverTextStyle(design, role);

  const set = <K extends keyof FrontCoverTextStyle>(key: K, value: FrontCoverTextStyle[K]) =>
    update((doc) => {
      doc.design.frontCover ??= {};
      doc.design.frontCover.text ??= {};
      doc.design.frontCover.text[role] = {
        ...(doc.design.frontCover.text[role] ?? {}),
        [key]: value,
      };
    });

  const reset = () =>
    update((doc) => {
      if (doc.design.frontCover?.text) delete doc.design.frontCover.text[role];
    });

  return (
    <details className="cover-style-group">
      <summary>{label}</summary>
      <div className="cover-style-fields">
        <Toggle label="Show object" checked={style.visible} onChange={(value) => set('visible', value)} />
        <LabeledSelect
          label="Font"
          value={style.fontFamily}
          options={fontOptions(ALL_FONTS)}
          onChange={(value) => set('fontFamily', value)}
        />
        <LabeledNumber
          label="Size"
          unit="pt"
          value={style.fontSize}
          min={5}
          max={90}
          step={0.5}
          onChange={(value) => set('fontSize', value)}
        />
        <LabeledNumber
          label="Weight"
          value={style.fontWeight}
          min={100}
          max={900}
          step={100}
          onChange={(value) => set('fontWeight', value)}
        />
        <Toggle label="Bold" checked={style.fontWeight >= 700}
          onChange={(value) => set('fontWeight', value ? 700 : 400)} />
        <Toggle label="Italic" checked={style.fontStyle === 'italic'}
          onChange={(value) => set('fontStyle', value ? 'italic' : 'normal')} />
        <LabeledNumber
          label="Letter spacing"
          unit="em"
          value={style.letterSpacing}
          min={-0.12}
          max={0.5}
          step={0.005}
          onChange={(value) => set('letterSpacing', value)}
        />
        <LabeledColor label="Color" value={style.color} onChange={(value) => set('color', value)} />
        {(['subtitle', 'author', 'strapline'] as FrontCoverTextRole[]).includes(role) && (
          <button type="button" className="add-btn cover-style-reset" onClick={() => update((doc) => {
            const headingRole = role === 'strapline' ? 'affiliation' : role === 'subtitle' ? 'subtitle' : 'author';
            delete doc.design[`${headingRole}Color`];
            if (doc.design.frontCover?.text?.[role]) delete doc.design.frontCover.text[role].color;
          })}>Use theme color</button>
        )}
        <button type="button" className="add-btn cover-style-reset" onClick={reset}>
          Reset this object
        </button>
      </div>
    </details>
  );
}

export function FrontCoverDesignSection() {
  const design = useDoc((state) => state.doc.design);
  const update = useDoc((state) => state.update);
  const cover = design.frontCover ?? {};

  const setCover = <K extends keyof FrontCoverDesign>(key: K, value: FrontCoverDesign[K]) =>
    update((doc) => {
      doc.design.frontCover ??= {};
      doc.design.frontCover[key] = value;
    });

  return (
    <>
      <Section title="Front cover layout">
        <p className="hint">
          These settings affect only Magazine Cover. Edit the words in Content and the cover
          photograph in Images.
        </p>
        <SegmentField<'left' | 'center' | 'right'>
          label="Story alignment"
          value={cover.alignment ?? 'left'}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
          onChange={(value) => setCover('alignment', value)}
        />
        <LabeledNumber
          label="Safe margin"
          unit="mm"
          value={design.margin}
          min={6}
          max={30}
          step={1}
          onChange={(value) => update((doc) => { doc.design.margin = value; })}
        />
        <LabeledNumber
          label="Masthead top"
          unit="mm"
          value={design.topBarOffset ?? 0}
          min={0}
          max={40}
          step={1}
          onChange={(value) => update((doc) => { doc.design.topBarOffset = value; })}
        />
        <LabeledNumber
          label="Story top gap"
          unit="mm"
          value={cover.storyTop ?? 15}
          min={0}
          max={120}
          step={1}
          onChange={(value) => setCover('storyTop', value)}
        />
        <LabeledNumber
          label="Story width"
          unit="%"
          value={cover.storyWidth ?? 88}
          min={40}
          max={100}
          step={1}
          onChange={(value) => setCover('storyWidth', value)}
        />
        <LabeledNumber
          label="Title to subtitle gap"
          unit="mm"
          value={design.subtitleGap ?? defaultSubtitleGap('magazine-4')}
          min={0}
          max={40}
          step={0.5}
          onChange={(value) => update((doc) => { doc.design.subtitleGap = value; })}
        />
        <LabeledNumber
          label="Teaser gap"
          unit="mm"
          value={design.gutter}
          min={1}
          max={12}
          step={0.5}
          onChange={(value) => update((doc) => { doc.design.gutter = value; })}
        />
      </Section>

      <Section title="Cover surfaces">
        <Toggle
          label="Show cover image"
          checked={design.showHero !== false}
          onChange={(value) => update((doc) => { doc.design.showHero = value; })}
        />
        <LabeledRange
          label="Image overlay"
          value={Math.round((cover.overlayOpacity ?? 0.68) * 100)}
          min={0}
          max={95}
          step={1}
          format={(value) => `${value}%`}
          onChange={(value) => setCover('overlayOpacity', value / 100)}
        />
        <LabeledColor
          label="Cover fallback"
          value={design.colors.hero}
          onChange={(value) => update((doc) => { doc.design.colors.hero = value; })}
        />
        <LabeledColor
          label="Accent"
          value={design.colors.accent}
          onChange={(value) => update((doc) => { doc.design.colors.accent = value; })}
        />
        <LabeledColor label="Ink (text)" value={design.colors.ink}
          onChange={(value) => update((doc) => { doc.design.colors.ink = value; })} />
        <LabeledColor
          label="Category background"
          value={cover.kickerBackground ?? design.colors.accent}
          onChange={(value) => setCover('kickerBackground', value)}
        />
        <LabeledColor
          label="Teaser panel"
          value={cover.teaserBackground ?? '#071006'}
          onChange={(value) => setCover('teaserBackground', value)}
        />
        <LabeledRange
          label="Teaser panel opacity"
          value={Math.round((cover.teaserBackgroundOpacity ?? 0.45) * 100)}
          min={0}
          max={100}
          step={1}
          format={(value) => `${value}%`}
          onChange={(value) => setCover('teaserBackgroundOpacity', value / 100)}
        />
      </Section>

      <Section title="Cover object styles">
        <p className="hint">
          Every text object has its own font, size, bold, italic, spacing, and color.
          Subtitle, author, and publication strapline follow Ink until customized.
          Headlines keep the capitalization you type.
        </p>
        <div className="cover-style-list">
          {FRONT_COVER_TEXT_ROLES.map(({ role, label }) => (
            <CoverTextEditor role={role} label={label} key={role} />
          ))}
        </div>
      </Section>

      <Section title="Advanced">
        <LabeledTextarea
          label="Custom CSS"
          value={design.customCss}
          onChange={(value) => update((doc) => { doc.design.customCss = value; })}
          placeholder=".front-cover { … }"
        />
      </Section>
    </>
  );
}
