import { describe, expect, it } from 'vitest';
import { cssVars, grid } from './geometry';
import { pageDimensions, withPageFormat } from './pageFormat';
import { presetFor, TEMPLATE_META } from '../store/presets';
import { signatureGeometry } from './signature';
import { PDF_PAGE_SIZES } from './pdfPageSize';
import { articlePageHeight } from './articleLayouts';

describe('native magazine view model', () => {
  it.each(TEMPLATE_META.map(meta=>meta.id))('uses an actual expanded editable canvas for %s',id=>{
    const doc=presetFor(id);doc.design.pageFormat='jis-b5';doc.design.bleedCanvas=true;doc.design.bleedMm=5;
    expect(pageDimensions(doc.design)).toEqual({width:192,height:267});
    expect(cssVars(doc.design,id)).toMatchObject({'--page-w':'192mm','--page-h':'267mm'});
  });
  it.each(TEMPLATE_META.flatMap(meta => (['a4','b5','jis-b5','magazine'] as const).map(size=>[meta.id,size] as const)))('converts %s to native %s without rewriting a single source field', (id,size) => {
    const source = presetFor(id);
    const before = JSON.stringify(source);
    const native = withPageFormat(source, size);
    const {width,height}=PDF_PAGE_SIZES[size];
    expect(pageDimensions(native.design)).toEqual({ width, height });
    expect(cssVars(native.design, id)).toMatchObject({ '--page-w': `${width}mm`, '--page-h': `${height}mm` });
    expect(articlePageHeight(native.design)).toBe(height);
    expect(native.blocks).toBe(source.blocks);
    expect(native.assets).toBe(source.assets);
    expect(native.images).toBe(source.images);
    expect(native.meta).toBe(source.meta);
    expect(native.design.sizes).toBe(source.design.sizes);
    expect(native.design.margin).toBe(source.design.margin);
    expect(JSON.stringify(source)).toBe(before);
    expect(withPageFormat(native, size)).toBe(native);
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
