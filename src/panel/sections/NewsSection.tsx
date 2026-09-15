import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useDoc } from '../../store/useDoc';
import { assetIsReferenced, uid, type Design, type NewsStory } from '../../schema/document';
import { newNewsStory } from '../../store/news';
import {
  newsParagraphs,
  newsCopySpan,
  newsPhotoPosition,
  newsStoryWidth,
  newsTextColumns,
  type NewsColumnCount,
} from '../../lib/newsLayout';
import { NewsImageEditor } from './NewsImageEditor';
import { NewsOverview } from './NewsOverview';
import { useNewsProof } from '../../store/newsProof';
import {
  LabeledInput,
  LabeledNumber,
  LabeledTextarea,
  LabeledSelect,
  RowButtons,
  Section,
  SegmentField,
  Toggle,
} from '../Field';
import { TOKEN, wrapSelection, type Mark } from '../../lib/richtext';
import { clearActiveEditor, setActiveEditor } from '../../lib/activeEditor';
import { editorTargetId, requestEditorTargetFocus } from '../../lib/editorNavigation';

const EMPTY_STORIES: NewsStory[] = [];
const KEY_TO_MARK: Record<string, Mark> = { b: 'b', i: 'i', u: 'u' };

type PresetId = 'feature' | 'photo-top' | 'text-grid' | 'wide' | 'brief';
type Preset = {
  id: PresetId;
  label: string;
  description: string;
  patch: Pick<NewsStory, 'layout' | 'widthCols' | 'textCols' | 'photoPosition' | 'rowAlign'>;
};

function layoutPresets(pageColumns: Design['bodyCols']): Preset[] {
  const wide = Math.max(1, pageColumns - 1) as NewsColumnCount;
  return [
    { id: 'feature', label: 'Feature', description: 'Large photo beside the lead',
      patch: { layout: 'lead', widthCols: pageColumns,
        textCols: Math.max(1, Math.floor(pageColumns / 2)) as NewsColumnCount,
        photoPosition: 'right', rowAlign: 'start' } },
    { id: 'photo-top', label: 'Photo top', description: 'Photo above flowing copy',
      patch: { layout: 'compact', widthCols: pageColumns, textCols: pageColumns, photoPosition: 'top', rowAlign: 'start' } },
    { id: 'text-grid', label: 'Text grid', description: 'Full-width copy columns',
      patch: { layout: 'text', widthCols: pageColumns, textCols: pageColumns, photoPosition: 'none', rowAlign: 'start' } },
    { id: 'wide', label: 'Wide card', description: `${wide} of ${pageColumns} page columns`,
      patch: { layout: 'compact', widthCols: wide, textCols: Math.max(1, wide - 1) as NewsColumnCount, photoPosition: wide === 1 ? 'top' : 'right', rowAlign: 'start' } },
    { id: 'brief', label: 'Small brief', description: 'One compact page column',
      patch: { layout: 'single', widthCols: 1, textCols: 1, photoPosition: 'none', rowAlign: 'start' } },
  ];
}

function matchingPreset(story: NewsStory, presets: Preset[]) {
  return presets.find(({ patch }) => patch.layout === story.layout
    && patch.widthCols === story.widthCols
    && patch.textCols === story.textCols
    && patch.photoPosition === story.photoPosition
    && (story.rowAlign ?? 'start') === (patch.rowAlign ?? 'start')
    && story.photoCols === undefined)?.id;
}

function StoryTextEditor({ story, onChange }: { story: NewsStory; onChange: (value: string) => void }) {
  const editor = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = editor.current;
    return () => { if (element) clearActiveEditor(element); };
  }, []);
  const format = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const mark = KEY_TO_MARK[event.key.toLowerCase()];
    if (!mark) return;
    event.preventDefault();
    wrapSelection(event.currentTarget, TOKEN[mark], onChange);
  };
  return <label className="field" id={editorTargetId(`news-text-${story.id}`)}>
    <span className="field-label">Story text <small className="news-word-count">{story.text.trim() ? story.text.trim().split(/\s+/u).length : 0} words</small></span>
    <textarea ref={editor} aria-label="Story text" className="field-input field-textarea field-textarea--grow news-story-editor"
      dir="auto" value={story.text} rows={7}
      placeholder="Write the story here. Use a blank line between paragraphs."
      onFocus={event => setActiveEditor({ el: event.currentTarget, setValue: onChange })}
      onKeyDown={format}
      onChange={event => onChange(event.target.value)} />
  </label>;
}

export function NewsContent() {
  const doc = useDoc(state => state.doc);
  const update = useDoc(state => state.update);
  const stories = doc.news?.stories ?? [];
  const pageColumns = doc.design.bodyCols;
  const presets = layoutPresets(pageColumns);
  const proof = useNewsProof(state => state.proof);
  const [openStories, setOpenStories] = useState<Set<string>>(
    () => new Set(stories[0] ? [stories[0].id] : []),
  );
  const change = (id: string, fn: (story: NewsStory) => void) => update(d => {
    const story = d.news?.stories.find(item => item.id === id);
    if (story) fn(story);
  });
  const setParagraphTop = (id: string, index: number, value: number) => change(id, story => {
    const tops = [...(story.paragraphTops ?? [])];
    while (tops.length <= index) tops.push(0);
    tops[index] = Math.min(200, Math.max(0, Math.round(value) || 0));
    while (tops.length && !tops.at(-1)) tops.pop();
    if (tops.length) story.paragraphTops = tops;
    else delete story.paragraphTops;
  });

  return <Section title="News stories">
    <LabeledInput label="Issue / date" editorTarget="meta-volume" value={doc.meta.volume ?? ''}
      onChange={value => update(d => { d.meta.volume = value; })} />
    <SegmentField<Design['bodyCols']> label="Page grid" value={pageColumns}
      options={[{ value: 2, label: '2 columns' }, { value: 3, label: '3 columns' }, { value: 4, label: '4 columns' }]}
      onChange={value => update(d => { d.design.bodyCols = value; })} />
    <p className="hint news-editor-intro">Choose a starting layout, then adjust width, copy columns and photo position independently. Stories automatically fill each row in reading order.</p>
    <NewsOverview doc={doc} />
    <div className="news-desk-actions">
      <button type="button" onClick={() => setOpenStories(new Set(stories.map(story => story.id)))}>Expand stories</button>
      <button type="button" onClick={() => setOpenStories(new Set())}>Collapse stories</button>
    </div>
    <details className="formatting-help">
      <summary>Writing and formatting</summary>
      <p>A blank line starts a paragraph. Single line breaks reflow as normal text. Use <code>**bold**</code>, <code>*italic*</code>, <code>__underline__</code>, or the formatting bar.</p>
    </details>

    <div className="news-editor-list">
      {stories.map((story, index) => {
        const width = newsStoryWidth(story, pageColumns);
        const photo = newsPhotoPosition(story, width);
        const textColumns = newsTextColumns(story, width, photo);
        const maximumTextColumns = photo === 'left' || photo === 'right'
          ? newsCopySpan(story, width, photo)
          : width;
        const activePreset = matchingPreset(story, presets);
        const issues = proof?.doc === doc ? proof.issues.filter(issue => issue.storyId === story.id) : [];
        const layoutSummary = `${width}/${pageColumns} width · ${textColumns} ${textColumns === 1 ? 'text column' : 'text columns'}${photo === 'none' ? '' : ` · photo ${photo}`}`;
        return <details className="news-editor-card" key={story.id} open={openStories.has(story.id)}
          onToggle={event => {
            const isOpen = event.currentTarget.open;
            setOpenStories(current => {
              if (current.has(story.id) === isOpen) return current;
              const next = new Set(current);
              if (isOpen) next.add(story.id);
              else next.delete(story.id);
              return next;
            });
          }} id={editorTargetId(`news-${story.id}`)}>
          <summary className="news-editor-summary">
            <span className="news-editor-index">{index + 1}</span>
            <span className="news-editor-summary-copy">
              <strong>{story.title || 'Untitled brief'}</strong>
              <small>{layoutSummary}</small>
            </span>
          </summary>
          <div className="news-editor-card-body">
            <div className="news-editor-actions">
              <button type="button" className="news-duplicate-btn" onClick={() => {
                const duplicateId = uid();
                update(d => {
                  const source = d.news?.stories.find(item => item.id === story.id);
                  if (!source || !d.news) return;
                  const at = d.news.stories.indexOf(source);
                  d.news.stories.splice(at + 1, 0, {
                    ...source,
                    id: duplicateId,
                    title: `${source.title || 'Untitled brief'} copy`,
                    frame: source.frame ? { ...source.frame } : undefined,
                    paragraphTops: source.paragraphTops ? [...source.paragraphTops] : undefined,
                  });
                });
                setOpenStories(current => new Set(current).add(duplicateId));
              }}>Duplicate</button>
              <RowButtons disableUp={!index} disableDown={index === stories.length - 1}
                onUp={() => update(d => {
                  const list = d.news!.stories;
                  const current = list.findIndex(item => item.id === story.id);
                  if (current > 0) [list[current - 1], list[current]] = [list[current], list[current - 1]];
                })}
                onDown={() => update(d => {
                  const list = d.news!.stories;
                  const current = list.findIndex(item => item.id === story.id);
                  if (current >= 0 && current < list.length - 1) [list[current + 1], list[current]] = [list[current], list[current + 1]];
                })}
                onRemove={() => update(d => {
                  const list = d.news!.stories;
                  const current = list.findIndex(item => item.id === story.id);
                  if (current < 0) return;
                  const [removed] = list.splice(current, 1);
                  if (removed.assetId && !assetIsReferenced(d, removed.assetId)) delete d.assets[removed.assetId];
                })} />
            </div>

            <LabeledInput label="Headline" editorTarget={`news-title-${story.id}`} value={story.title}
              onChange={value => change(story.id, item => { item.title = value; })} />
            <details className="news-advanced news-editorial-fields">
              <summary>Kicker, summary & byline</summary>
              <LabeledInput label="Kicker" editorTarget={`news-kicker-${story.id}`} value={story.kicker ?? ''}
                onChange={value => change(story.id, item => { item.kicker = value; })} />
              <LabeledTextarea label="Summary / deck" editorTarget={`news-deck-${story.id}`} rows={2} value={story.deck ?? ''}
                onChange={value => change(story.id, item => { item.deck = value; })} />
              <LabeledInput label="Byline" editorTarget={`news-byline-${story.id}`} value={story.byline ?? ''}
                onChange={value => change(story.id, item => { item.byline = value; })} />
            </details>
            <StoryTextEditor story={story} onChange={value => change(story.id, item => { item.text = value; })} />
            <LabeledInput label="Source / web address (optional)" editorTarget={`news-source-${story.id}`}
              value={story.source} onChange={value => change(story.id, item => { item.source = value; })} />

            <div className="news-layout-heading">
              <strong>Starting layouts</strong>
              <span>Pick one, then fine-tune it below.</span>
            </div>
            <div className="news-layout-presets" role="group" aria-label="Story layout presets">
              {presets.map(preset => <button type="button" key={preset.id}
                className={`news-layout-preset${activePreset === preset.id ? ' is-active' : ''}`}
                aria-pressed={activePreset === preset.id}
                onClick={() => change(story.id, item => {
                  Object.assign(item, preset.patch);
                  delete item.photoCols;
                })}>
                <span className={`news-layout-swatch news-layout-swatch--${preset.id}`} aria-hidden="true"><i /><i /><i /><i /></span>
                <strong>{preset.label}</strong>
                <small>{preset.description}</small>
              </button>)}
            </div>

            <div className="news-layout-controls">
              <SegmentField<NewsColumnCount> label="Story width" value={width}
                options={Array.from({ length: pageColumns }, (_, i) => ({ value: (i + 1) as NewsColumnCount, label: i + 1 === pageColumns ? 'Full' : String(i + 1) }))}
                onChange={value => change(story.id, item => {
                  item.widthCols = value;
                  const currentPhoto = newsPhotoPosition(item, value);
                  const max = currentPhoto === 'left' || currentPhoto === 'right'
                    ? newsCopySpan(item, value, currentPhoto)
                    : value;
                  item.textCols = Math.min(item.textCols ?? newsTextColumns(item, value, currentPhoto), max) as NewsColumnCount;
                  if (value === 1 && (item.photoPosition === 'left' || item.photoPosition === 'right')) item.photoPosition = 'top';
                })} />
              <SegmentField<NewsColumnCount> label="Text columns" value={textColumns}
                options={Array.from({ length: maximumTextColumns }, (_, i) => ({ value: (i + 1) as NewsColumnCount, label: String(i + 1) }))}
                onChange={value => change(story.id, item => { item.textCols = value; })} />
              <SegmentField<NonNullable<NewsStory['photoPosition']>> label="Photo position" value={photo}
                options={(width === 1
                  ? [{ value: 'none', label: 'None' }, { value: 'top', label: 'Above' }]
                  : [{ value: 'none', label: 'None' }, { value: 'top', label: 'Above' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]) as { value: NonNullable<NewsStory['photoPosition']>; label: string }[]}
                onChange={value => change(story.id, item => {
                  item.photoPosition = value;
                  const max = value === 'left' || value === 'right'
                    ? newsCopySpan(item, width, value)
                    : width;
                  item.textCols = Math.min(item.textCols ?? textColumns, max) as NewsColumnCount;
                })} />
              {(photo === 'left' || photo === 'right') && <SegmentField<NewsColumnCount>
                label="Image columns" value={(width - newsCopySpan(story, width, photo)) as NewsColumnCount}
                options={Array.from({ length: width - 1 }, (_, index) => ({ value: index + 1 as NewsColumnCount, label: String(index + 1) }))}
                onChange={value => change(story.id, item => {
                  item.photoCols = value;
                  item.textCols = Math.min(textColumns, width - value) as NewsColumnCount;
                })} />}
              {photo !== 'none' && <button type="button" className="news-duplicate-btn"
                onClick={() => requestEditorTargetFocus('images', `news-photo-${story.id}`)}>Edit image, size & crop</button>}
              {width < pageColumns && <SegmentField<NonNullable<NewsStory['rowAlign']>> label="Incomplete row position"
                value={story.rowAlign ?? 'start'}
                options={[{ value: 'start', label: 'Start' }, { value: 'center', label: 'Centre' }, { value: 'end', label: 'End' }]}
                onChange={value => change(story.id, item => { item.rowAlign = value; })} />}
              <Toggle label="Start on a new row" checked={story.rowBreakBefore ?? false}
                onChange={value => change(story.id, item => { item.rowBreakBefore = value; })} />
              <Toggle label="Start on a new page" checked={story.breakBefore ?? false}
                onChange={value => change(story.id, item => { item.breakBefore = value; })} />
              <LabeledSelect label="Story order" value={String(index)}
                options={stories.map((item, position) => ({ value: String(position), label: `${position + 1} — ${item.title || 'Untitled brief'}` }))}
                onChange={value => update(d => {
                  const list = d.news!.stories;
                  const current = list.findIndex(item => item.id === story.id);
                  if (current < 0) return;
                  const [moved] = list.splice(current, 1);
                  const requested = Number(value);
                  // The select value is the story's desired final index. Once
                  // the current item is removed, that same index still means
                  // “after the selected story” when moving down.
                  const target = requested;
                  list.splice(Math.max(0, Math.min(target, list.length)), 0, moved);
                })} />
            </div>

            {!!issues.length && <ul className="news-story-checks">{issues.map((issue, i) => <li className={issue.blocking ? 'is-blocking' : ''} key={i}>{issue.message}</li>)}</ul>}

            <details className="news-advanced">
              <summary>Typography & paragraph style</summary>
              <LabeledNumber label="Headline size" unit="pt" value={story.headlineSize ?? doc.design.sizes.title * (story.layout === 'lead' ? 1 : story.layout === 'aside' ? .62 : .8)} min={8} max={60} step={.5}
                onChange={value => change(story.id, item => { item.headlineSize = value; })} />
              <LabeledNumber label="Body size" unit="pt" value={story.bodySize ?? doc.design.sizes.body} min={7} max={20} step={.1}
                onChange={value => change(story.id, item => { item.bodySize = value; })} />
              <LabeledNumber label="Line spacing" value={story.lineHeight ?? 1.48} min={1.1} max={2} step={.05}
                onChange={value => change(story.id, item => { item.lineHeight = value; })} />
              <SegmentField label="Paragraphs" value={story.paragraphStyle ?? 'indent'}
                options={[{ value: 'indent', label: 'Indent' }, { value: 'spaced', label: 'Space between' }]}
                onChange={value => change(story.id, item => { item.paragraphStyle = value; })} />
              <button type="button" className="news-duplicate-btn" onClick={() => change(story.id, item => {
                delete item.headlineSize; delete item.bodySize; delete item.lineHeight; delete item.paragraphStyle;
              })}>Reset typography to theme</button>
            </details>

            <details className="news-advanced">
              <summary>Paragraph spacing</summary>
              <p className="hint">Optional extra space before each paragraph.</p>
              <div className="news-paragraph-grid">
                {newsParagraphs(story.text).map((_, paragraph) => <LabeledNumber key={paragraph}
                  label={`Paragraph ${paragraph + 1}`} unit="px" value={story.paragraphTops?.[paragraph] ?? 0}
                  min={0} max={200} step={1}
                  onChange={value => setParagraphTop(story.id, paragraph, value)} />)}
              </div>
            </details>
          </div>
        </details>;
      })}
    </div>
    <button type="button" className="add-btn" onClick={() => {
      const story = newNewsStory();
      update(d => {
        d.news ??= { stories: [] };
        d.news.stories.push(story);
      });
      setOpenStories(current => new Set(current).add(story.id));
    }}>+ Add brief</button>
  </Section>;
}

function StoryImage({ story, index, open, onOpenChange }: {
  story: NewsStory;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return <details className="news-editor-card news-image-card" open={open}
    onToggle={event => onOpenChange(event.currentTarget.open)}
    id={editorTargetId(`news-photo-${story.id}`)}>
    <summary className="news-editor-summary">
      <span className="news-editor-index">{index + 1}</span>
      <span className="news-editor-summary-copy"><strong>{story.title || 'Untitled brief'}</strong><small>{story.assetId ? 'Image added' : 'No image'}</small></span>
    </summary>
    <div className="news-editor-card-body"><NewsImageEditor story={story} /></div>
  </details>;
}

export function NewsImages() {
  const stories = useDoc(state => state.doc.news?.stories ?? EMPTY_STORIES);
  const [openStories, setOpenStories] = useState<Set<string>>(
    () => new Set(stories[0] ? [stories[0].id] : []),
  );
  return <>{stories.length
    ? <div className="news-editor-list">{stories.map((story, index) => <StoryImage key={story.id}
      story={story} index={index} open={openStories.has(story.id)} onOpenChange={isOpen => {
        setOpenStories(current => {
          if (current.has(story.id) === isOpen) return current;
          const next = new Set(current);
          if (isOpen) next.add(story.id);
          else next.delete(story.id);
          return next;
        });
      }} />)}</div>
    : <p className="hint">Add a brief in Content first.</p>}</>;
}
