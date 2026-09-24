import { describe, it, expect } from 'vitest';
import { packFrontMatter } from './frontMatterLayout';
import { makeFrontMatter } from '../store/frontMatter';
import { cloneDocForUpdate } from '../store/useDoc';
import { migrate, familyOf } from '../schema/document';

describe('front matter layout',()=>{
  it('fills sequentially and moves a complete entry to the next column',()=>{
    const units = ['a','b','c'].map(id=>({id,text:id}));
    const result = packFrontMatter(units,100,()=>42,10);
    expect(result.columns.map(c=>c.map(u=>u.id))).toEqual([['a','b'],['c']]);
    expect(result.overflow).toBe(false);
  });
  it('splits a long paragraph without losing words',()=>{
    const text=Array.from({length:41},(_,i)=>`word${i}`).join(' ');
    const result=packFrontMatter([{id:'p',text}],100,u=>u.text.split(' ').length*10,8);
    expect(result.columns.flat().map(u=>u.text).join(' ')).toBe(text);
    expect(result.columns.length).toBe(5);
    expect(result.columns[1][0].continued).toBe(true);
    expect(result.overflow).toBe(false);
  });
  it('reports an unfit heading and retains the complete content',()=>{
    const result=packFrontMatter([{id:'p',title:'Long heading',text:'Keep this'}],10,()=>20,8);
    expect(result.overflow).toBe(true);
    expect(result.columns.flat()[0].text).toBe('Keep this');
  });
  it('handles empty contents as one usable page',()=>{
    expect(packFrontMatter([],100,()=>0,10).columns).toEqual([[]]);
  });
  it('keeps the closing paragraph with a signature that would otherwise be orphaned', () => {
    const units = [{ id: 'a', text: 'opening', }, { id: 'b', text: 'closing' }, { id: 'sig', text: '', kind: 'signature' as const }];
    const result = packFrontMatter(units, 100, u => u.kind === 'signature' ? 30 : 40, 10);
    expect(result.columns.map(column => column.map(u => u.id))).toEqual([['a'], ['b', 'sig']]);
    expect(result.overflow).toBe(false);
  });
  it('carries closing copy with a large signature without losing or duplicating words', () => {
    const text = Array.from({ length: 9 }, (_, i) => `word${i}`).join(' ');
    const result = packFrontMatter([{ id: 'p', text }, { id: 'sig', text: '', kind: 'signature' }], 100,
      u => u.kind === 'signature' ? 55 : u.text.split(' ').length * 10, 5);
    expect(result.columns.at(-1)!.map(u => u.id)).toEqual(['p', 'sig']);
    expect(result.columns.flat().filter(u => !u.kind).map(u => u.text).join(' ')).toBe(text);
    expect(result.overflow).toBe(false);
  });
  it('preserves new content through save/reopen and isolates undo drafts',()=>{
    for(const id of ['frontmatter-dean','frontmatter-contents','frontmatter-board'] as const){
      const doc=makeFrontMatter(id);
      if (id === 'frontmatter-board') {
        doc.assets['school-logo'] = { src: 'data:image/png;base64,logo', naturalWidth: 600, naturalHeight: 180 };
        doc.frontMatter!.logo = { assetId: 'school-logo', offsetX: 4, offsetY: -2, scale: 1.1 };
        doc.design.showTopBar = false;
      } else if (id === 'frontmatter-dean') {
        doc.assets['dean-signature'] = { src: 'data:image/png;base64,signature', naturalWidth: 600, naturalHeight: 180 };
        doc.frontMatter!.signature = { assetId: 'dean-signature', offsetX: 3, offsetY: -1, scale: 1.2 };
        doc.frontMatter!.signatureWidth = 38;
        doc.frontMatter!.signatureCrop = { x: .1, y: .2, width: .8, height: .6 };
        doc.frontMatter!.signatureAlign = 'end';
        doc.frontMatter!.signatureGap = 5;
        doc.design.deanCategoryTopGap = 6;
        doc.design.deanTitleBottomGap = 11;
      }
      expect(familyOf(id)).toBe('frontmatter');
      const reopened=migrate(JSON.parse(JSON.stringify(doc)));
      expect(reopened.frontMatter).toEqual(doc.frontMatter);
      expect(reopened.cover?.assetId).toBe(doc.cover?.assetId);
      if (id === 'frontmatter-board') {
        expect(reopened.assets['school-logo']).toBeDefined();
        expect(reopened.design.showTopBar).toBe(false);
      } else if (id === 'frontmatter-dean') {
        expect(reopened.assets['dean-signature']).toBeDefined();
        expect(reopened.design.deanCategoryTopGap).toBe(6);
        expect(reopened.design.deanTitleBottomGap).toBe(11);
      }
      const draft=cloneDocForUpdate(doc);
      draft.frontMatter!.contact='Changed';
      expect(doc.frontMatter!.contact).not.toBe('Changed');
      if (id === 'frontmatter-board') {
        draft.frontMatter!.logo!.offsetX = 30;
        expect(doc.frontMatter!.logo!.offsetX).toBe(4);
      } else if (id === 'frontmatter-dean') {
        draft.frontMatter!.signature!.offsetX = 30;
        expect(doc.frontMatter!.signature!.offsetX).toBe(3);
        draft.frontMatter!.signatureCrop!.x = .2;
        expect(doc.frontMatter!.signatureCrop!.x).toBe(.1);
      }
      if(draft.frontMatter!.entries.length){draft.frontMatter!.entries[0].title='Changed';expect(doc.frontMatter!.entries[0].title).not.toBe('Changed');}
    }
  });
});
