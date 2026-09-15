import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
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
import { loadImage, ImageLoadError } from '../../lib/loadImage';
import { FramedImage } from '../../components/FramedImage';
import {
  LabeledInput,
  LabeledNumber,
  LabeledTextarea,
  LabeledRange,
  RowButtons,
  Section,
  SegmentField,
  Toggle,
} from '../Field';
import { TOKEN, wrapSelection, type Mark } from '../../lib/richtext';
import { setActiveEditor } from '../../lib/activeEditor';
import { editorTargetId } from '../../lib/editorNavigation';

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
    && patch.photoPosition === story.photoPosition)?.id;
}

function StoryTextEditor({ story, onChange }: { story: NewsStory; onChange: (value: string) => void }) {
  const format = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const mark = KEY_TO_MARK[event.key.toLowerCase()];
    if (!mark) return;
    event.preventDefault();
    wrapSelection(event.currentTarget, TOKEN[mark], onChange);
  };
  return <label className="field" id={editorTargetId(`news-text-${story.id}`)}>
    <span className="field-label">Story text</span>
    <textarea className="field-input field-textarea field-textarea--grow news-story-editor"
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
                onUp={() => update(d => { const list = d.news!.stories; [list[index - 1], list[index]] = [list[index], list[index - 1]]; })}
                onDown={() => update(d => { const list = d.news!.stories; [list[index + 1], list[index]] = [list[index], list[index + 1]]; })}
                onRemove={() => update(d => {
                  d.news!.stories.splice(index, 1);
                  if (story.assetId && !assetIsReferenced(d, story.assetId)) delete d.assets[story.assetId];
                })} />
            </div>

            <LabeledInput label="Headline" editorTarget={`news-title-${story.id}`} value={story.title}
              onChange={value => change(story.id, item => { item.title = value; })} />
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
                onClick={() => change(story.id, item => { Object.assign(item, preset.patch); })}>
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
              {width < pageColumns && <SegmentField<NonNullable<NewsStory['rowAlign']>> label="Incomplete row position"
                value={story.rowAlign ?? 'start'}
                options={[{ value: 'start', label: 'Start' }, { value: 'center', label: 'Centre' }, { value: 'end', label: 'End' }]}
                onChange={value => change(story.id, item => { item.rowAlign = value; })} />}
              <Toggle label="Start on a new row" checked={story.rowBreakBefore ?? false}
                onChange={value => change(story.id, item => { item.rowBreakBefore = value; })} />
              <Toggle label="Start on a new page" checked={story.breakBefore ?? false}
                onChange={value => change(story.id, item => { item.breakBefore = value; })} />
            </div>

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
  const asset = useDoc(state => story.assetId ? state.doc.assets[story.assetId] : undefined);
  const templateId = useDoc(state => state.doc.templateId);
  const update = useDoc(state => state.update);
  const fileRef = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const frame = story.frame ?? { scale: 1, offsetX: 0, offsetY: 0 };
  const photo = newsPhotoPosition(story);
  const change = (fn: (item: NewsStory) => void) => update(d => {
    const item = d.news?.stories.find(candidate => candidate.id === story.id);
    if (item) fn(item);
  });
  const upload = async (file?: File) => {
    if (!file) return;
    const token = ++request.current;
    setLoading(true);
    setError('');
    try {
      const loaded = await loadImage(file);
      if (token !== request.current) return;
      update(d => {
        if (d.templateId !== templateId) return;
        const item = d.news?.stories.find(candidate => candidate.id === story.id);
        if (!item) return;
        const old = item.assetId;
        const id = uid();
        d.assets[id] = loaded;
        item.assetId = id;
        item.frame = { scale: 1, offsetX: 0, offsetY: 0 };
        if (old && !assetIsReferenced(d, old)) delete d.assets[old];
      });
    } catch (reason) {
      if (token === request.current) setError(reason instanceof ImageLoadError ? reason.message : 'Could not load this image.');
    } finally {
      if (token === request.current) setLoading(false);
    }
  };
  return <details className="news-editor-card news-image-card" open={open}
    onToggle={event => onOpenChange(event.currentTarget.open)}
    id={editorTargetId(`news-photo-${story.id}`)}>
    <summary className="news-editor-summary">
      <span className="news-editor-index">{index + 1}</span>
      <span className="news-editor-summary-copy"><strong>{story.title || 'Untitled brief'}</strong><small>{asset ? 'Photograph added' : 'No photograph'}</small></span>
    </summary>
    <div className="news-editor-card-body">
      <input type="file" ref={fileRef} accept="image/*" hidden
        onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
      {asset && <div className="hero-thumb"><FramedImage asset={asset} frame={frame} /></div>}
      <div className="hero-actions">
        <button className="add-btn" disabled={loading} onClick={() => fileRef.current?.click()}>{loading ? 'Loading image…' : asset ? 'Replace photograph' : '+ Upload photograph'}</button>
        {asset && <button className="icon-btn icon-btn--danger" title="Remove photograph" onClick={() => {
          ++request.current;
          setLoading(false);
          update(d => {
            const item = d.news?.stories.find(candidate => candidate.id === story.id);
            if (!item) return;
            const old = item.assetId;
            item.assetId = undefined;
            if (old && !assetIsReferenced(d, old)) delete d.assets[old];
          });
        }}>✕</button>}
      </div>
      {asset && <>
        <LabeledRange label="Zoom" value={frame.scale} min={.5} max={3} step={.05}
          onChange={value => change(item => { item.frame = { ...frame, scale: value }; })} />
        <LabeledRange label="Shift horizontally" value={frame.offsetX} min={-50} max={50}
          onChange={value => change(item => { item.frame = { ...frame, offsetX: value }; })} />
        <LabeledRange label="Shift vertically" value={frame.offsetY} min={-50} max={50}
          onChange={value => change(item => { item.frame = { ...frame, offsetY: value }; })} />
      </>}
      <LabeledTextarea label="Caption / photo credit" value={story.caption} rows={3}
        onChange={value => change(item => { item.caption = value; })} />
      {photo === 'none' && <p className="hint">This story currently hides its photograph. Choose a photo position in Content to show it.</p>}
      {error && <p className="hint hint--warn" role="alert">{error}</p>}
    </div>
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
