import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useDoc,currentDocumentSession } from '../../store/useDoc';
import { assetIsReferenced, uid, type Doc, type Asset } from '../../schema/document';
import { loadImage, ImageLoadError } from '../../lib/loadImage';
import type { ImageFrame } from '../../lib/imageFrame';
import type { ImageFit } from '../../lib/imageFrame';
import { FramedImage } from '../../components/FramedImage';
import { LabeledNumber, LabeledRange, LabeledTextarea, Section, SegmentField } from '../Field';
import { heroCaptionText } from '../../lib/heroCaption';
import { emptyFrontMatter } from '../../store/frontMatter';
import { emptyBackCover } from '../../store/backCover';
import { MagazooLoader } from '../../components/MagazooLoader';
import {heroCaptionPageDimensions} from '../../lib/heroCaptionPlacement';

type Frame = ImageFrame & { assetId: string | null };
export type ImageSlot = 'hero' | 'cover' | 'frontmatter-logo' | 'frontmatter-signature' | 'backcover-qr' | 'backcover-logo';
const EMPTY_FRAME: Frame = { assetId: null, offsetX: 0, offsetY: 0, scale: 1 };

const frameFor = (doc: Doc, slot: ImageSlot): Frame => {
  if (slot === 'frontmatter-logo') return (doc.frontMatter?.logo ?? EMPTY_FRAME) as Frame;
  if (slot === 'frontmatter-signature') return (doc.frontMatter?.signature ?? EMPTY_FRAME) as Frame;
  if (slot === 'backcover-qr') return (doc.backCover?.qr ?? EMPTY_FRAME) as Frame;
  if (slot === 'backcover-logo') return (doc.backCover?.logo ?? EMPTY_FRAME) as Frame;
  return (doc[slot] ?? EMPTY_FRAME) as Frame;
};

interface ImagePickerProps {
  slot: ImageSlot;
  title: string;
  blurb?: string;
  fit?: ImageFit;
  thumbAspectRatio?: string;
  framing?: boolean;
  renderPreview?: (asset: Asset) => ReactNode;
  children?: ReactNode;
}

/** One uploadable, framable image bound to a deliberately independent slot. */
export function ImagePicker({ slot, title, blurb, fit = 'cover', thumbAspectRatio, framing = true, renderPreview, children }: ImagePickerProps) {
  const frame = useDoc((s) => frameFor(s.doc, slot));
  const asset = useDoc((s) => {
    const f = frameFor(s.doc, slot);
    return f.assetId ? s.doc.assets[f.assetId] : null;
  });
  const update = useDoc((s) => s.update);
  const caption = useDoc(s => heroCaptionText(s.doc, slot === 'cover'));
  const board = useDoc(s => s.doc.templateId === 'frontmatter-board');
  const captionKey = slot === 'cover' && !board ? 'coverCaption' : 'heroCaption';
  const placementKey=slot==='cover'&&!board?'coverCaptionPlacement':'heroCaptionPlacement';
  const placement=useDoc(s=>s.doc.design[placementKey]);
  const dimensions=heroCaptionPageDimensions(useDoc(s=>s.doc));
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const uploadRevision=useRef(0);
  const hidden=useDoc(s=>(slot==='hero'||slot==='cover')&&(s.doc.design.showHero===false||(slot==='hero'&&!(s.doc.design.heroHeight>0))));
  useEffect(()=>{
    setLoading(false);
    return ()=>{uploadRevision.current+=1;};
  },[slot]);

  const showImage=(doc:Doc)=>{
    if(slot!=='hero'&&slot!=='cover')return;
    doc.design.showHero=true;
    if(slot==='hero'&&!(doc.design.heroHeight>0))doc.design.heroHeight=95;
  };

  const setFrame = (d: Doc, f: Frame) => {
    if (slot === 'hero') d.hero = f;
    else if (slot === 'cover') d.cover = f;
    else if (slot === 'frontmatter-logo' || slot === 'frontmatter-signature') {
      d.frontMatter ??= emptyFrontMatter();
      if (slot === 'frontmatter-logo') d.frontMatter.logo = f;
      else {
        if (d.frontMatter.signature?.assetId !== f.assetId) delete d.frontMatter.signatureCrop;
        d.frontMatter.signature = f;
      }
    } else {
      d.backCover ??= emptyBackCover();
      d.backCover[slot === 'backcover-qr' ? 'qr' : 'logo'] = f;
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    const request=++uploadRevision.current;
    const expectedSession=currentDocumentSession();
    const expectedAsset=frameFor(useDoc.getState().doc,slot).assetId;
    try {
      const { src, naturalWidth, naturalHeight } = await loadImage(file);
      // Late uploads must not change a different document or replacement.
      const current = useDoc.getState().doc;
      if(request!==uploadRevision.current)return;
      if (currentDocumentSession()!==expectedSession||frameFor(current,slot).assetId!==expectedAsset) {
        setError('The document changed or its image was replaced while this image was loading. Please select the image again.');
        return;
      }
      update((d) => {
        const prev = frameFor(d, slot).assetId;
        const id = uid();
        d.assets[id] = { src, naturalWidth, naturalHeight };
        setFrame(d, { assetId: id, offsetX: 0, offsetY: 0, scale: 1 });
        showImage(d);
        if (prev && prev !== id && !assetIsReferenced(d, prev)) delete d.assets[prev];
      });
    } catch (e) {
      if(request===uploadRevision.current)setError(e instanceof ImageLoadError ? e.message : 'Failed to load image.');
    } finally {
      if(request===uploadRevision.current)setLoading(false);
    }
  };

  const removeImage = () =>
    update((d) => {
      const prev = frameFor(d, slot).assetId;
      setFrame(d, { assetId: null, offsetX: 0, offsetY: 0, scale: 1 });
      if (prev && !assetIsReferenced(d, prev)) delete d.assets[prev];
    });

  const setKey = (key: 'offsetX' | 'offsetY' | 'scale') => (v: number) =>
    update((d) => {
      const f: Frame = { ...EMPTY_FRAME, ...frameFor(d, slot) };
      f[key] = v;
      setFrame(d, f);
    });

  return (
    <Section title={title} editorTarget={slot === 'frontmatter-logo' ? 'image-logo' : slot === 'frontmatter-signature' ? 'image-signature' : `image-${slot}`}>
      {blurb && <p className="hint">{blurb}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        aria-label={`Choose ${title.toLowerCase()}`}
        hidden
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {hidden&&<p className="hint hint--warn" role="status">This image is hidden in the layout. Uploading a photo will show it.{' '}
        {asset&&<button type="button" className="add-btn" onClick={()=>update(showImage)}>Show image</button>}
      </p>}

      {asset ? (
        <>
          {renderPreview ? renderPreview(asset) : <div className="hero-thumb" style={{ aspectRatio: thumbAspectRatio ?? (slot === 'cover' ? '210 / 297' : slot === 'backcover-qr' ? '1 / 1' : '16 / 7') }}>
            <FramedImage asset={asset} frame={frame} fit={fit} />
          </div>}
          <div className="hero-actions">
            <button type="button" className="add-btn" disabled={loading} onClick={() => fileRef.current?.click()}>
              {loading ? <MagazooLoader variant="inline" label="Optimising image…" /> : 'Replace image'}
            </button>
            <button type="button" className="icon-btn icon-btn--danger" title="Remove image" disabled={loading} onClick={removeImage}>
              ✕
            </button>
          </div>

          {children}
          {(slot === 'hero' || slot === 'cover') && <>
            <LabeledTextarea label={slot === 'cover' && !board ? 'Cover image caption' : 'Hero image caption'}
              editorTarget={`meta-${captionKey === 'coverCaption' ? 'cover' : 'hero'}-caption`}
              rows={3} value={caption} placeholder="Describe this image; keep photo credits in the credit field."
              onChange={value => update(d => { d.meta[captionKey] = value; })} />
            {!caption.trim() && <p className="hint hint--warn" role="status">This image has no caption yet. Add a description before publishing.</p>}
            <p className="hint">Drag this caption anywhere on its page. Arrow keys move it by 1 mm; hold Shift for 5 mm. Its font controls remain in the top toolbar.</p>
            {placement&&<>
              <div className="image-boundary-coordinates">
                <LabeledNumber label="Caption X" unit="mm" min={0} max={dimensions.width} step={.5} value={placement.x} onChange={x=>update(d=>{d.design[placementKey]={...placement,x};})}/>
                <LabeledNumber label="Caption Y" unit="mm" min={0} max={dimensions.height} step={.5} value={placement.y} onChange={y=>update(d=>{d.design[placementKey]={...placement,y};})}/>
                <LabeledNumber label="Caption width" unit="mm" min={5} max={dimensions.width} step={.5} value={placement.widthMm} onChange={widthMm=>update(d=>{d.design[placementKey]={...placement,widthMm};})}/>
              </div>
              <button type="button" className="add-btn" onClick={()=>update(d=>{delete d.design[placementKey];})}>Reset caption position</button>
            </>}
          </>}
          {framing && <><LabeledRange label="Shift horizontally" value={frame.offsetX} min={-50} max={50} step={1} format={(v) => `${v}%`} onChange={setKey('offsetX')} />
          <LabeledRange label="Shift vertically" value={frame.offsetY} min={-50} max={50} step={1} format={(v) => `${v}%`} onChange={setKey('offsetY')} />
          <LabeledRange label="Zoom" value={frame.scale} min={0.5} max={3} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={setKey('scale')} />
          <p className="hint">{fit === 'contain' ? '1× shows the complete image; zoom above 1× only when you want a tighter logo crop.' : 'Below 1× reveals more of the image; 1× fills the frame.'}</p>
          <button
            type="button"
            className="add-btn"
            onClick={() => update((d) => setFrame(d, { ...frame, offsetX: 0, offsetY: 0, scale: 1 }))}
          >
            Reset image framing
          </button>
          </>}
        </>
      ) : (
        <button type="button" className="add-btn hero-upload" disabled={loading} onClick={() => fileRef.current?.click()}>
          {loading ? <MagazooLoader variant="inline" label="Optimising image…" /> : '+ Upload image'}
        </button>
      )}

      {error && (
        <p className="hint hint--warn" role="alert">
          {error}
        </p>
      )}
    </Section>
  );
}

export function HeroSection() {
  const templateId = useDoc((s) => s.doc.templateId ?? 'paper-1');
  const heroHeight = useDoc((s) => s.doc.design.heroHeight);
  const heroSide = useDoc((s) => s.doc.design.heroSide ?? (s.doc.design.textDirection === 'rtl' ? 'left' : 'right'));
  const columns = useDoc((s) => Math.max(2, Math.min(4, Math.round(s.doc.design.bodyCols))));
  const heroWidthCols = useDoc((s) => s.doc.design.heroWidthCols);
  const update = useDoc((s) => s.update);

  // magazine-3 is a gatefold: one cover photo split across both cover sheets, and
  // no article hero — so it shows only the cover picker.
  const isGate = templateId === 'magazine-3';
  // magazine-4 is a true one-sheet cover: it has a cover photo, but no second
  // article hero or hero-height control because there is no article page.
  const isCoverOnly = templateId === 'magazine-4';
  // magazine-1 splits the cover (page 1) from the hero (page 2, top).
  const hasCover = templateId === 'magazine-1' || isGate || isCoverOnly;

  return (
    <>
      {hasCover && (
        <ImagePicker
          slot="cover"
          title={isGate ? 'Gatefold Photo' : 'Cover Image'}
          blurb={isGate ? 'Split across both cover sheets (use a wide photo)' : isCoverOnly ? 'The full-bleed image on this one-page cover' : 'Page 1 · full-bleed cover'}
        />
      )}
      {!isGate && !isCoverOnly && (
        <>
          <ImagePicker slot="hero" title="Hero Image" blurb={hasCover ? 'Page 2 · photo above the article' : undefined} />
          <Section title="Hero layout" editorTarget="hero-layout">
            {(templateId === 'paper-2' || templateId === 'paper-8') && (
              <SegmentField<'left' | 'right'>
                label="Image side"
                value={heroSide}
                options={[
                  { value: 'left', label: 'Left' },
                  { value: 'right', label: 'Right' },
                ]}
                onChange={(heroSide) =>
                  update((d) => {
                    d.design.heroSide = heroSide;
                  })
                }
              />
            )}
            {templateId === 'paper-8' && <>
              <SegmentField<1 | 2 | 3>
                label="Image width"
                value={Math.max(1, Math.min(3, columns, heroWidthCols ?? columns - 1)) as 1 | 2 | 3}
                options={([1, 2, 3] as const).filter(value => value <= columns).map(value => ({
                  value, label: `${value} ${value === 1 ? 'column' : 'columns'}`,
                }))}
                onChange={value => update(d => { d.design.heroWidthCols = value; })}
              />
              <p className="hint">The image stays on the selected side, aligned to the text grid. Text flows below its caption; height and crop remain independent.</p>
            </>}
            <LabeledNumber
              label="Height"
              unit="mm"
              value={heroHeight}
              min={0}
              max={160}
              step={1}
              onChange={(v) =>
                update((d) => {
                  d.design.heroHeight = v;
                })
              }
            />
          </Section>
        </>
      )}
    </>
  );
}
