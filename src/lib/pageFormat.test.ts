import { describe, expect, it } from 'vitest';
import { cssVars, grid } from './geometry';
import { pageDimensions, withPageFormat } from './pageFormat';
import { presetFor, TEMPLATE_META } from '../store/presets';
import { signatureGeometry } from './signature';

describe('native magazine view model', () => {
  it.each(TEMPLATE_META.map(meta => meta.id))('converts %s without rewriting a single source field', id => {
    const source = presetFor(id);
    const before = JSON.stringify(source);
    const native = withPageFormat(source, 'magazine');
    expect(pageDimensions(native.design)).toEqual({ width: 203, height: 267 });
    expect(cssVars(native.design, id)).toMatchObject({ '--page-w': '203mm', '--page-h': '267mm' });
    expect(native.blocks).toBe(source.blocks);
    expect(native.assets).toBe(source.assets);
    expect(native.images).toBe(source.images);
    expect(native.meta).toBe(source.meta);
    expect(native.design.sizes).toBe(source.design.sizes);
    expect(native.design.margin).toBe(source.design.margin);
    expect(JSON.stringify(source)).toBe(before);
    expect(withPageFormat(source, 'a4')).toBe(source);
    expect(withPageFormat(source, 'b5')).toBe(source);
    expect(pageDimensions(withPageFormat(native, 'a4').design)).toEqual({ width: 210, height: 297 });
  });
  it('uses one narrower native grid on every page, without shrinking font size', () => {
    const source = presetFor('paper-1');
    const native = withPageFormat(source, 'magazine');
    const before = grid(source.design), after = grid(native.design);
    expect(before.content - after.content).toBe(7);
    expect(after.col).toBeCloseTo((203 - 2 * source.design.margin - (after.totalCols - 1) * source.design.gutter) / after.totalCols);
    expect(native.design.sizes.body).toBe(source.design.sizes.body);
  });
  it('sizes a Dean signature to the native column instead of the old A4 column', () => {
    const signature = { signatureWidth: 80 };
    const native = signatureGeometry({ src: '', naturalWidth: 3, naturalHeight: 1 }, signature, 14, 203);
    expect(native.columnWidth).toBe((203 - 28 - 48) / 2);
    expect(native.width).toBeLessThanOrEqual(native.columnWidth);
  });
});
