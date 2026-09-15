import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { NewsPhoto } from '../../components/NewsPhoto';
import { assetIsReferenced, uid, type NewsStory } from '../../schema/document';
import { normalizeImageFrame } from '../../lib/imageFrame';
import { loadImage, ImageLoadError } from '../../lib/loadImage';
import { newsPhotoPosition, newsStoryWidth, pairsWithPrevious, type NewsColumnCount } from '../../lib/newsLayout';
import { newsCustomPhotoHeight, newsPhotoFrameMetrics } from '../../lib/newsPhotoGeometry';
import { useDoc } from '../../store/useDoc';
import { LabeledInput, LabeledNumber, LabeledRange, LabeledTextarea, SegmentField } from '../Field';

export function NewsImageEditor({ story }: { story: NewsStory }) {
  const doc = useDoc(state => state.doc);
  const update = useDoc(state => state.update);
  const asset = story.assetId ? doc.assets[story.assetId] : undefined;
  const fileRef = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const mounted = useRef(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current += 1; };
  }, [story.id]);

  const change = (edit: (item: NewsStory) => void) => update(d => {
    const item = d.news?.stories.find(candidate => candidate.id === story.id);
    if (item) edit(item);
  });
  const list = doc.news?.stories ?? [];
  const index = list.findIndex(candidate => candidate.id === story.id);
  const storyColumns = pairsWithPrevious(story, list[index + 1])
    ? Math.max(1, doc.design.bodyCols - 1) as NewsColumnCount
    : newsStoryWidth(story, doc.design.bodyCols);
  const photo = newsPhotoPosition(story, storyColumns);
  const frame = normalizeImageFrame(story.frame);
  const fit = story.photoFit ?? 'cover';
  const metrics = asset ? newsPhotoFrameMetrics(story, asset, doc.design, storyColumns) : null;
  const heightMode = story.photoHeight === 0 ? 'natural' : story.photoHeight === undefined ? 'theme' : 'custom';

  const upload = async (file?: File) => {
    if (!file) return;
    const token = ++request.current;
    setLoading(true);
    setError('');
    try {
      const loaded = await loadImage(file);
      if (!mounted.current || token !== request.current) return;
      // Text/layout edits clone the document on every keystroke. They are safe
      // to keep while an image decodes; only a removed story makes this upload
      // stale and unable to receive the new asset.
      if (!useDoc.getState().doc.news?.stories.some(candidate => candidate.id === story.id)) {
        setError('This story was removed while the image was loading.');
        return;
      }
      update(d => {
        const item = d.news?.stories.find(candidate => candidate.id === story.id);
        if (!item) return;
        const previousAsset = item.assetId;
        const id = uid();
        d.assets[id] = loaded;
        item.assetId = id;
        item.frame = { scale: 1, offsetX: 0, offsetY: 0 };
        item.photoFit = 'contain';
        item.photoHeight = 0;
        if (newsPhotoPosition(item, newsStoryWidth(item, d.design.bodyCols)) === 'none') {
          item.photoPosition = newsStoryWidth(item, d.design.bodyCols) === 1 ? 'top' : 'right';
        }
        if (previousAsset && !assetIsReferenced(d, previousAsset)) delete d.assets[previousAsset];
      });
    } catch (reason) {
      if (mounted.current && token === request.current) {
        setError(reason instanceof ImageLoadError ? reason.message : 'Could not load this image. Please try another image file.');
      }
    } finally {
      if (mounted.current && token === request.current) setLoading(false);
    }
  };

  return <div className="news-image-editor">
    <input type="file" ref={fileRef} accept="image/*" hidden
      onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
    {asset && metrics && <>
      <div className="news-photo-preview" style={{ '--news-photo-aspect': metrics.aspectRatio } as CSSProperties}>
        <NewsPhoto story={story} asset={asset} preview />
      </div>
      <p className="hint news-image-dimensions">
        {metrics.vector ? 'Vector image' : `${asset.naturalWidth.toLocaleString()} × ${asset.naturalHeight.toLocaleString()} pixels`}
        {' · '}{metrics.width.toFixed(1)} × {metrics.height.toFixed(1)} mm in print
        {metrics.ppi !== null && ` · about ${Math.round(metrics.ppi)} ppi`}
      </p>
      {metrics.ppi !== null && metrics.ppi < 150 && <p className="hint hint--warn news-photo-warning" role="status">
        This image may look soft in print. Use a higher-resolution source, reduce its printed size, or zoom out.
      </p>}
    </>}
    <div className="hero-actions">
      <button type="button" className="add-btn" disabled={loading} onClick={() => fileRef.current?.click()}>
        {loading ? 'Loading image…' : asset ? 'Replace image' : '+ Upload image'}
      </button>
      {asset && <button type="button" className="icon-btn icon-btn--danger" title="Remove image" aria-label="Remove image"
        onClick={() => {
          request.current += 1;
          setLoading(false);
          setError('');
          update(d => {
            const item = d.news?.stories.find(candidate => candidate.id === story.id);
            if (!item) return;
            const previousAsset = item.assetId;
            delete item.assetId;
            delete item.frame;
            if (previousAsset && !assetIsReferenced(d, previousAsset)) delete d.assets[previousAsset];
          });
        }}>✕</button>}
    </div>
    {error && <p className="hint hint--warn" role="alert">{error}</p>}
    {asset && <>
      <SegmentField<'contain' | 'cover'> label="Image fit" value={fit}
        options={[{ value: 'contain', label: 'Show whole image' }, { value: 'cover', label: 'Crop to fill' }]}
        onChange={value => change(item => { item.photoFit = value; })} />
      <p className="hint">Show whole image keeps every label and edge visible. Crop to fill lets you choose the framing.</p>
      <SegmentField<'natural' | 'custom' | 'theme'> label="Image height" value={heightMode}
        options={[{ value: 'natural', label: 'Natural ratio' }, { value: 'custom', label: 'Set height' }, { value: 'theme', label: 'Theme height' }]}
        onChange={value => change(item => {
          if (value === 'natural') item.photoHeight = 0;
          else if (value === 'theme') delete item.photoHeight;
          else item.photoHeight = newsCustomPhotoHeight(metrics?.height ?? 60);
        })} />
      {heightMode === 'custom' && <LabeledNumber label="Printed frame height" unit="mm" value={newsCustomPhotoHeight(story.photoHeight!)}
        min={15} max={220} step={1} onChange={value => change(item => { item.photoHeight = newsCustomPhotoHeight(value); })} />}
      {fit === 'cover' && <div className="news-photo-crop-controls">
        <LabeledRange label="Image zoom" value={frame.scale} min={.5} max={3} step={.05} format={value => `${Math.round(value * 100)}%`}
          onChange={value => change(item => { item.frame = { ...normalizeImageFrame(item.frame), scale: value }; })} />
        <LabeledRange label="Move horizontally" value={frame.offsetX} min={-50} max={50} step={1}
          onChange={value => change(item => { item.frame = { ...normalizeImageFrame(item.frame), offsetX: value }; })} />
        <LabeledRange label="Move vertically" value={frame.offsetY} min={-50} max={50} step={1}
          onChange={value => change(item => { item.frame = { ...normalizeImageFrame(item.frame), offsetY: value }; })} />
        <button type="button" className="add-btn" onClick={() => change(item => { item.frame = { scale: 1, offsetX: 0, offsetY: 0 }; })}>Reset crop</button>
      </div>}
    </>}
    <LabeledTextarea label="Caption" editorTarget={`news-caption-${story.id}`} value={story.caption} rows={3}
      placeholder="Explain what the image shows."
      onChange={value => change(item => { item.caption = value; })} />
    <LabeledInput label="Photo credit" editorTarget={`news-credit-${story.id}`} value={story.photoCredit ?? ''}
      placeholder="Photographer / organisation / licence"
      onChange={value => change(item => { item.photoCredit = value; })} />
    <LabeledTextarea label="Image description (accessibility)" editorTarget={`news-alt-${story.id}`} value={story.photoAlt ?? ''} rows={2}
      placeholder="Describe the visual information for someone who cannot see the image."
      onChange={value => change(item => { item.photoAlt = value; })} />
    {asset && photo === 'none' && <div className="news-photo-hidden">
      <p className="hint">This story currently hides its image.</p>
      <button type="button" className="add-btn" onClick={() => change(item => {
        item.photoPosition = storyColumns === 1 ? 'top' : 'right';
      })}>Show image in story</button>
    </div>}
  </div>;
}
