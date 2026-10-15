import type { Design, GateTextPlacement } from '../schema/document';
import { pageDimensions } from './pageFormat';

export const clampGate = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export function gatePlacement(box: GateTextPlacement | undefined, margin: number, design?: Pick<Design, 'pageFormat'>) {
  const page = pageDimensions(design);
  const inset = clampGate(box?.inset ?? margin, 8, page.width - 58);
  return {
    inset,
    width: clampGate(box?.width ?? page.width - 2 * margin, 50, page.width - inset - 8),
    top: box?.top === undefined ? undefined : clampGate(box.top, 0, page.height - 37),
  };
}
