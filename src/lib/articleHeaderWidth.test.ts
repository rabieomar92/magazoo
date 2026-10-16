import { describe, expect, it } from 'vitest';
import { emptyDoc, migrate, type Design } from '../schema/document';
import { articleHeaderWidth, articleHeaderWidthVars, supportsArticleHeaderWidth } from './articleHeaderWidth';
import { articleGeometry, articleRegions, type ReferenceArticleId } from './articleLayouts';
import { presetFor } from '../store/presets';

describe('article heading width',()=>{
  it('preserves template defaults without adding a width override',()=>{
    const design=emptyDoc().design;
    expect(articleHeaderWidth(design)).toBeUndefined();
    expect(articleHeaderWidthVars(design)).toEqual({});
  });
  it.each([1,2,3,4] as const)('uses %i columns of the same four-column grid',count=>{
    for(const pageFormat of [undefined,'magazine'] as const){
      const design={...emptyDoc().design,pageFormat,margin:12,gutter:5,headerWidthCols:count};
      const width=pageFormat==='magazine'?203:210;
      const col=(width-24-15)/4;
      expect(articleHeaderWidth(design)).toBe(col*count+5*(count-1));
      expect(articleHeaderWidthVars(design)['--article-header-width']).toBe(`${col*count+5*(count-1)}mm`);
      const doc=emptyDoc();doc.design=design;
      expect(migrate(JSON.parse(JSON.stringify(doc))).design.headerWidthCols).toBe(count);
    }
  });
  it.each([0,5,-1,1.5,NaN,Infinity,'3',null])('ignores malformed imported spans: %s',value=>{
    expect(articleHeaderWidth({...emptyDoc().design,headerWidthCols:value} as Design)).toBeUndefined();
  });
  it.each(['paper-4','paper-5','paper-6','paper-7','paper-8'] as ReferenceArticleId[])('%s shares the visible, measuring, and exclusion width',id=>{
    for(const count of [1,2,3,4] as const)for(const bodyCols of [2,3,4] as const){
      const design={...presetFor(id).design,headerWidthCols:count,bodyCols};
      const g=articleGeometry(id,design,55);
      expect(g.titleWidth).toBe(articleHeaderWidth(design));
      const regions=articleRegions(g,0);
      for(const region of regions){
        if(region.x<g.margin+g.titleWidth-.01)expect(region.y).toBeGreaterThanOrEqual(g.titleTop+55+g.gutter);
      }
    }
  });
  it('limits the common control to article headings, not galleries/front matter/covers',()=>{
    for(const id of ['paper-1','paper-2','paper-3','paper-4','paper-5','paper-6','paper-7','paper-8'] as const)expect(supportsArticleHeaderWidth(id)).toBe(true);
    for(const id of ['gallery-1','frontmatter-dean','magazine-4','news-briefs'] as const)expect(supportsArticleHeaderWidth(id)).toBe(false);
  });
});
