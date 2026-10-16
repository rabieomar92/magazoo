import { useDoc } from '../../store/useDoc';
import { familyOf } from '../../schema/document';
import { LabeledColor, LabeledInput, LabeledSelect, LabeledTextarea, Section } from '../Field';
import { supportsArticleHeaderWidth } from '../../lib/articleHeaderWidth';
import type { Design } from '../../schema/document';

export function MetaSection() {
  const meta = useDoc((s) => s.doc.meta);
  const isMag = useDoc((s) => familyOf(s.doc.templateId) === 'magazine');
  const isGallery = useDoc((s) => familyOf(s.doc.templateId) === 'gallery');
  const isFrontCover = useDoc((s) => s.doc.templateId === 'magazine-4');
  const barColor = useDoc((s) => s.doc.design.barColor ?? s.doc.design.colors.accent);
  const isNews = useDoc(s => s.doc.templateId === 'news-briefs');
  const isBoard = useDoc(s => s.doc.templateId === 'frontmatter-board');
  const showAuthor = useDoc(s => s.doc.templateId !== 'frontmatter-contents' && s.doc.templateId !== 'frontmatter-board' && s.doc.templateId !== 'news-briefs');
  const update = useDoc((s) => s.update);
  const headerWidth = useDoc(s => s.doc.design.headerWidthCols);
  const hasHeaderWidth = useDoc(s => supportsArticleHeaderWidth(s.doc.templateId));

  const set = (key: keyof typeof meta) => (v: string) =>
    update((d) => {
      d.meta[key] = v;
    });

  const setBarColor = (v: string) =>
    update((d) => {
      d.design.barColor = v;
    });

  return (
    <Section title={isGallery ? 'Header' : isNews ? 'Page header (optional)' : isBoard ? 'Editorial page text' : 'Title & Author'} collapsible defaultOpen={false}>
      {hasHeaderWidth && <>
        <LabeledSelect label="Heading box width" value={headerWidth === undefined ? 'template' : String(headerWidth)} options={[
          {value:'template',label:'Template default'},
          ...[1,2,3,4].map(n=>({value:String(n),label:`${n} column${n===1?'':'s'}`})),
        ]} onChange={value=>update(d=>{
          if(value==='template') delete d.design.headerWidthCols;
          else d.design.headerWidthCols=Number(value) as Design['headerWidthCols'];
        })}/>
        <p className="hint">Title, subtitle, author and affiliation share this width on a four-column page grid. Text reflows at its existing font size. Template default restores the original composition.</p>
      </>}
      <LabeledInput
        label="Top bar text"
        editorTarget="meta-masthead"
        value={meta.masthead ?? ''}
        onChange={set('masthead')}
        placeholder="Publication or section name"
      />

      {isGallery ? (
        <LabeledColor editorTarget="design-topbar" label="Bar color" value={barColor} onChange={setBarColor} />
      ) : (
        <>
          <LabeledInput
            label={isBoard ? 'Hero caption title' : isMag ? 'Kicker' : 'Category'}
            editorTarget="meta-category"
            value={meta.categoryLabel}
            onChange={set('categoryLabel')}
            placeholder={isMag ? 'COVER STORY' : 'Research Highlight · Physics'}
          />
          <LabeledTextarea rows={2} editorTarget="meta-title" label="Title" value={meta.title} onChange={set('title')} placeholder="Highlight title" />
          <LabeledTextarea
            rows={3}
            label={isMag ? 'Lede (cover subtitle)' : 'Subtitle'}
            editorTarget="meta-subtitle"
            value={meta.subtitle}
            onChange={set('subtitle')}
            placeholder="One explanatory sentence"
          />
          {isBoard && <>
            <LabeledInput
              label="Hero image credit"
              editorTarget="meta-photo-credit"
              value={meta.photoCredit ?? ''}
              onChange={set('photoCredit')}
              placeholder="Photo: name or organisation"
            />
          </>}
          {showAuthor && <><LabeledInput editorTarget="meta-author" label="Author" value={meta.author} onChange={set('author')} placeholder="A. Rahman, S. Tan" />
          <LabeledInput
            label={isMag ? 'Affiliation / Section' : 'Affiliation'}
            editorTarget="meta-affiliation"
            value={meta.affiliation}
            onChange={set('affiliation')}
            placeholder="Organization or publication"
          /></>}
        </>
      )}

      {isMag && (
        <>
          <p className="group-label">{isFrontCover ? 'Cover details' : 'Magazine elements'}</p>
          {!isFrontCover && (
            <LabeledInput
              label="Volume / Date"
              editorTarget="meta-volume"
              value={meta.volume ?? ''}
              onChange={set('volume')}
              placeholder="VOL. IX · NO.2 · MARCH 2026"
            />
          )}
          <LabeledInput
            label={isFrontCover ? 'Story tag' : 'Location (photo tag)'}
            editorTarget="meta-location"
            value={meta.location ?? ''}
            onChange={set('location')}
            placeholder={isFrontCover ? 'SPECIAL COVER STORY' : 'MAUNA OBSERVATORY · 4,200 M ASL'}
          />
          <LabeledInput
            label="Photo credit"
            editorTarget="meta-photo-credit"
            value={meta.photoCredit ?? ''}
            onChange={set('photoCredit')}
            placeholder="L. HAKIM"
          />
          {!isFrontCover && (
            <>
              <LabeledTextarea
                label="Pull-quote"
                editorTarget="meta-pull-quote"
                value={meta.pullQuote ?? ''}
                onChange={set('pullQuote')}
                placeholder="Large quote shown across the spread…"
              />
              <LabeledInput
                label="Quote attribution"
                editorTarget="meta-pull-quote-by"
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
