import { useRef, useState, type ReactNode } from 'react';
import { useDoc } from '../../store/useDoc';
import { assetIsReferenced, uid, type Doc, type Asset } from '../../schema/document';
import { loadImage, ImageLoadError } from '../../lib/loadImage';
import type { ImageFrame } from '../../lib/imageFrame';
import type { ImageFit } from '../../lib/imageFrame';
import { FramedImage } from '../../components/FramedImage';
import { LabeledNumber, LabeledRange, Section, SegmentField } from '../Field';
import { emptyFrontMatter } from '../../store/frontMatter';
import { emptyBackCover } from '../../store/backCover';
import { MagazooLoader } from '../../components/MagazooLoader';

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    const expectedDoc = useDoc.getState().doc;
    try {
      const { src, naturalWidth, naturalHeight } = await loadImage(file);
      // Late uploads must not change a different document or replacement.
      const current = useDoc.getState().doc;
      if (current !== expectedDoc) {
        setError('The document changed while the image was loading. Please select the image again.');
        return;
      }
      update((d) => {
        const prev = frameFor(d, slot).assetId;
        const id = uid();
        d.assets[id] = { src, naturalWidth, naturalHeight };
        setFrame(d, { assetId: id, offsetX: 0, offsetY: 0, scale: 1 });
        if (prev && prev !== id && !assetIsReferenced(d, prev)) delete d.assets[prev];
      });
    } catch (e) {
      setError(e instanceof ImageLoadError ? e.message : 'Failed to load image.');
    } finally {
      setLoading(false);
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
        hidden
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

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
            {templateId === 'paper-2' && (
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
