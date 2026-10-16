import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import {
  backgroundPhotoChoices, canSamplePhotoSource, photoBackgroundColour, photoPointAt, sampledPageDesign,
  type PhotoBackgroundColour, type PhotoSamplePoint,
} from '../../lib/photoBackground';
import { useDoc } from '../../store/useDoc';
import { LabeledSelect, Section } from '../Field';
import './photo-background.css';

/** A deliberate local eyedropper: the editor chooses the background rather
 * than letting a foreground subject determine the page's theme. */
export function PhotoBackgroundSection() {
  const doc = useDoc(state => state.doc);
  const update = useDoc(state => state.update);
  const choices = useMemo(() => backgroundPhotoChoices(doc), [doc]);
  const [selection, setSelection] = useState('');
  const assetId = choices.some(choice => choice.value === selection) ? selection : choices[0]?.value;
  const source = assetId ? doc.assets[assetId] : undefined;
  const src = source?.src;
  const supported = !!source && canSamplePhotoSource(source.src);
  const [decoded, setDecoded] = useState<{ src: string; canvas: HTMLCanvasElement; naturalWidth: number; naturalHeight: number } | null>(null);
  const [sample, setSample] = useState<{ src: string; colour: PhotoBackgroundColour } | null>(null);
  const [point, setPoint] = useState<PhotoSamplePoint>({ x: .5, y: .5 });
  const [error, setError] = useState('');
  const preview = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let cancelled = false;
    setDecoded(null); setSample(null); setError(''); setPoint({ x: .5, y: .5 });
    if (!src || !supported) return;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (cancelled) return;
      try {
        if (!image.naturalWidth || !image.naturalHeight) throw new Error('Invalid photograph dimensions.');
        const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Colour sampling is unavailable in this browser.');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        // Probe once so a blocked/tainted source fails before any page edit.
        context.getImageData(0, 0, 1, 1);
        setDecoded({ src, canvas, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight });
      } catch {
        setError('This photo cannot be sampled. Upload a JPEG, PNG or WebP, or use the page colour control.');
      }
    };
    image.onerror = () => { if (!cancelled) setError('The photo could not be read. Replace it or use the page colour control.'); };
    image.src = src;
    return () => { cancelled = true; image.onload = null; image.onerror = null; };
  }, [src, supported]);

  const ready = decoded?.src === source?.src ? decoded : null;
  const currentSample = sample?.src === source?.src ? sample : null;
  const sampleAt = (next: PhotoSamplePoint) => {
    if (!ready) return;
    try {
      const canvas = ready.canvas;
      const x = Math.min(canvas.width - 1, Math.round(next.x * (canvas.width - 1)));
      const y = Math.min(canvas.height - 1, Math.round(next.y * (canvas.height - 1)));
      const left = Math.max(0, x - 2), top = Math.max(0, y - 2);
      const pixels = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(
        left, top, Math.min(5, canvas.width - left), Math.min(5, canvas.height - top),
      ).data;
      const colour = photoBackgroundColour(pixels);
      setPoint(next);
      setSample(colour ? { src: ready.src, colour } : null);
      setError(colour ? '' : 'That point is transparent. Choose an opaque part of the photo background.');
    } catch { setSample(null); setError('This photo cannot be sampled. Use the page colour control instead.'); }
  };
  const choosePoint = (event: MouseEvent<HTMLButtonElement>) => {
    if (!preview.current || !ready) return;
    const next = event.detail === 0 ? point : photoPointAt(
      event.clientX, event.clientY, preview.current.getBoundingClientRect(), ready.naturalWidth, ready.naturalHeight,
    );
    if (next) sampleAt(next);
  };
  const movePoint = (event: KeyboardEvent<HTMLButtonElement>) => {
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? .1 : .02;
    sampleAt({ x: Math.max(0, Math.min(1, point.x + direction[0] * step)), y: Math.max(0, Math.min(1, point.y + direction[1] * step)) });
  };

  return <Section title="Match page colour to a photo" editorTarget="photo-background-colour">
    <p className="hint">Pick a background area, not the subject. This sets a solid base colour on every page, without putting the photograph behind your text. Existing full-bleed photos stay visible above the base colour.</p>
    {!choices.length ? <p className="hint">Add a photo in Images, then return here to pick its background colour.</p> : <>
      <LabeledSelect label="Source photo" value={assetId ?? ''} options={choices} onChange={setSelection} />
      {!supported ? <p className="hint">Colour sampling needs an embedded JPEG, PNG, WebP or other bitmap photo. Upload a photograph instead of an SVG or linked image.</p> : <>
        <button type="button" className="photo-background-picker" aria-label="Pick background colour from photo"
          aria-describedby="photo-background-help" disabled={!ready} onClick={choosePoint} onKeyDown={movePoint}>
          <img ref={preview} src={source?.src} alt="Source photograph for background colour" draggable={false} />
        </button>
        <p className="hint" id="photo-background-help">Click the photo background. Keyboard: arrow keys move the sample point; Enter samples the current point. Point: {Math.round(point.x * 100)}% across, {Math.round(point.y * 100)}% down.</p>
        <div className="photo-background-result" aria-live="polite">
          {currentSample ? <><span className="photo-background-swatch" aria-hidden="true" style={{ backgroundColor: currentSample.colour.background }} />
            <span>Sampled colour <strong>{currentSample.colour.background}</strong></span></> : <span>{ready ? 'No colour chosen yet' : error ? 'Photo unavailable' : 'Loading photo…'}</span>}
        </div>
        <button type="button" className="add-btn" disabled={!currentSample} onClick={() => {
          if (!currentSample || !assetId) return;
          update(draft => {
            if (draft.assets[assetId]?.src !== currentSample.src) return;
            draft.design = sampledPageDesign(draft.design, currentSample.colour, draft.templateId);
          });
        }}>Apply sampled page colour</button>
        <p className="hint">Theme text switches to contrasting ink. Custom text colours remain unchanged. You can fine-tune the page colour below; automatic hero-colour matching is turned off when you apply.</p>
      </>}
    </>}
    {error && <p role="alert" className="hint hint--warn">{error}</p>}
  </Section>;
}
