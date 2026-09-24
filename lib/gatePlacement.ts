import type { GateTextPlacement } from '../schema/document';
import { PAGE_W } from './geometry';

export const clampGate = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export function gatePlacement(box: GateTextPlacement | undefined, margin: number) {
  const inset = clampGate(box?.inset ?? margin, 8, PAGE_W - 58);
  return {
    inset,
    width: clampGate(box?.width ?? PAGE_W - 2 * margin, 50, PAGE_W - inset - 8),
    top: box?.top === undefined ? undefined : clampGate(box.top, 0, 260),
  };
}
