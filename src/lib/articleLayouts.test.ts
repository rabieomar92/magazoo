import { describe, expect, it } from 'vitest';
import { ARTICLE_LAYOUTS, articleGeometry, articleGridDesign, articleRegions, referenceArticleDesign, type ReferenceArticleId } from './articleLayouts';
import { grid } from './geometry';
import { presetFor } from '../store/presets';
import { emptyDoc, migrate } from '../schema/document';
import { paginateHosts } from './paginate';

const ids = Object.keys(ARTICLE_LAYOUTS) as ReferenceArticleId[];
describe('reference article compositions', () => {
  it.each(ids)('%s keeps the measured four-column grid on every page', id => {
    const doc = presetFor(id);
    const g = articleGeometry(id, doc.design);
    expect(g.height).toBe(276);
    expect(g.col).toBe(42.5);
    expect(g.margin).toBe(14);
    expect(g.gutter).toBe(4);
    const regions = articleRegions(g, 2);
    expect(regions).toHaveLength(12);
    expect(regions.every(r => r.width === 42.5)).toBe(true);
    expect(regions.slice(0,4).map(r => r.x)).toEqual([14,60.5,107,153.5]);
    expect(regions.every(r => r.y >= 0 && r.y + r.height <= 258)).toBe(true);
    const restored = migrate(JSON.parse(JSON.stringify(doc)));
    expect(restored.templateId).toBe(id);
    expect(restored.design.articlePageSize).toBe('reference');
  });

  it('models five different image/title/column relationships', () => {
    const geometries = ids.map(id => articleGeometry(id, presetFor(id).design));
    expect(geometries.map(g => g.titleCols)).toEqual([2,4,3,4,4]);
    expect(geometries[0].starts).toEqual([179,179,126,126]);
    expect(geometries[2].starts).toEqual([168,168,168,124]);
    expect(geometries[4].starts).toEqual([68,184,184,184]);
    expect(geometries[4].image).toEqual({x:60.5,y:68,width:135.5,height:103});
    expect(new Set(geometries.map(g => JSON.stringify([g.image,g.starts,g.titleTop]))).size).toBe(5);
  });

  it('moves text below a growing title and caption without changing widths', () => {
    const doc = presetFor('paper-8');
    const g = articleGeometry('paper-8', doc.design, 40, 22);
    expect(g.bodyTop).toBeGreaterThanOrEqual(g.titleTop + 40 + 4);
    expect(g.starts[1]).toBeGreaterThanOrEqual(g.image.y + g.image.height + 22 + 4);
    expect(g.col).toBe(42.5);
  });

  it('extends the A4 text frame and honours a raised footer', () => {
    const doc = presetFor('paper-5');
    doc.design.articlePageSize = 'a4';
    const g = articleGeometry('paper-5', doc.design, 0, 0, 46);
    expect(g.height).toBe(297); expect(g.bottom).toBe(251);
    expect(g.image.height).toBe(139);
  });

  it.each(ids)('%s reflows into a native magazine grid without scaling the artwork', id => {
    const doc = presetFor(id);
    doc.design.pageFormat = 'magazine';
    const before = JSON.stringify(doc);
    const g = articleGeometry(id, doc.design);
    expect(g.width).toBe(203);
    expect(g.height).toBe(267);
    expect(g.margin).toBe(14);
    expect(g.gutter).toBe(4);
    expect(g.col).toBe(40.75);
    expect(g.image.height).toBe(ARTICLE_LAYOUTS[id].heroHeight);
    expect(g.image.x + g.image.width).toBeLessThanOrEqual(203);
    if (id !== 'paper-8') expect(g.image.width).toBe(203);
    const regions = articleRegions(g, 2);
    expect(regions).toHaveLength(12);
    expect(regions.every(r => r.width === 40.75)).toBe(true);
    expect(regions.every(r => r.x + r.width <= 189 && r.y + r.height <= 249)).toBe(true);
    expect(grid(articleGridDesign(doc.design)).col).toBe(g.col);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('uses the native magazine trim even when an older article selected A4', () => {
    const doc = presetFor('paper-5');
    doc.design.articlePageSize = 'a4';
    doc.design.pageFormat = 'magazine';
    const g = articleGeometry('paper-5', doc.design, 0, 0, 46);
    expect(g.height).toBe(267);
    expect(g.bottom).toBe(221);
  });

  it('never gives an image obstacle overlapping text regions', () => {
    const g = articleGeometry('paper-4', presetFor('paper-4').design);
    const obstacle = { page:1,left:60.5,top:65,width:89,height:50 };
    const regions = articleRegions(g, 1, [obstacle]);
    const affected = regions.filter(r => r.page === 1 && (r.column === 1 || r.column === 2));
    expect(affected).toHaveLength(4);
    expect(affected.every(r => r.y + r.height <= 63 || r.y >= 117)).toBe(true);
    expect(affected.map(r => r.column)).toEqual([1,1,2,2]);
  });

  it('uses right-to-left reading order on first and continuation pages', () => {
    const g = articleGeometry('paper-7', presetFor('paper-7').design);
    const regions = articleRegions(g, 1, [], true);
    expect(regions.map(r => r.column)).toEqual([3,2,1,0,3,2,1,0]);
  });

  it('skips undersized slots without losing or force-clipping an atomic item', () => {
    const small = document.createElement('div');
    const large = document.createElement('div');
    const figure = { kind:'figure' as const,id:'callout',aspect:1,hasCaption:false,widthBasis:1 as const };
    const result = paginateHosts([small,large], [figure], el => el === small && !!el.children.length, {deferUnfit:true});
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toEqual([]);
    expect(result.pages[1][0]).toMatchObject({kind:'figure',id:'callout'});
  });

  it('resets presentation without mutating the old design', () => {
    const original = emptyDoc().design;
    const before = JSON.stringify(original);
    const design = referenceArticleDesign('paper-6', original);
    expect(JSON.stringify(original)).toBe(before);
    expect(design).not.toBe(original);
    expect(design.colors).not.toBe(original.colors);
    expect(design.sizes).not.toBe(original.sizes);
  });

  it.each(ids)('%s uses one image/text grid in every highlights mode', id=> {
    const doc=presetFor(id);
    for(const highlightsPlacement of ['page1','page1-flow','all','below','free'] as const) {
      doc.design.highlightsPlacement=highlightsPlacement;
      const geometry=articleGeometry(id,doc.design);
      const imageGrid=grid(articleGridDesign(doc.design));
      expect(imageGrid.col).toBe(geometry.col);
      expect(imageGrid.totalCols).toBe(geometry.columns);
      expect(doc.design.highlightsPlacement).toBe(highlightsPlacement);
    }
  });

  it.each(ids)('%s supports bottom photography without covering body columns', id=> {
    const doc=presetFor(id);doc.design.heroAtBottom=true;
    const g=articleGeometry(id,doc.design,30,8);
    const regions=articleRegions(g,1);
    expect(g.image.y).toBeGreaterThan(g.bodyTop);
    expect(regions.filter(r=>r.page===0).every(r=>r.x>=g.image.x+g.image.width||r.x+r.width<=g.image.x||r.y+r.height<=g.image.y-2)).toBe(true);
    expect(regions.filter(r=>r.page===1)).toHaveLength(4);
  });

  it.each(ids)('%s optionally bleeds a bottom hero to the real trim without changing photo height or text width', id => {
    for (const format of ['reference', 'a4', 'magazine'] as const) {
      const doc = presetFor(id);
      doc.design.heroAtBottom = true;
      doc.design.heroBottomBleed = true;
      doc.design.articlePageSize = format === 'a4' ? 'a4' : 'reference';
      if (format === 'magazine') doc.design.pageFormat = 'magazine';
      const before = JSON.stringify(doc);
      const g = articleGeometry(id, doc.design, 30, 8, 44);
      expect(g.bottomBleed).toBe(true);
      expect(g.image.y + g.image.height).toBe(g.height);
      expect(g.height).toBe(format === 'magazine' ? 267 : format === 'a4' ? 297 : 276);
      expect(g.image.height).toBe(doc.design.heroHeight);
      expect(g.image.x + g.image.width).toBeLessThanOrEqual(g.width);
      const regions = articleRegions(g, 1);
      expect(regions.filter(r => r.page === 0).every(r => r.x >= g.image.x + g.image.width ||
        r.x + r.width <= g.image.x || r.y + r.height <= g.image.y - 2)).toBe(true);
      expect(regions.every(r => r.y + r.height <= g.bottom)).toBe(true);
      expect(regions.every(r => r.width === g.col)).toBe(true);
      expect(JSON.stringify(doc)).toBe(before);
      const legacy = articleGeometry(id, { ...doc.design, heroBottomBleed: undefined }, 30, 8, 44);
      expect(legacy.bottomBleed).toBe(false);
      expect(legacy.image.y + legacy.image.height).toBe(g.bottom - (id === 'paper-8' ? 8 + g.gutter : 0));
      expect(g.col).toBe(legacy.col);
    }
  });

  it('does not apply bottom bleed to a top-positioned or hidden hero', () => {
    const doc = presetFor('paper-4');
    doc.design.heroBottomBleed = true;
    expect(articleGeometry('paper-4', doc.design).bottomBleed).toBe(false);
    doc.design.heroAtBottom = true;
    doc.design.showHero = false;
    expect(articleGeometry('paper-4', doc.design).bottomBleed).toBe(false);
  });

  it('mirrors the inset image while keeping physical columns equal',()=> {
    const doc=presetFor('paper-8');doc.design.heroSide='left';
    const g=articleGeometry('paper-8',doc.design);
    expect(g.image.x).toBe(g.margin);
    expect(g.starts).toEqual([184,184,184,68]);
  });

  it('reserves a lowered masthead on the opening and continuation pages',()=> {
    const doc=presetFor('paper-4');doc.design.topBarOffset=40;doc.design.showHero=false;
    const g=articleGeometry('paper-4',doc.design);
    expect(g.titleTop).toBeGreaterThanOrEqual(48);
    expect(articleRegions(g,1).filter(r=>r.page===1).every(r=>r.y>=48)).toBe(true);
  });

  it.each(ids)('%s preserves all shared settings through save/load and template switching', id=> {
    const doc=presetFor(id);
    doc.design.highlightsPlacement='free';
    doc.design.textTracking={body:.015,highlights:.025,'block:local':.04};
    doc.design.imageTheme=true;doc.design.heroAtBottom=true;doc.design.heroBottomBleed=true;
    doc.highlightBox={widthCols:2,anchor:{page:2,column:1,y:145}};
    doc.blocks=[{id:'local',type:'paragraph',text:'Retained quote',decorativeQuote:true,fontSize:11,color:'#345678',topPadding:5},
      {id:'eq',type:'equation',tex:'E=mc^2',caption:'Energy'}];
    doc.images=[{id:'image',assetId:doc.hero.assetId!,widthCols:2,anchor:{page:2,column:1,y:60},caption:'Caption',align:'right',wrapShape:'contour',wrapContour:{top:[10,20],bottom:[0,0]},bleed:{right:true},frame:{scale:1.2,offsetX:5,offsetY:-3}}];
    const restored=migrate(JSON.parse(JSON.stringify(doc)));
    expect(restored.highlightBox).toEqual(doc.highlightBox);
    expect(restored.images).toEqual(doc.images);
    expect(restored.blocks).toEqual(doc.blocks);
    expect(restored.design.textTracking).toEqual(doc.design.textTracking);
    expect(restored.design.highlightsPlacement).toBe('free');
    expect(restored.design.imageTheme).toBe(true);
    expect(restored.design.heroAtBottom).toBe(true);
    expect(restored.design.heroBottomBleed).toBe(true);
  });
});
