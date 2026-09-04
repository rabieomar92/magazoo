import { useDoc } from '../../store/useDoc';
import { familyOf } from '../../schema/document';
import { LabeledColor, LabeledInput, LabeledTextarea, Section } from '../Field';

export function MetaSection() {
  const meta = useDoc((s) => s.doc.meta);
  const isMag = useDoc((s) => familyOf(s.doc.templateId) === 'magazine');
  const isGallery = useDoc((s) => familyOf(s.doc.templateId) === 'gallery');
  const isFrontCover = useDoc((s) => s.doc.templateId === 'magazine-4');
  const barColor = useDoc((s) => s.doc.design.barColor ?? s.doc.design.colors.accent);
  const isP2 = useDoc((s) => s.doc.templateId === 'paper-2');
  const update = useDoc((s) => s.update);

  const set = (key: keyof typeof meta) => (v: string) =>
    update((d) => {
      d.meta[key] = v;
    });

  const setBarColor = (v: string) =>
    update((d) => {
      d.design.barColor = v;
    });

  return (
    <Section title={isGallery ? 'Header' : 'Title & Author'}>
      <LabeledInput
        label="Top bar text"
        value={meta.masthead ?? ''}
        onChange={set('masthead')}
        placeholder="Publication or section name"
      />

      {isGallery ? (
        <LabeledColor label="Bar color" value={barColor} onChange={setBarColor} />
      ) : (
        <>
          <LabeledInput
            label={isMag ? 'Kicker' : 'Category'}
            value={meta.categoryLabel}
            onChange={set('categoryLabel')}
            placeholder={isMag ? 'COVER STORY' : 'Research Highlight · Physics'}
          />
          <LabeledInput label="Title" value={meta.title} onChange={set('title')} placeholder="Highlight title" />
          <LabeledInput
            label={isMag ? 'Lede (cover subtitle)' : 'Subtitle'}
            value={meta.subtitle}
            onChange={set('subtitle')}
            placeholder="One explanatory sentence"
          />
          <LabeledInput label="Author" value={meta.author} onChange={set('author')} placeholder="A. Rahman, S. Tan" />
          <LabeledInput
            label={isMag ? 'Affiliation / Section' : 'Affiliation'}
            value={meta.affiliation}
            onChange={set('affiliation')}
            placeholder="Organization or publication"
          />
        </>
      )}

      {isP2 && (
        <LabeledInput
          label="Hero caption"
          value={meta.heroCaption ?? ''}
          onChange={set('heroCaption')}
          placeholder="Hero image caption"
        />
      )}

      {isMag && (
        <>
          <p className="group-label">{isFrontCover ? 'Cover details' : 'Magazine elements'}</p>
          {!isFrontCover && (
            <LabeledInput
              label="Volume / Date"
              value={meta.volume ?? ''}
              onChange={set('volume')}
              placeholder="VOL. IX · NO.2 · MARCH 2026"
            />
          )}
          <LabeledInput
            label={isFrontCover ? 'Story tag' : 'Location (photo tag)'}
            value={meta.location ?? ''}
            onChange={set('location')}
            placeholder={isFrontCover ? 'SPECIAL COVER STORY' : 'MAUNA OBSERVATORY · 4,200 M ASL'}
          />
          <LabeledInput
            label="Photo credit"
            value={meta.photoCredit ?? ''}
            onChange={set('photoCredit')}
            placeholder="L. HAKIM"
          />
          {!isFrontCover && (
            <>
              <LabeledTextarea
                label="Pull-quote"
                value={meta.pullQuote ?? ''}
                onChange={set('pullQuote')}
                placeholder="Large quote shown across the spread…"
              />
              <LabeledInput
                label="Quote attribution"
                value={meta.pullQuoteBy ?? ''}
                onChange={set('pullQuoteBy')}
                placeholder="— DR. ARIA PRATAMA, FEB 2026"
              />
            </>
          )}
        </>
      )}
    </Section>
  );
}
