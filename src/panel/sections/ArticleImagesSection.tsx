import { useRef, useState } from 'react';
import { grid } from '../../lib/geometry';
import { loadImage, ImageLoadError } from '../../lib/loadImage';
import { placedImageGeometry } from '../../lib/placedImage';
import { assetIsReferenced, uid, type Doc, type PlacedImage } from '../../schema/document';
import { useDoc } from '../../store/useDoc';
import { LabeledNumber, LabeledRange, RowButtons, Section, SegmentField } from '../Field';

const DEFAULT_FRAME = { scale: 1, offsetX: 0, offsetY: 0 };

export function ArticleImagesSection() {
  const images = useDoc((state) => state.doc.images ?? []);
  const assets = useDoc((state) => state.doc.assets);
  const design = useDoc((state) => state.doc.design);
  const update = useDoc((state) => state.update);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingReplace = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const maxWidth = Math.min(4, grid(design).totalCols);
  const widthOptions = Array.from({ length: maxWidth }, (_, index) => ({
    value: (index + 1) as PlacedImage['widthCols'],
    label: `${index + 1} col`,
  }));

  const chooseFile = (replaceId?: string) => {
    pendingReplace.current = replaceId ?? null;
    fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const loaded = await loadImage(file);
      update((doc) => {
        const assetId = uid();
        doc.assets[assetId] = loaded;
        doc.images ??= [];
        const replaceId = pendingReplace.current;
        const existing = replaceId
          ? doc.images.find((image) => image.id === replaceId)
          : undefined;
        if (existing) {
          const oldAssetId = existing.assetId;
          existing.assetId = assetId;
          const geometry = placedImageGeometry(existing, loaded, doc.design);
          existing.anchor.column = geometry.column;
          existing.anchor.y = geometry.top;
          if (!assetIsReferenced(doc, oldAssetId)) delete doc.assets[oldAssetId];
        } else {
          const widthCols = Math.min(2, grid(doc.design).totalCols) as PlacedImage['widthCols'];
          const image: PlacedImage = {
            id: uid(),
            assetId,
            caption: '',
            widthCols,
            anchor: { page: 1, column: 0, y: doc.design.margin + doc.images.length * 12 },
            align: 'left',
          };
          image.anchor.y = placedImageGeometry(image, loaded, doc.design).top;
          doc.images.push(image);
        }
      });
    } catch (cause) {
      setError(cause instanceof ImageLoadError ? cause.message : 'Failed to load image.');
    } finally {
      pendingReplace.current = null;
      setLoading(false);
    }
  };

  const change = (id: string, fn: (image: PlacedImage, doc: Doc) => void) =>
    update((doc) => {
      const image = (doc.images ?? []).find((candidate) => candidate.id === id);
      if (image) fn(image, doc);
    });

  const remove = (id: string) =>
    update((doc) => {
      const index = (doc.images ?? []).findIndex((image) => image.id === id);
      if (index < 0) return;
      const [removed] = doc.images.splice(index, 1);
      if (!assetIsReferenced(doc, removed.assetId)) delete doc.assets[removed.assetId];
    });

  return (
    <Section title="Page images">
      <p className="hint">
        Images sit independently on the page. Drag one in the preview: its left edge snaps to a
        column while its vertical position remains free.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        aria-label="Choose page image"
        onChange={(event) => {
          void onFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      {images.map((image) => {
        const asset = assets[image.assetId];
        const selectedWidth = Math.min(image.widthCols, maxWidth) as PlacedImage['widthCols'];
        return (
          <div className="list-item list-item--stack" key={image.id}>
            <div className="figure-edit">
              <div className="figure-thumb">
                {asset ? <img src={asset.src} alt="" /> : <span className="figure-missing">Image missing</span>}
              </div>
              <input
                className="field-input"
                dir="auto"
                value={image.caption}
                placeholder="Image caption…"
                onChange={(event) => change(image.id, (current) => { current.caption = event.target.value; })}
              />
              <SegmentField<PlacedImage['widthCols']>
                label="Width"
                value={selectedWidth}
                options={widthOptions}
                onChange={(widthCols) =>
                  change(image.id, (current, doc) => {
                    current.widthCols = widthCols;
                    const currentAsset = doc.assets[current.assetId];
                    if (!currentAsset) return;
                    const geometry = placedImageGeometry(current, currentAsset, doc.design);
                    current.anchor.column = geometry.column;
                    current.anchor.y = geometry.top;
                  })
                }
              />
              <LabeledNumber
                label="Page"
                value={image.anchor.page}
                min={1}
                max={99}
                onChange={(page) =>
                  change(image.id, (current) => {
                    current.anchor.page = Math.min(99, Math.max(1, Math.round(page)));
                  })
                }
              />
              <SegmentField<'left' | 'center' | 'right'>
                label="Caption align"
                value={image.align ?? 'left'}
                options={[
                  { value: 'left', label: 'Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'right', label: 'Right' },
                ]}
                onChange={(align) => change(image.id, (current) => { current.align = align; })}
              />
              <LabeledRange
                label="Image zoom"
                value={image.frame?.scale ?? 1}
                min={0.5}
                max={3}
                step={0.05}
                format={(value) => `${value.toFixed(2)}×`}
                onChange={(scale) =>
                  change(image.id, (current) => {
                    current.frame = { ...DEFAULT_FRAME, ...current.frame, scale };
                  })
                }
              />
              <LabeledRange
                label="Image shift horizontally"
                value={image.frame?.offsetX ?? 0}
                min={-50}
                max={50}
                step={1}
                format={(value) => `${value}%`}
                onChange={(offsetX) =>
                  change(image.id, (current) => {
                    current.frame = { ...DEFAULT_FRAME, ...current.frame, offsetX };
                  })
                }
              />
              <LabeledRange
                label="Image shift vertically"
                value={image.frame?.offsetY ?? 0}
                min={-50}
                max={50}
                step={1}
                format={(value) => `${value}%`}
                onChange={(offsetY) =>
                  change(image.id, (current) => {
                    current.frame = { ...DEFAULT_FRAME, ...current.frame, offsetY };
                  })
                }
              />
              <button
                type="button"
                className="add-btn"
                onClick={() => change(image.id, (current) => { current.frame = { ...DEFAULT_FRAME }; })}
              >
                Reset image framing
              </button>
              <SegmentField<'none' | 'left' | 'right' | 'both'>
                label="Horizontal bleed"
                value={
                  image.bleed?.left && image.bleed?.right
                    ? 'both'
                    : image.bleed?.left
                      ? 'left'
                      : image.bleed?.right
                        ? 'right'
                        : 'none'
                }
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'left', label: 'Left' },
                  { value: 'right', label: 'Right' },
                  { value: 'both', label: 'Both' },
                ]}
                onChange={(value) =>
                  change(image.id, (current) => {
                    current.bleed = {
                      ...current.bleed,
                      left: value === 'left' || value === 'both',
                      right: value === 'right' || value === 'both',
                    };
                  })
                }
              />
              <SegmentField<'none' | 'top' | 'bottom' | 'both'>
                label="Vertical bleed"
                value={
                  image.bleed?.top && image.bleed?.bottom
                    ? 'both'
                    : image.bleed?.top
                      ? 'top'
                      : image.bleed?.bottom
                        ? 'bottom'
                        : 'none'
                }
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'top', label: 'Top' },
                  { value: 'bottom', label: 'Bottom' },
                  { value: 'both', label: 'Both' },
                ]}
                onChange={(value) =>
                  change(image.id, (current) => {
                    current.bleed = {
                      ...current.bleed,
                      top: value === 'top' || value === 'both',
                      bottom: value === 'bottom' || value === 'both',
                    };
                  })
                }
              />
              {(image.bleed?.bottom || image.bleed?.left || image.bleed?.right) && (
                <p className="hint">Bleed crops the artwork; the caption remains on the selected columns.</p>
              )}
              <button type="button" className="add-btn" disabled={loading} onClick={() => chooseFile(image.id)}>
                {loading && pendingReplace.current === image.id ? 'Optimising image…' : 'Replace image'}
              </button>
            </div>
            <RowButtons onRemove={() => remove(image.id)} />
          </div>
        );
      })}

      <button type="button" className="add-btn hero-upload" disabled={loading} onClick={() => chooseFile()}>
        {loading && pendingReplace.current === null ? 'Optimising image…' : '+ Add page image'}
      </button>
      {error && <p className="hint hint--warn" role="alert">{error}</p>}
    </Section>
  );
}
