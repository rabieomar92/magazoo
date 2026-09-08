import { useRef, useState } from 'react';
import { useDoc } from '../../store/useDoc';
import { assetIsReferenced, uid, type NewsStory } from '../../schema/document';
import { newNewsStory } from '../../store/news';
import { isTextOnly, newsParagraphs, pairsWithPrevious } from '../../lib/newsLayout';
import { loadImage, ImageLoadError } from '../../lib/loadImage';
import { FramedImage } from '../../components/FramedImage';
import { LabeledInput, LabeledNumber, LabeledTextarea, LabeledSelect, LabeledRange, RowButtons, Section, Toggle } from '../Field';

const EMPTY_STORIES: NewsStory[] = [];

export function NewsContent() {
  const doc = useDoc(s => s.doc);
  const update = useDoc(s => s.update);
  const stories = doc.news?.stories ?? [];
  const change = (id: string, fn: (story: NewsStory) => void) => update(d => { const story = d.news?.stories.find(s => s.id === id); if (story) fn(story); });
  /** Store one paragraph's spacing. Trailing zeros are dropped so a brief that
   *  uses none of this keeps no spacing data at all. */
  const setParagraphTop = (id: string, index: number, value: number) => change(id, story => {
    const tops = [...(story.paragraphTops ?? [])];
    while (tops.length <= index) tops.push(0);
    tops[index] = Math.min(200, Math.max(0, Math.round(value) || 0));
    while (tops.length && !tops.at(-1)) tops.pop();
    if (tops.length) story.paragraphTops = tops; else delete story.paragraphTops;
  });
  return <Section title="News stories">
    <LabeledInput label="Issue / date" editorTarget="meta-volume" value={doc.meta.volume ?? ''} onChange={v => update(d => { d.meta.volume = v; })} />
    <p className="hint">Stories run from top to bottom. A side column runs beside the brief above it. Add photographs in Images. Long stories continue onto new pages; no text is squeezed or stretched.</p>
    {stories.map((story,i) => <Section key={story.id} title={`Brief ${i+1}`} editorTarget={`news-${story.id}`}>
      <div className="list-item-head"><span className="hint">{story.title || 'Untitled brief'}</span><RowButtons disableUp={!i} disableDown={i === stories.length-1}
        onUp={() => update(d => { const list=d.news!.stories; [list[i-1],list[i]]=[list[i],list[i-1]]; })}
        onDown={() => update(d => { const list=d.news!.stories; [list[i+1],list[i]]=[list[i],list[i+1]]; })}
        onRemove={() => update(d => { d.news!.stories.splice(i,1); if (story.assetId && !assetIsReferenced(d,story.assetId)) delete d.assets[story.assetId]; })}/></div>
      <LabeledInput label="Headline" value={story.title} onChange={v => change(story.id,s=>{s.title=v;})} />
      <LabeledTextarea label="Story text" rows={9} value={story.text} onChange={v => change(story.id,s=>{s.text=v;})} />
      <p className="hint">Top-to-text spacing above each paragraph, the same control the article templates carry.</p>
      <div className="news-paragraph-grid">
        {newsParagraphs(story.text).map((_,p) => <LabeledNumber key={p} label={`Paragraph ${p+1}`} unit="px"
          value={story.paragraphTops?.[p] ?? 0} min={0} max={200} step={1}
          onChange={v => setParagraphTop(story.id,p,v)} />)}
      </div>
      <LabeledInput label="Source / web address (optional)" value={story.source} onChange={v => change(story.id,s=>{s.source=v;})} />
      <LabeledSelect label="Story layout" value={story.layout} options={[{value:'lead',label:'Lead · large photograph'},{value:'compact',label:'Compact · side photograph'},{value:'text',label:'Text only · three columns'},{value:'single',label:'One column · narrow text brief'},{value:'aside',label:'Side column · one column beside the brief above'}]} onChange={v => change(story.id,s=>{s.layout=v as NewsStory['layout'];})} />
      {story.layout === 'aside' && <p className="hint">{
        pairsWithPrevious(stories[i-1], story)
          ? `Runs down the outer edge beside “${stories[i-1].title || 'the brief above'}”, sharing its band. If the two are too tall for one page together, this brief keeps its own row.`
          : story.breakBefore ? 'Starting on a new page keeps this column on a row of its own.'
          : i ? 'The brief above is also a side column, so this one prints below it rather than beside it.'
          : 'Add a brief above this one for the side column to run beside.'}</p>}
      <Toggle label="Start on a new page" checked={story.breakBefore ?? false} onChange={v => change(story.id,s=>{s.breakBefore=v;})} />
    </Section>)}
    <button className="add-btn" onClick={() => update(d => { d.news ??= {stories:[]}; d.news.stories.push(newNewsStory()); })}>+ Add brief</button>
  </Section>;
}

function StoryImage({ story }: { story: NewsStory }) {
  const asset = useDoc(s => story.assetId ? s.doc.assets[story.assetId] : undefined);
  const templateId = useDoc(s => s.doc.templateId);
  const update = useDoc(s => s.update);
  const fileRef = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const frame = story.frame ?? {scale:1,offsetX:0,offsetY:0};
  const change = (fn: (s:NewsStory)=>void) => update(d => { const s=d.news?.stories.find(item=>item.id===story.id); if(s) fn(s); });
  const upload = async (file?:File) => {
    if (!file) return;
    const token=++request.current;
    setLoading(true); setError('');
    try {
      const loaded=await loadImage(file);
      if(token!==request.current) return;
      update(d=>{
        if(d.templateId!==templateId) return;
        const s=d.news?.stories.find(item=>item.id===story.id);
        if(!s) return;
        const old=s.assetId; const id=uid();
        d.assets[id]=loaded; s.assetId=id; s.frame={scale:1,offsetX:0,offsetY:0};
        if(old && !assetIsReferenced(d,old)) delete d.assets[old];
      });
    } catch(e) { if(token===request.current) setError(e instanceof ImageLoadError ? e.message : 'Could not load this image.'); }
    finally { if(token===request.current) setLoading(false); }
  };
  return <Section title={story.title || 'Brief photograph'} editorTarget={`news-photo-${story.id}`}>
    <input type="file" ref={fileRef} accept="image/*" hidden onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}} />
    {asset && <div className="hero-thumb"><FramedImage asset={asset} frame={frame}/></div>}
    <div className="hero-actions">
      <button className="add-btn" disabled={loading} onClick={()=>fileRef.current?.click()}>{loading?'Loading image…':asset?'Replace photograph':'+ Upload photograph'}</button>
      {asset && <button className="icon-btn icon-btn--danger" title="Remove photograph" onClick={()=>{++request.current;setLoading(false);update(d=>{const s=d.news?.stories.find(item=>item.id===story.id);if(!s)return;const old=s.assetId;s.assetId=undefined;if(old&&!assetIsReferenced(d,old))delete d.assets[old];});}}>✕</button>}
    </div>
    {asset && <>
      <LabeledRange label="Zoom" value={frame.scale} min={.5} max={3} step={.05} onChange={v=>change(s=>{s.frame={...frame,scale:v};})}/>
      <LabeledRange label="Shift horizontally" value={frame.offsetX} min={-50} max={50} onChange={v=>change(s=>{s.frame={...frame,offsetX:v};})}/>
      <LabeledRange label="Shift vertically" value={frame.offsetY} min={-50} max={50} onChange={v=>change(s=>{s.frame={...frame,offsetY:v};})}/>
    </>}
    <LabeledTextarea label="Caption / photo credit" value={story.caption} rows={3} onChange={v=>change(s=>{s.caption=v;})}/>
    {isTextOnly(story.layout) && <p className="hint">This story layout is text-only. Choose Lead or Compact in Content to show its photograph.</p>}
    {error && <p className="hint hint--warn" role="alert">{error}</p>}
  </Section>;
}
export function NewsImages() {
  const stories=useDoc(s=>s.doc.news?.stories??EMPTY_STORIES);
  return <>{stories.length ? stories.map(story=><StoryImage key={story.id} story={story}/>) : <p className="hint">Add a brief in Content first.</p>}</>;
}
