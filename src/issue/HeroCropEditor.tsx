import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Asset } from '../schema/document';
import { FramedImage } from '../components/FramedImage';
import { framedImageGeometry, normalizeImageFrame, type ImageFrame } from '../lib/imageFrame';

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const MIN_SCALE = 1;
const MAX_SCALE = 3;

/**
 * Where the picture sits inside its slot.
 *
 * A contents slot is a fixed shape and the photograph is not, so something has
 * to be cut. Left to itself the frame cuts from the middle, which is the one
 * choice guaranteed to be wrong for a portrait: a standing figure in a slot
 * wider than it is tall loses the head and keeps the jacket. This is the
 * control that settles it — drag the picture to say which part of it matters,
 * zoom in to crop tighter — and it works on exactly the geometry the page
 * uses, so what is framed here is what prints.
 *
 * `aspect` is measured from the real sheet wherever the compiled preview has
 * one on screen, rather than assumed, because the same photograph sits in a
 * different shape depending on its density tier and whether it landed in a
 * feature slot or a side rail.
 */
export function HeroCropEditor({ asset, frame, aspect, disabled, onChange }: {
  asset: Asset;
  frame?: ImageFrame;
  aspect: number;
  disabled?: boolean;
  onChange: (frame: ImageFrame) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const resolved = normalizeImageFrame(frame);
  const drag = useRef<{ x: number; y: number; frame: ImageFrame; roomX: number; roomY: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  const room = useCallback((source: ImageFrame) => {
    const node = box.current;
    const width = node?.clientWidth ?? 0;
    const height = node?.clientHeight ?? 0;
    const geometry = framedImageGeometry(asset.naturalWidth, asset.naturalHeight, width, height, source, 'cover');
    return { roomX: Math.abs(geometry.width - width), roomY: Math.abs(geometry.height - height) };
  }, [asset.naturalHeight, asset.naturalWidth]);

  const nudge = useCallback((dx: number, dy: number) => {
    const { roomX, roomY } = room(resolved);
    onChange({
      scale: resolved.scale,
      offsetX: roomX > 0.5 ? clamp(resolved.offsetX + (dx * 100) / roomX, -50, 50) : resolved.offsetX,
      offsetY: roomY > 0.5 ? clamp(resolved.offsetY + (dy * 100) / roomY, -50, 50) : resolved.offsetY,
    });
  }, [onChange, resolved, room]);

  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    drag.current = { x: event.clientX, y: event.clientY, frame: resolved, ...room(resolved) };
    setGrabbing(true);
    box.current?.setPointerCapture(event.pointerId);
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    onChange({
      scale: active.frame.scale,
      offsetX: active.roomX > 0.5 ? clamp(active.frame.offsetX + (dx * 100) / active.roomX, -50, 50) : active.frame.offsetX,
      offsetY: active.roomY > 0.5 ? clamp(active.frame.offsetY + (dy * 100) / active.roomY, -50, 50) : active.frame.offsetY,
    });
  };
  const end = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    setGrabbing(false);
    box.current?.releasePointerCapture(event.pointerId);
  };
  useEffect(() => () => { drag.current = null; }, []);

  const centred = Math.abs(resolved.offsetX) < 0.5 && Math.abs(resolved.offsetY) < 0.5 && Math.abs(resolved.scale - 1) < 0.005;
  return <div className="crop-editor">
    <div
      ref={box}
      className={`crop-stage${grabbing ? ' is-grabbing' : ''}`}
      style={{ aspectRatio: aspect > 0 ? aspect : 16 / 10 }}
      role="application"
      aria-label="Drag to reposition this picture inside its slot"
      tabIndex={disabled ? -1 : 0}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={event => {
        const step = event.shiftKey ? 12 : 4;
        const map: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
        };
        const delta = map[event.key];
        if (!delta || disabled) return;
        event.preventDefault();
        nudge(delta[0], delta[1]);
      }}
    >
      <FramedImage asset={asset} frame={resolved} fit="cover" />
      <span className="crop-guides" aria-hidden="true" />
    </div>
    <div className="crop-controls">
      <label className="crop-zoom">
        <span>Zoom</span>
        <input
          type="range" min={MIN_SCALE} max={MAX_SCALE} step={0.02} value={clamp(resolved.scale, MIN_SCALE, MAX_SCALE)}
          disabled={disabled}
          onChange={event => onChange({ ...resolved, scale: clamp(event.target.valueAsNumber, MIN_SCALE, MAX_SCALE) })}
        />
        <b>{Math.round(clamp(resolved.scale, MIN_SCALE, MAX_SCALE) * 100)}%</b>
      </label>
      <button type="button" className="ghost" disabled={disabled || centred} onClick={() => onChange({ scale: 1, offsetX: 0, offsetY: 0 })}>Recentre</button>
    </div>
    <p className="field-hint">Drag the picture to choose what stays in frame — arrow keys nudge it. Zoom crops tighter around that point.</p>
  </div>;
}
