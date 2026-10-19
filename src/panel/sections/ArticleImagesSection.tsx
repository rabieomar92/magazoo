import { useRef, useState } from 'react';
import { grid, PAGE_H } from '../../lib/geometry';
import { isReferenceArticle, articleGridDesign, articlePageHeight, articleGeometry, type ReferenceArticleId } from '../../lib/articleLayouts';
import { loadImage, ImageLoadError } from '../../lib/loadImage';
import {
  MAX_COMBINED_CONTOUR_INSET,
  MAX_CONTOUR_INSET,
  placedImageContour,
  placedImageGeometry,
} from '../../lib/placedImage';
import { assetIsReferenced, uid, type Doc, type PlacedImage } from '../../schema/document';
import { useDoc } from '../../store/useDoc';
import { editorTargetId } from '../../lib/editorNavigation';
import { LabeledNumber, LabeledRange, RowButtons, Section, SegmentField } from '../Field';
import { MagazooLoader } from '../../components/MagazooLoader';
import { TypographyControl } from '../TypographyToolbar';
import { FreeformImageEditor } from '../FreeformImageEditor';
import { wrappedHeroImage } from '../../lib/wrappedHero';
import { pageDimensions } from '../../lib/pageFormat';
import {requestImageOutline} from '../../lib/imageCanvas';
import {ImagePanControls,ImagePanPreview} from '../ImagePanControls';
import {FramedImage} from '../../components/FramedImage';
import {usePdfPreferences} from '../../store/pdfPreferences';
import {ImageDeck} from '../ImageDeck';
import {linkSpreadPhotos,linkedPair} from '../../lib/linkedSpread';

const DEFAULT_FRAME = { scale: 1, offsetX: 0, offsetY: 0 };
const imageDesign = (doc: Doc) => isReferenceArticle(doc.templateId) ? articleGridDesign(doc.design) : doc.design;
const imageGeometry = (image: PlacedImage, asset: Doc['assets'][string], doc: Doc) =>
  placedImageGeometry(image, asset, imageDesign(doc), isReferenceArticle(doc.templateId) ? articlePageHeight(doc.design) : undefined);

const contourSliceLabel = (index: number, count: number) => {
  if (count === 1) return 'Image column';
  if (index === 0) return 'Left image column';
  if (index === count - 1) return 'Right image column';
  return `Image column ${index + 1}`;
};

function setContourInset(
  image: PlacedImage,
  edge: 'top' | 'bottom',
  index: number,
  value: number,
) {
  const slices = placedImageContour(image);
  const other = edge === 'top' ? slices[index].bottom : slices[index].top;
  const next = Math.max(
    0,
    Math.min(MAX_CONTOUR_INSET, MAX_COMBINED_CONTOUR_INSET - other, value),
  );
  image.wrapContour = {
    top: slices.map((slice, sliceIndex) =>
      edge === 'top' && sliceIndex === index ? next : slice.top,
    ),
    bottom: slices.map((slice, sliceIndex) =>
      edge === 'bottom' && sliceIndex === index ? next : slice.bottom,
    ),
  };
}

export function ArticleImagesSection() {
  const images = useDoc((state) => state.doc.images ?? []);
  const assets = useDoc((state) => state.doc.assets);
  const sourceDoc = useDoc((state) => state.doc);
  const pdfSize=usePdfPreferences(s=>s.size);
  const previewDoc={...sourceDoc,design:{...sourceDoc.design,pageFormat:pdfSize}};
  const design = imageDesign(sourceDoc);
  const update = useDoc((state) => state.update);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingReplace = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const maxWidth = Math.min(4, grid(design).totalCols);
  const pageHeight = isReferenceArticle(sourceDoc.templateId) ? articlePageHeight(design) : PAGE_H;
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
          const geometry = imageGeometry(existing, loaded, doc);
          existing.anchor.column = geometry.column;
          existing.anchor.y = geometry.top;
          if (!assetIsReferenced(doc, oldAssetId)) delete doc.assets[oldAssetId];
        } else {
          const widthCols = Math.min(2, grid(imageDesign(doc)).totalCols) as PlacedImage['widthCols'];
          const image: PlacedImage = {
            id: uid(),
            assetId,
            caption: '',
            widthCols,
            anchor: { page: 1, column: 0, y: doc.design.margin + doc.images.length * 12 },
            align: 'left',
          };
          if (isReferenceArticle(doc.templateId)) {
            // Start independent art in the copy area, not over the lead photo.
            const g = articleGeometry(doc.templateId as ReferenceArticleId, doc.design);
            image.anchor.y = g.bodyTop;
          }
          image.anchor.y = imageGeometry(image, loaded, doc).top;
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
      {sourceDoc.hero.assetId && sourceDoc.assets[sourceDoc.hero.assetId] && sourceDoc.design.showHero !== false && <>
        <button type="button" className="add-btn" onClick={()=>update(doc=>{
          const image = wrappedHeroImage(doc,uid());
          if (!image) return;
          doc.images ??= [];
          doc.images.push(image);
          doc.design.showHero = false;
        })}>Use hero as a wrapped page image</button>
        <p className="hint">Moves a copy of the hero into the text area, ready to outline and position. Its original image and caption are retained; Undo restores the hero layout.</p>
      </>}
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

      <ImageDeck label="Page image" names={images.map((image,index)=>`${index+1} · Page ${image.anchor.page}${image.caption?' · '+image.caption.slice(0,45):''}`)}>{images.map((image) => {
        const asset = assets[image.assetId];
        const selectedWidth = Math.min(image.widthCols, maxWidth) as PlacedImage['widthCols'];
        const contour = placedImageContour({ ...image, widthCols: selectedWidth });
        const height = asset ? imageGeometry(image, asset, sourceDoc).height : image.heightMm ?? 1;
        const previewGeometry=asset?imageGeometry(image,asset,previewDoc):null;
        const changeHeight = (heightMm: number) => change(image.id, (current, doc) => {
          current.heightMm = heightMm;
          const currentAsset = doc.assets[current.assetId];
          if (currentAsset) current.anchor.y = imageGeometry(current, currentAsset, doc).top;
        });
        return (
          <div
            className="list-item list-item--stack"
            id={editorTargetId(`article-image-${image.id}`)}
            key={image.id}
          >
            <div className="image-card-heading"><span>Page image {images.indexOf(image)+1}</span><RowButtons onRemove={() => remove(image.id)} /></div>
            <label className="field"><span className="field-label">Facing-page photograph</span>
              <select className="field-input" aria-label={`Link page image ${images.indexOf(image)+1} into a spread`} value={linkedPair(sourceDoc,image)?.find(i=>i.id!==image.id)?.id??''} onChange={event=>update(doc=>{
                if(event.target.value)linkSpreadPhotos(doc,image.id,event.target.value,imageDesign(doc),uid());
                else {const link=doc.images.find(i=>i.id===image.id)?.spreadLink;doc.images.forEach(i=>{if(link&&i.spreadLink===link)delete i.spreadLink;});}
              })}>
                <option value="">Independent photograph</option>
                {images.filter(other=>other.id!==image.id&&Math.abs(other.anchor.page-image.anchor.page)===1).map(other=><option key={other.id} value={other.id}>Link to image {images.indexOf(other)+1} · page {other.anchor.page}</option>)}
              </select>
            </label>
            <p className="hint">Linked frames share one photograph and pan/zoom. Captions stay independent. Pages must face each other in the compiled issue.</p>
            <div className="figure-edit">
              {asset ? <ImagePanPreview key={image.assetId} label={`Page image ${images.indexOf(image)+1} crop preview`} frame={image.frame}
                aspectRatio={previewGeometry!.visualWidth/previewGeometry!.visualHeight} background={sourceDoc.design.paperBg}
                onChange={pan=>change(image.id,current=>{current.frame={...DEFAULT_FRAME,...current.frame,...pan};})}>
                {preview=><FramedImage asset={asset} frame={preview}/>}
              </ImagePanPreview> : <span className="figure-missing">Image missing</span>}
              <input
                className="field-input"
                dir="auto"
                value={image.caption}
                placeholder="Image caption…"
                aria-label={`Page image ${images.indexOf(image)+1} caption`}
                id={`editor-target-article-caption-${image.id}`}
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
                    const geometry = imageGeometry(current, currentAsset, doc);
                    current.anchor.column = geometry.column;
                    current.anchor.y = geometry.top;
                  })
                }
              />
              <LabeledNumber
                label="Image height"
                unit="mm"
                value={Math.round(height * 10) / 10}
                min={1}
                max={pageHeight}
                step={0.1}
                onChange={changeHeight}
              />
              <details className="control-disclosure"><summary>Fine size adjustment</summary><LabeledRange
                label="Adjust image height"
                value={height}
                min={1}
                max={pageHeight}
                step={0.5}
                format={(value) => `${value.toFixed(1)} mm`}
                onChange={changeHeight}
              />
              <button
                type="button"
                className="add-btn"
                disabled={image.heightMm === undefined}
                onClick={() => change(image.id, (current, doc) => {
                  delete current.heightMm;
                  const currentAsset = doc.assets[current.assetId];
                  if (currentAsset) current.anchor.y = imageGeometry(current, currentAsset, doc).top;
                })}
              >
                Use original proportions
              </button>
              <p className="hint">Height changes the frame without stretching the photo. Use zoom and image shift to adjust the crop. Vertical bleed still extends the frame to the selected page edge.</p>
              </details>
              <details className="control-disclosure"><summary>Position & caption</summary>
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
              <TypographyControl group={`image-caption:${image.id}`} label={`Image ${images.indexOf(image) + 1} caption`} property="align">
              <SegmentField<'left' | 'center' | 'right'>
                label="Caption align"
                value={image.align ?? 'left'}
                options={[
                  { value: 'left', label: 'Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'right', label: 'Right' },
                ]}
                onChange={(align) => update(doc => {
                  const current=doc.images.find(item=>item.id===image.id);
                  if(current)current.align=align;
                  doc.design.textStyles??={};
                  const key=`image-caption:${image.id}`;
                  doc.design.textStyles[key]={...doc.design.textStyles[key],align};
                })}
              />
              </TypographyControl>
              <SegmentField<'attached'|'free'> label="Caption position" value={image.captionPlacement?'free':'attached'}
                options={[{value:'attached',label:'Automatic'},{value:'free',label:'Free position'}]}
                onChange={value=>change(image.id,current=>{
                  if(value==='attached')delete current.captionPlacement;
                  else {const g=asset?imageGeometry(current,asset,sourceDoc):null;
                    current.captionPlacement={x:g?.left??design.margin,y:g?g.visualTop+g.visualHeight+1:design.margin,widthMm:g?.width??40};}
                })}/>
              {image.captionPlacement&&<div className="image-boundary-coordinates">
                <LabeledNumber label="Caption X" unit="mm" value={image.captionPlacement.x} min={0} max={pageDimensions(design).width} step={.5}
                  onChange={v=>change(image.id,current=>{current.captionPlacement!.x=v;})}/>
                <LabeledNumber label="Caption Y" unit="mm" value={image.captionPlacement.y} min={0} max={pageHeight} step={.5}
                  onChange={v=>change(image.id,current=>{current.captionPlacement!.y=v;})}/>
                <LabeledNumber label="Caption width" unit="mm" value={image.captionPlacement.widthMm} min={5} max={pageDimensions(design).width} step={.5}
                  onChange={v=>change(image.id,current=>{current.captionPlacement!.widthMm=v;})}/>
              </div>}
              <p className="hint">Drag the caption anywhere on the page, including inside the image frame or beside its wrap outline. Drag either side handle to resize its width. Body text flows around the caption box.</p>
              </details>
              <details className="control-disclosure"><summary>Text wrapping & outline</summary>
              <SegmentField<'box' | 'contour' | 'polygon'>
                label="Text wrap shape"
                value={image.wrapShape ?? 'box'}
                options={[
                  { value: 'box', label: 'Box' },
                  { value: 'contour', label: 'Custom contour' },
                  { value: 'polygon', label: 'Polygon points' },
                ]}
                onChange={(wrapShape) => wrapShape==='polygon'?requestImageOutline(image.id):change(image.id, (current) => { current.wrapShape = wrapShape; })}
              />
              {image.wrapShape === 'polygon' && asset && <FreeformImageEditor image={image}/>}
              {image.wrapShape === 'contour' && (
                <div className="contour-wrap-editor">
                  <p className="hint">
                    Open transparent space above or below each part of the image. The picture is clipped to the same contour, while paragraph order and column filling stay unchanged.
                  </p>
                  {contour.map((slice, index) => (
                    <div className="contour-wrap-slice" key={index}>
                      <p className="group-label">{contourSliceLabel(index, contour.length)}</p>
                      <LabeledRange
                        label="Top opening"
                        value={slice.top}
                        min={0}
                        max={Math.min(MAX_CONTOUR_INSET, MAX_COMBINED_CONTOUR_INSET - slice.bottom)}
                        step={1}
                        format={(value) => `${Math.round(value)}%`}
                        onChange={(value) => change(image.id, (current) => setContourInset(current, 'top', index, value))}
                      />
                      <LabeledRange
                        label="Bottom opening"
                        value={slice.bottom}
                        min={0}
                        max={Math.min(MAX_CONTOUR_INSET, MAX_COMBINED_CONTOUR_INSET - slice.top)}
                        step={1}
                        format={(value) => `${Math.round(value)}%`}
                        onChange={(value) => change(image.id, (current) => setContourInset(current, 'bottom', index, value))}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="add-btn"
                    onClick={() => change(image.id, (current) => {
                      current.wrapContour = {
                        top: Array.from({ length: current.widthCols }, () => 0),
                        bottom: Array.from({ length: current.widthCols }, () => 0),
                      };
                    })}
                  >
                    Reset contour
                  </button>
                </div>
              )}
              </details>
              <details className="control-disclosure"><summary>Crop & framing</summary>
              <ImagePanControls frame={image.frame} onChange={pan=>change(image.id,current=>{current.frame={...DEFAULT_FRAME,...current.frame,...pan};})}/>
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
              </details>
              <details className="control-disclosure"><summary>Bleed to page edges</summary>
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
              </details>
              <button type="button" className="add-btn" disabled={loading} onClick={() => chooseFile(image.id)}>
                {loading && pendingReplace.current === image.id ? <MagazooLoader variant="inline" label="Optimising image…" /> : 'Replace image'}
              </button>
            </div>
          </div>
        );
      })}</ImageDeck>

      <button type="button" className="add-btn hero-upload" disabled={loading} onClick={() => chooseFile()}>
        {loading && pendingReplace.current === null ? <MagazooLoader variant="inline" label="Optimising image…" /> : '+ Add page image'}
      </button>
      {error && <p className="hint hint--warn" role="alert">{error}</p>}
    </Section>
  );
}
