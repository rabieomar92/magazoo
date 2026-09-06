import { useRef, useState } from 'react';
import { useDoc } from '../../store/useDoc';
import {
  DEFAULT_TOP_BAR_OFFSET,
  assetIsReferenced,
  defaultSubtitleGap,
  familyOf,
  uid,
  type Design,
} from '../../schema/document';
import { cplWarning } from '../../lib/geometry';
import { ImageLoadError, loadImage } from '../../lib/loadImage';
import { ALL_FONTS, SANS_FONTS, SERIF_FONTS, fontOptions } from '../../lib/fonts';
import { FrontCoverDesignSection } from './FrontCoverDesignSection';
import { HeadingTextEditor } from './HeadingTextEditor';
import {
  LabeledColor,
  LabeledNumber,
  LabeledSelect,
  LabeledTextarea,
  SegmentField,
  Section,
  Toggle,
} from '../Field';

export function DesignSection() {
  const design = useDoc((s) => s.doc.design);
  const backgroundAsset = useDoc((s) => {
    const id = s.doc.design.pageBackgroundAssetId;
    return id ? s.doc.assets[id] : null;
  });
  const family = useDoc((s) => familyOf(s.doc.templateId));
  const templateId = useDoc((s) => s.doc.templateId);
  const isFrontCover = useDoc((s) => s.doc.templateId === 'magazine-4');
  // Every template except the dedicated front cover uses the shared TagBar.
  const hasBar = !isFrontCover;
  const hasBarSide = true;
  const update = useDoc((s) => s.update);
  const backgroundFileRef = useRef<HTMLInputElement>(null);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const [backgroundLoading, setBackgroundLoading] = useState(false);

  const set = <K extends keyof Design>(key: K, value: Design[K]) =>
    update((d) => {
      d.design[key] = value;
    });

  const setSize = (key: keyof Design['sizes']) => (v: number) =>
    update((d) => {
      d.design.sizes[key] = v;
    });

  const setColor = (key: keyof Design['colors']) => (v: string) =>
    update((d) => {
      d.design.colors[key] = v;
    });

  const cpl = cplWarning(design);

  const onBackgroundFile = async (file: File | undefined) => {
    if (!file) return;
    setBackgroundError(null);
    setBackgroundLoading(true);
    try {
      const loaded = await loadImage(file);
      update((d) => {
        const previous = d.design.pageBackgroundAssetId;
        const id = uid();
        d.assets[id] = loaded;
        d.design.pageBackgroundAssetId = id;
        d.design.pageBackgroundOpacity = d.design.pageBackgroundOpacity ?? 1;
        if (previous && previous !== id && !assetIsReferenced(d, previous)) delete d.assets[previous];
      });
    } catch (error) {
      setBackgroundError(error instanceof ImageLoadError ? error.message : 'Failed to load image.');
    } finally {
      setBackgroundLoading(false);
    }
  };

  const removeBackground = () =>
    update((d) => {
      const previous = d.design.pageBackgroundAssetId;
      d.design.pageBackgroundAssetId = undefined;
      if (previous && !assetIsReferenced(d, previous)) delete d.assets[previous];
    });

  if (isFrontCover) return <FrontCoverDesignSection />;

  return (
    <Section title="Design">
      <p className="group-label">Layout</p>
      <SegmentField<Design['bodyCols']>
        label="Text columns"
        value={design.bodyCols}
        options={[
          { value: 2, label: '2' },
          { value: 3, label: '3' },
          { value: 4, label: '4' },
        ]}
        onChange={(v) => set('bodyCols', v)}
      />
      <SegmentField<NonNullable<Design['bodyAlign']>>
        label="Text alignment"
        value={design.bodyAlign ?? 'justify'}
        options={[
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
          { value: 'justify', label: 'Justify' },
        ]}
        onChange={(v) => set('bodyAlign', v)}
      />
      <SegmentField<NonNullable<Design['textDirection']>>
        label="Text direction"
        value={design.textDirection ?? 'ltr'}
        options={[
          { value: 'ltr', label: 'Left to right' },
          { value: 'rtl', label: 'Right to left' },
        ]}
        onChange={(v) => set('textDirection', v)}
      />
      <p className="hint">Columns fill in reading order; only the final column may finish short.</p>
      {family !== 'gallery' && (
        <>
          <Toggle
            label="Show highlights"
            checked={design.sidebar}
            onChange={(v) => set('sidebar', v)}
          />
          {design.sidebar && (
            <LabeledSelect
              label="Highlights position"
              value={design.highlightsPlacement ?? 'page1'}
              options={[
                { value: 'page1', label: 'Right sidebar (page 1)' },
                { value: 'page1-flow', label: 'Right sidebar + text fills gap (page 1)' },
                { value: 'all', label: 'Right sidebar (every page)' },
                { value: 'below', label: 'Below text (end)' },
                { value: 'free', label: 'Free on page (drag)' },
              ]}
              onChange={(v) => set('highlightsPlacement', v as Design['highlightsPlacement'])}
            />
          )}
        </>
      )}
      {cpl && <p className="hint hint--warn">{cpl}</p>}

      <p className="group-label">Spacing (mm)</p>
      <LabeledNumber label="Margin" unit="mm" value={design.margin} min={8} max={30} step={1} onChange={(v) => set('margin', v)} />
      <LabeledNumber label="Gutter" unit="mm" value={design.gutter} min={2} max={12} step={0.5} onChange={(v) => set('gutter', v)} />
      {family !== 'gallery' && (
        <>
          <LabeledNumber
            label="Title to subtitle gap"
            unit="mm"
            value={design.subtitleGap ?? defaultSubtitleGap(templateId)}
            min={0}
            max={40}
            step={0.5}
            onChange={(v) => set('subtitleGap', v)}
          />
          <LabeledNumber
            label="First-page top margin"
            unit="mm"
            value={design.firstPageTopMargin ?? 0}
            min={0}
            max={250}
            step={1}
            onChange={(v) => set('firstPageTopMargin', v)}
          />
          <p className="hint">Moves the first page’s main content only. The top bar keeps its own edge distance.</p>
        </>
      )}

      <p className="group-label">Font sizes (pt)</p>
      <LabeledNumber label="Title" unit="pt" value={design.sizes.title} min={16} max={48} step={0.5} onChange={setSize('title')} />
      <LabeledNumber label="Subtitle" unit="pt" value={design.sizes.subtitle} min={8} max={18} step={0.5} onChange={setSize('subtitle')} />
      <LabeledNumber label="Body text" unit="pt" value={design.sizes.body} min={7} max={12} step={0.1} onChange={setSize('body')} />
      <LabeledNumber label="Category" unit="pt" value={design.sizes.categoryLabel} min={6} max={12} step={0.5} onChange={setSize('categoryLabel')} />
      <LabeledNumber label="Author" unit="pt" value={design.sizes.author} min={7} max={12} step={0.5} onChange={setSize('author')} />
      <LabeledNumber label="Affiliation" unit="pt" value={design.sizes.affiliation} min={7} max={12} step={0.5} onChange={setSize('affiliation')} />

      <p className="group-label" id="editor-target-design-fonts">Fonts</p>
      <LabeledSelect label="Display" value={design.fontDisplay} options={fontOptions(SERIF_FONTS)} onChange={(v) => set('fontDisplay', v)} />
      <LabeledSelect label="Body" value={design.fontBody} options={fontOptions(SANS_FONTS)} onChange={(v) => set('fontBody', v)} />
      <LabeledSelect label="Category" value={design.fontCategory ?? design.fontBody} options={fontOptions(ALL_FONTS)} onChange={(v) => set('fontCategory', v)} />
      <LabeledSelect label="Subtitle" value={design.fontSubtitle ?? (family === 'gallery' ? design.fontBody : design.fontDisplay)} options={fontOptions(ALL_FONTS)} onChange={(v) => set('fontSubtitle', v)} />
      <LabeledSelect label="Author" value={design.fontAuthor ?? design.fontBody} options={fontOptions(ALL_FONTS)} onChange={(v) => set('fontAuthor', v)} />
      <LabeledSelect label="Affiliation" value={design.fontAffiliation ?? design.fontBody} options={fontOptions(ALL_FONTS)} onChange={(v) => set('fontAffiliation', v)} />

      <p className="group-label">Colors</p>
      <LabeledColor label="Page color (all pages)" value={design.paperBg ?? '#ffffff'} onChange={(v) => set('paperBg', v)} />
      <LabeledColor label="Hero" value={design.colors.hero} onChange={setColor('hero')} />
      <LabeledColor label="Accent" value={design.colors.accent} onChange={setColor('accent')} />
      <LabeledColor label="Soft accent" value={design.colors.accentSoft} onChange={setColor('accentSoft')} />
      <LabeledColor label="Ink (text)" value={design.colors.ink} onChange={setColor('ink')} />
      <p className="group-label">Text appearance</p>
      <div className="cover-style-list">
        <HeadingTextEditor role="subtitle" label={family === 'gallery' ? 'Descriptions' : 'Subtitle / lede'} />
        {family !== 'gallery' && <>
          <HeadingTextEditor role="author" label="Author" />
          <HeadingTextEditor role="affiliation" label="Affiliation" />
        </>}
      </div>
      {(design.subtitleColor || design.authorColor || design.affiliationColor) && (
        <button
          type="button"
          className="add-btn"
          onClick={() => update((d) => {
            delete d.design.subtitleColor;
            delete d.design.authorColor;
            delete d.design.affiliationColor;
          })}
        >
          Follow theme colors
        </button>
      )}
      <p className="hint">Text colors follow Ink unless customized. Titles keep the capitalization you type.</p>
      {family === 'gallery' && <p className="hint">Photo captions use light text by default. A custom description color also applies to photo captions.</p>}

      {family !== 'gallery' && (
        <Toggle
          label="Show hero / cover image"
          checked={design.showHero !== false}
          onChange={(v) => set('showHero', v)}
        />
      )}

      <div id="editor-target-design-background">
      <p className="group-label">First-page background graphic</p>
      <input
        ref={backgroundFileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void onBackgroundFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {backgroundAsset ? (
        <>
          <div
            className="hero-thumb page-background-thumb"
            style={{ aspectRatio: `${backgroundAsset.naturalWidth} / ${backgroundAsset.naturalHeight}` }}
          >
            <img src={backgroundAsset.src} alt="Current first-page background" />
          </div>
          <div className="hero-actions">
            <button type="button" className="add-btn" disabled={backgroundLoading} onClick={() => backgroundFileRef.current?.click()}>
              {backgroundLoading ? 'Optimising image…' : 'Replace first-page graphic'}
            </button>
            <button type="button" className="icon-btn icon-btn--danger" title="Remove background" onClick={removeBackground}>
              ✕
            </button>
          </div>
          <LabeledNumber
            label="Graphic opacity"
            unit="%"
            value={Math.round((design.pageBackgroundOpacity ?? 1) * 100)}
            min={5}
            max={100}
            step={5}
            onChange={(value) => set('pageBackgroundOpacity', value / 100)}
          />
        </>
      ) : (
        <button type="button" className="add-btn hero-upload" disabled={backgroundLoading} onClick={() => backgroundFileRef.current?.click()}>
          {backgroundLoading ? 'Optimising image…' : '+ Upload first-page graphic'}
        </button>
      )}
      {backgroundError && <p className="hint hint--warn" role="alert">{backgroundError}</p>}
      </div>

      {hasBarSide && (
        <div id="editor-target-design-topbar">
          <p className="group-label">Top bar</p>
          <SegmentField<'left' | 'right'>
            label="Masthead side"
            value={design.barSide ?? 'left'}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'right', label: 'Right' },
            ]}
            onChange={(v) => set('barSide', v)}
          />
          <LabeledNumber
            label="Distance from top edge"
            unit="mm"
            value={design.topBarOffset ?? DEFAULT_TOP_BAR_OFFSET}
            min={0}
            max={40}
            step={1}
            onChange={(v) => set('topBarOffset', v)}
          />
          {hasBar && (
            <>
              <LabeledColor label="Bar line" value={design.barColor ?? '#111418'} onChange={(v) => set('barColor', v)} />
              <LabeledColor label="Tag box" value={design.barTagColor ?? '#bfbfbf'} onChange={(v) => set('barTagColor', v)} />
              <LabeledColor label="Bar text ink" value={design.barTagInk ?? '#111418'} onChange={(v) => set('barTagInk', v)} />
            </>
          )}
        </div>
      )}

      <p className="group-label">Custom CSS</p>
      <LabeledTextarea
        label="Injected into preview as-is"
        value={design.customCss}
        onChange={(v) => set('customCss', v)}
        placeholder=".title { letter-spacing: -0.02em; }"
      />
    </Section>
  );
}
