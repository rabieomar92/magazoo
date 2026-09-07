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
  it('preserves new content through save/reopen and isolates undo drafts',()=>{
    for(const id of ['frontmatter-dean','frontmatter-contents','frontmatter-board'] as const){
      const doc=makeFrontMatter(id);
      expect(familyOf(id)).toBe('frontmatter');
      const reopened=migrate(JSON.parse(JSON.stringify(doc)));
      expect(reopened.frontMatter).toEqual(doc.frontMatter);
      expect(reopened.cover?.assetId).toBe(doc.cover?.assetId);
      const draft=cloneDocForUpdate(doc);
      draft.frontMatter!.contact='Changed';
      expect(doc.frontMatter!.contact).not.toBe('Changed');
      if(draft.frontMatter!.entries.length){draft.frontMatter!.entries[0].title='Changed';expect(doc.frontMatter!.entries[0].title).not.toBe('Changed');}
    }
  });
});
