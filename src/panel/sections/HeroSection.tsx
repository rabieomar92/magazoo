import { useRef, useState } from 'react';
import { useDoc } from '../../store/useDoc';
import { uid, type Doc } from '../../schema/document';
import { loadImage, ImageLoadError } from '../../lib/loadImage';
import type { ImageFrame } from '../../lib/imageFrame';
import { FramedImage } from '../../components/FramedImage';
import { LabeledNumber, LabeledRange, Section } from '../Field';

type Frame = ImageFrame & { assetId: string | null };
const EMPTY_FRAME: Frame = { assetId: null, offsetX: 0, offsetY: 0, scale: 1 };

const assetStillUsed = (doc: Doc, assetId: string) =>
  doc.hero.assetId === assetId ||
  doc.cover?.assetId === assetId ||
  doc.design.pageBackgroundAssetId === assetId ||
  doc.blocks.some((block) => block.type === 'figure' && block.assetId === assetId) ||
  (doc.images ?? []).some((image) => image.assetId === assetId);

/** One uploadable, framable image bound to either `doc.hero` or `doc.cover`. */
function ImagePicker({ slot, title, blurb }: { slot: 'hero' | 'cover'; title: string; blurb?: string }) {
  const frame = useDoc((s) => (s.doc[slot] ?? EMPTY_FRAME) as Frame);
  const asset = useDoc((s) => {
    const f = (s.doc[slot] ?? EMPTY_FRAME) as Frame;
    return f.assetId ? s.doc.assets[f.assetId] : null;
  });
  const update = useDoc((s) => s.update);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setFrame = (d: Doc, f: Frame) => {
    if (slot === 'hero') d.hero = f;
    else d.cover = f;
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const { src, naturalWidth, naturalHeight } = await loadImage(file);
      update((d) => {
        const prev = (d[slot] as Frame | undefined)?.assetId ?? null;
        const id = uid();
        d.assets[id] = { src, naturalWidth, naturalHeight };
        setFrame(d, { assetId: id, offsetX: 0, offsetY: 0, scale: 1 });
        if (prev && prev !== id && !assetStillUsed(d, prev)) delete d.assets[prev];
      });
    } catch (e) {
      setError(e instanceof ImageLoadError ? e.message : 'Failed to load image.');
    } finally {
      setLoading(false);
    }
  };

  const removeImage = () =>
    update((d) => {
      const prev = (d[slot] as Frame | undefined)?.assetId ?? null;
      setFrame(d, { assetId: null, offsetX: 0, offsetY: 0, scale: 1 });
      if (prev && !assetStillUsed(d, prev)) delete d.assets[prev];
    });

  const setKey = (key: 'offsetX' | 'offsetY' | 'scale') => (v: number) =>
    update((d) => {
      const f: Frame = { ...EMPTY_FRAME, ...(d[slot] as Frame | undefined) };
      f[key] = v;
      setFrame(d, f);
    });

  return (
    <Section title={title}>
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
          <div className="hero-thumb" style={{ aspectRatio: slot === 'cover' ? '210 / 297' : '16 / 7' }}>
            <FramedImage asset={asset} frame={frame} />
          </div>
          <div className="hero-actions">
            <button type="button" className="add-btn" disabled={loading} onClick={() => fileRef.current?.click()}>
              {loading ? 'Optimising image…' : 'Replace image'}
            </button>
            <button type="button" className="icon-btn icon-btn--danger" title="Remove image" onClick={removeImage}>
              ✕
            </button>
          </div>

          <LabeledRange label="Shift horizontally" value={frame.offsetX} min={-50} max={50} step={1} format={(v) => `${v}%`} onChange={setKey('offsetX')} />
          <LabeledRange label="Shift vertically" value={frame.offsetY} min={-50} max={50} step={1} format={(v) => `${v}%`} onChange={setKey('offsetY')} />
          <LabeledRange label="Zoom" value={frame.scale} min={0.5} max={3} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={setKey('scale')} />
          <p className="hint">Below 1× reveals more of the image; 1× fills the frame.</p>
          <button
            type="button"
            className="add-btn"
            onClick={() => update((d) => setFrame(d, { ...frame, offsetX: 0, offsetY: 0, scale: 1 }))}
          >
            Reset image framing
          </button>
        </>
      ) : (
        <button type="button" className="add-btn hero-upload" disabled={loading} onClick={() => fileRef.current?.click()}>
          {loading ? 'Optimising image…' : '+ Upload image'}
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
          <Section title="Hero height">
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
