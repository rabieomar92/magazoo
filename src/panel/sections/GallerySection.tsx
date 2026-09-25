import { useRef, useState } from 'react';
import { useDoc } from '../../store/useDoc';
import { assetIsReferenced, uid } from '../../schema/document';
import { galleryFrameGeometry } from '../../lib/galleryFrame';
import { ensureGalleryFigure, galleryImageTarget, GALLERY_TWO_SLOTS } from '../../lib/gallerySlots';
import { ImageLoadError, loadImage } from '../../lib/loadImage';
import { LabeledColor, LabeledRange, Section } from '../Field';
import { editorTargetId } from '../../lib/editorNavigation';
import { splitCaption, joinCaption } from '../../lib/galleryCaption';
import { MagazooLoader } from '../../components/MagazooLoader';

const DEFAULT_FRAME = { scale: 1, offsetX: 0, offsetY: 0 };

/** Per-template image slots and the shared fold. An explicit slot preserves
 *  original figure ordinals when a layout combines older image positions. */
type Layout = { fold: number; slots: { label: string; hint: string; slot?: number }[] };
const LAYOUTS: Record<string, Layout> = {
  'gallery-1': {
    fold: 1,
    slots: [
      { label: 'Image 1', hint: 'Page 1 · top-left' },
      { label: 'Image 2', hint: 'Fold · spans page 1 → page 2' },
      { label: 'Image 3', hint: 'Page 1 · bottom-right' },
      { label: 'Image 4', hint: 'Page 2 · mid-right' },
      { label: 'Image 5', hint: 'Page 2 · bottom-left' },
    ],
  },
  'gallery-2': {
    fold: GALLERY_TWO_SLOTS.fold,
    slots: [
      { label: 'Image 1', hint: 'Fold · vertical, spans page 1 → page 2', slot: GALLERY_TWO_SLOTS.fold },
      { label: 'Image 2', hint: 'Page 1 · tall upper-left', slot: GALLERY_TWO_SLOTS.leftTall },
      { label: 'Image 3', hint: 'Page 1 · bottom-left', slot: GALLERY_TWO_SLOTS.leftBottom },
      { label: 'Image 4', hint: 'Page 2 · tall upper-right', slot: GALLERY_TWO_SLOTS.rightTall },
      { label: 'Image 5', hint: 'Page 2 · bottom-right', slot: GALLERY_TWO_SLOTS.rightBottom },
    ],
  },
  'gallery-3': {
    fold: 0,
    slots: [
      { label: 'Image 1', hint: 'Fold · horizontal band, spans page 1 → page 2' },
      { label: 'Image 2', hint: 'Page 1 · top-left' },
      { label: 'Image 3', hint: 'Page 1 · top-right' },
      { label: 'Image 4', hint: 'Page 1 · lower-left' },
      { label: 'Image 5', hint: 'Page 1 · lower-right' },
      { label: 'Image 6', hint: 'Page 2 · top-left' },
      { label: 'Image 7', hint: 'Page 2 · top-right' },
      { label: 'Image 8', hint: 'Page 2 · right (tall)' },
    ],
  },
  'gallery-4': {
    fold: 0,
    slots: [
      { label: 'Image 1', hint: 'Fold · tall block, spans page 1 → page 2' },
      { label: 'Image 2', hint: 'Page 1 · lower-left' },
      { label: 'Image 3', hint: 'Page 1 · lower-right' },
      { label: 'Image 4', hint: 'Page 2 · lower-left' },
      { label: 'Image 5', hint: 'Page 2 · lower-right' },
    ],
  },
};


export function GallerySection() {
  const blocks = useDoc((s) => s.doc.blocks);
  const assets = useDoc((s) => s.doc.assets);
  const paperBg = useDoc((s) => s.doc.design.paperBg ?? '#ffffff');
  const templateId = useDoc((s) => s.doc.templateId ?? 'gallery-1');
  const update = useDoc((s) => s.update);
  const [imageError, setImageError] = useState<string | null>(null);
  const [loadingSlot, setLoadingSlot] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<number | null>(null);

  const layout = LAYOUTS[templateId] ?? LAYOUTS['gallery-1'];
  const SLOTS = layout.slots;
  const FOLD_SLOT = layout.fold;

  const setPaperBg = (v: string) =>
    update((d) => {
      d.design.paperBg = v;
    });

  // The block index of each figure, in order → figIndex[n] is slot n's block.
  const figIndex = blocks.reduce<number[]>((acc, b, i) => {
    if (b.type === 'figure') acc.push(i);
    return acc;
  }, []);

  const previousPhotos = templateId === 'gallery-2' ? [
    { slot: GALLERY_TWO_SLOTS.leftPrevious, target: GALLERY_TWO_SLOTS.leftTall, side: 'left' },
    { slot: GALLERY_TWO_SLOTS.rightPrevious, target: GALLERY_TWO_SLOTS.rightTall, side: 'right' },
  ].filter(({ slot }) => {
    const block = blocks[figIndex[slot]];
    return block?.type === 'figure' && (!!block.assetId || !!block.caption.trim());
  }) : [];

  const chooseImage = (slot: number) => {
    pendingSlot.current = slot;
    fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    const slot = pendingSlot.current;
    pendingSlot.current = null;
    if (!file || slot === null) return;
    const uploadDoc = useDoc.getState().doc;
    setImageError(null);
    setLoadingSlot(slot);
    try {
      const loaded = await loadImage(file);
      if (useDoc.getState().doc !== uploadDoc) {
        setImageError('The document changed while loading the image. Please upload it again to the chosen slot.');
        return;
      }
      update((d) => {
        const aid = uid();
        d.assets[aid] = loaded;
        const block = ensureGalleryFigure(d, slot);
        const old = block.assetId;
        block.assetId = aid;
        if (old && !assetIsReferenced(d, old)) delete d.assets[old];
      });
    } catch (error) {
      setImageError(error instanceof ImageLoadError ? error.message : 'Failed to load image.');
    } finally {
      setLoadingSlot(null);
    }
  };

  const setCaption = (blockIdx: number, caption: string) =>
    update((d) => {
      const b = d.blocks[blockIdx];
      if (b.type === 'figure') b.caption = caption;
    });

  const setFrame = (blockIdx: number, key: 'scale' | 'offsetX' | 'offsetY') => (v: number) =>
    update((d) => {
      const b = d.blocks[blockIdx];
      if (b.type !== 'figure') return;
      b.frame = { ...DEFAULT_FRAME, ...b.frame, [key]: v };
    });

  return (
    <Section title="Gallery images">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void onFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <LabeledColor label="Paper background" value={paperBg} onChange={setPaperBg} />
      <p className="gallery-slot-hint">Text flips to black on light sheets, white on dark.</p>
      <p className="gallery-slot-hint">Upload to any image slot in any order. Other empty slots can stay empty.</p>
      {imageError && <p className="hint hint--warn" role="alert">{imageError}</p>}
      {SLOTS.map((s, index) => {
        const n = s.slot ?? index;
        const bi = figIndex[n];
        const block = bi === undefined ? undefined : blocks[bi];
        const asset = block && block.type === 'figure' ? assets[block.assetId] : undefined;
        const caption = block && block.type === 'figure' ? block.caption : '';
        const { title, desc } = splitCaption(caption);
        const frame = (block && block.type === 'figure' && block.frame) || DEFAULT_FRAME;
        const frameGeometry = galleryFrameGeometry(frame);
        const canEditCaption = bi !== undefined && (!!asset || !!caption);
        const canFrame = bi !== undefined && !!asset;
        const isFold = n === FOLD_SLOT;
        return (
          <div
            className="gallery-slot"
            id={editorTargetId(galleryImageTarget(block, n))}
            key={s.label}
          >
            <div className="gallery-slot-head">
              <span className="gallery-slot-label">{s.label}</span>
              <span className="gallery-slot-hint">{s.hint}</span>
            </div>
            <div className="figure-thumb gallery-slot-thumb">
              {asset ? (
                <img
                  src={asset.src}
                  alt=""
                  style={{
                    position: 'absolute',
                    width: `${frameGeometry.width}%`,
                    height: `${frameGeometry.height}%`,
                    left: `${frameGeometry.left}%`,
                    top: `${frameGeometry.top}%`,
                    objectFit: frameGeometry.objectFit,
                    objectPosition: `${frameGeometry.objectX}% ${frameGeometry.objectY}%`,
                  }}
                />
              ) : (
                <span className="figure-missing">No image</span>
              )}
            </div>
            <button
              type="button"
              className="add-btn"
              disabled={loadingSlot !== null}
              onClick={() => chooseImage(n)}
            >
              {loadingSlot === n ? <MagazooLoader variant="inline" label="Optimising image…" /> : asset ? 'Replace image' : `Upload ${s.label}`}
            </button>
            {canEditCaption && (
              <>
                <input
                  className="field-input"
                  dir="auto"
                  value={title}
                  placeholder="Title (bold)…"
                  onChange={(e) => setCaption(bi, joinCaption(e.target.value, desc))}
                />
                <textarea
                  className="field-input field-textarea"
                  dir="auto"
                  value={desc}
                  rows={2}
                  placeholder="Description…"
                  onChange={(e) => setCaption(bi, joinCaption(title, e.target.value))}
                />
              </>
            )}
            {canFrame && (
              <>
                <LabeledRange label="Zoom" value={frame.scale} min={0.5} max={3} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={setFrame(bi, 'scale')} />
                <LabeledRange label="Shift horizontally" value={frame.offsetX} min={-50} max={50} step={1} format={(v) => `${v}%`} onChange={setFrame(bi, 'offsetX')} />
                <LabeledRange label="Shift vertically" value={frame.offsetY} min={-50} max={50} step={1} format={(v) => `${v}%`} onChange={setFrame(bi, 'offsetY')} />
                <p className="gallery-slot-hint">Below 1× reveals more of the image; 1× fills the tile.</p>
                <button
                  type="button"
                  className="add-btn"
                  onClick={() =>
                    update((d) => {
                      const current = d.blocks[bi];
                      if (current?.type === 'figure') current.frame = { ...DEFAULT_FRAME };
                    })
                  }
                >
                  Reset image framing
                </button>
              </>
            )}
            {isFold && (
              <p className="gallery-slot-hint">Zoom &amp; shift stay in sync across the fold.</p>
            )}
          </div>
        );
      })}
      {previousPhotos.length > 0 && <details className="gallery-previous-photos">
        <summary>Previous side photos ({previousPhotos.length})</summary>
        <p className="gallery-slot-hint">These photos are still saved, but are not printed in Gallery 2. Swap one into the tall slot to use it; the current tall photo is kept here instead.</p>
        {previousPhotos.map(({ slot, target, side }) => {
          const block = blocks[figIndex[slot]];
          if (block?.type !== 'figure') return null;
          const asset = assets[block.assetId];
          return <div className="gallery-slot" key={slot}>
            <span className="gallery-slot-label">Previous {side} middle photo</span>
            <div className="figure-thumb gallery-slot-thumb">{asset ? <img src={asset.src} alt={`Previous ${side} middle photo`} /> : <span className="figure-missing">No image</span>}</div>
            {block.caption && <p className="gallery-slot-hint">{block.caption}</p>}
            <button type="button" className="add-btn" disabled={!asset || loadingSlot !== null} onClick={() => update(d => {
              const previous = ensureGalleryFigure(d, slot);
              const current = ensureGalleryFigure(d, target);
              const previousIndex = d.blocks.indexOf(previous);
              const currentIndex = d.blocks.indexOf(current);
              d.blocks[currentIndex] = { ...previous, id: current.id };
              d.blocks[previousIndex] = { ...current, id: previous.id };
            })}>Use in {side} tall photo</button>
          </div>;
        })}
      </details>}
    </Section>
  );
}
