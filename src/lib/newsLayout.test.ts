import { describe, expect, it } from 'vitest';
import { newsCopyHtml, newsParagraphs, packNews, type NewsPiece } from './newsLayout';
import { newNewsStory, makeNews } from '../store/news';
import { assetIsReferenced, migrate } from '../schema/document';
import { cloneDocForUpdate } from '../store/useDoc';
import { runsToHtml } from './richtext';

const story = (id: string, text = 'a b c d'): NewsPiece => ({ ...newNewsStory(), id, title: id, text });
const textOf = (text:string) => { const node=document.createElement('div');node.innerHTML=runsToHtml(text);return node.textContent!; };
const measure = (p:NewsPiece) => 10 + p.text.length;
describe('news pagination',()=>{
  it('packs whole stories in order without altering the source',()=>{
    const source=[story('a'),story('b'),story('c')];
    const result=packNews(source,40,5,measure);
    expect(result.pages.map(p=>p.map(s=>s.id))).toEqual([['a','b'],['c']]);
    expect(result.overflow).toBe(false);
    expect(result.pages.flat().map(s=>s.text)).toEqual(source.map(s=>s.text));
  });
  it('honours page breaks without adding empty pages',()=>{
    const result=packNews([{...story('a'),breakBefore:true},{...story('b'),breakBefore:true}],100,5,measure);
    expect(result.pages.map(p=>p.map(s=>s.id))).toEqual([['a'],['b']]);
  });
  it('splits long Arabic text with formatting and paragraph breaks intact',()=>{
    const text='**يفتح العلم آفاقاً جديدة**\n\nيعمل الباحثون والطلاب معاً لفهم العالم من حولنا. '.repeat(10);
    const result=packNews([story('ar',text)],130,5,p=>10+textOf(p.text).length);
    expect(result.pages.length).toBeGreaterThan(1);
    expect(result.overflow).toBe(false);
    expect(result.pages.flat().map(s=>textOf(s.text)).join('')).toBe(textOf(text));
    expect(result.pages.flat().slice(1).every(s=>s.continued)).toBe(true);
  });
  it('reports an impossible fixed frame and preserves the story',()=>{
    const result=packNews([story('huge')],10,5,()=>100);
    expect(result.overflow).toBe(true);
    expect(result.pages.flat()[0].text).toBe('a b c d');
  });
  it('allows an empty issue and recalculates when text changes',()=>{
    expect(packNews([],100,5,measure).pages).toEqual([[]]);
    expect(packNews([story('one')],100,5,measure).pages.length).toBe(1);
    expect(packNews([story('one','a b c d '.repeat(30))],100,5,measure).pages.length).toBeGreaterThan(1);
  });
});
describe('side columns',()=>{
  const aside=(id:string,text='a b c d'):NewsPiece=>({...story(id,text),layout:'aside'});
  it('prints a side column beside the story above it as one band',()=>{
    const heights:Record<string,number>={main:40,side:25,tail:30};
    const result=packNews([story('main'),aside('side'),story('tail')],100,5,p=>heights[p.id]);
    // Stacked, the three would need 40+5+25+5+30 = 105 and spill onto page two.
    expect(result.pages.map(p=>p.map(s=>s.id))).toEqual([['main','side','tail']]);
    expect(result.pages[0].map(s=>s.pair)).toEqual(['main','aside',undefined]);
    expect(result.overflow).toBe(false);
  });
  it('measures the main story at the narrower width it prints at',()=>{
    const seen:(string|undefined)[]=[];
    packNews([story('main'),aside('side')],200,5,p=>{seen.push(p.pair);return 20;});
    expect(seen).toEqual(['main','aside']);
  });
  it('leaves an opening column, a page break and a second column on their own rows',()=>{
    expect(packNews([aside('side'),story('main')],200,5,()=>20).pages[0].map(s=>s.pair)).toEqual([undefined,undefined]);
    const broken=packNews([story('main'),{...aside('side'),breakBefore:true}],200,5,()=>20);
    expect(broken.pages.map(p=>p.map(s=>s.id))).toEqual([['main'],['side']]);
    expect(packNews([story('main'),aside('one'),aside('two')],200,5,()=>20).pages[0].map(s=>s.pair))
      .toEqual(['main','aside',undefined]);
  });
  it('keeps the ordinary flow when a pair cannot share one page',()=>{
    const result=packNews([story('main','a b c d e f'),aside('side')],20,5,p=>10+p.text.length);
    expect(result.pages.flat().every(s=>!s.pair)).toBe(true);
    expect(result.pages.flat().map(s=>s.id)).toContain('side');
    expect(result.pages.flat().filter(s=>s.id==='main').map(s=>textOf(s.text)).join('')).toBe('a b c d e f');
  });
});
describe('paragraph top-to-text spacing',()=>{
  const spaced=(text:string,tops:number[]):NewsPiece=>({...story('spaced',text),paragraphTops:tops});
  it('writes one paragraph block per blank line and spaces only what was asked',()=>{
    const html=newsCopyHtml(spaced('one\n\ntwo\n\nthree',[0,12]));
    expect(html).toBe('<p class="news-para">one</p><p class="news-para" style="padding-top:12px">two</p><p class="news-para">three</p>');
    expect(newsParagraphs('one\n\n\ntwo')).toEqual(['one','\ntwo']);
  });
  it('caps only the opening paragraph of a story',()=>{
    const html=newsCopyHtml(spaced('one two\n\nthree four',[]),true);
    expect(html.match(/drop-cap/g)).toHaveLength(1);
    expect(html.indexOf('drop-cap')).toBeLessThan(html.indexOf('three'));
  });
  it('carries the remaining spacing onto a continuation, never repeating a cut paragraph',()=>{
    const text='aaa bbb\n\nccc ddd\n\neee fff';
    // Cut mid-paragraph: the fragment that resumes must not take its spacing again.
    const cut=packNews([spaced(text,[5,6,7])],24,0,measure);
    expect(cut.pages.length).toBe(2);
    expect(cut.pages[0][0].paragraphTops).toEqual([5,6,7]);
    expect(cut.pages[1][0].text).toBe('ddd\n\neee fff');
    expect(cut.pages[1][0].paragraphTops).toEqual([0,7]);
    // Cut exactly on a paragraph break: the next paragraph keeps its spacing.
    const clean=packNews([spaced(text,[5,6,7])],20,0,measure);
    expect(clean.pages.map(p=>p[0].text)).toEqual(['aaa bbb\n\n','ccc ddd\n\n','eee fff']);
    expect(clean.pages.map(p=>p[0].paragraphTops)).toEqual([[5,6,7],[6,7],[7]]);
  });
  it('indents a paragraph that opens a continuation page, never a cut one',()=>{
    const text='aaa bbb\n\nccc ddd\n\neee fff';
    const cut=packNews([story('cut',text)],24,0,measure).pages[1][0];
    expect(cut.paragraphCut).toBe(true);
    expect(newsCopyHtml(cut)).not.toContain('news-para--indent');
    const fresh=packNews([story('fresh',text)],20,0,measure).pages[1][0];
    expect(fresh.paragraphCut).toBe(false);
    expect(newsCopyHtml(fresh)).toContain('<p class="news-para news-para--indent">ccc ddd</p>');
    // The opening paragraph of a brief is flush; the stylesheet indents the rest.
    expect(newsCopyHtml(story('plain',text))).not.toContain('news-para--indent');
  });
  it('leaves briefs without spacing untouched',()=>{
    expect(newsCopyHtml(story('plain','one\n\ntwo'))).not.toContain('padding-top');
    expect(packNews([story('plain','a b c d e f')],20,0,measure).pages.flat()
      .every(p=>p.paragraphTops===undefined)).toBe(true);
  });
});
describe('news storage',()=>{
  it('retains story photos through save/import and orphan cleanup',()=>{
    const d=makeNews();
    const photo=d.news!.stories[0].assetId!;
    expect(assetIsReferenced(d,photo)).toBe(true);
    const saved=migrate(JSON.parse(JSON.stringify(d)));
    expect(saved.news).toEqual(d.news);
    expect(saved.assets[photo]).toEqual(d.assets[photo]);
  });
  it('clones mutable stories and framing for undo safety',()=>{
    const d=makeNews();d.news!.stories[0].frame={scale:1,offsetX:0,offsetY:0};
    const clone=cloneDocForUpdate(d);
    clone.news!.stories[0].frame!.scale=2;clone.news!.stories[0].title='Edited';
    expect(d.news!.stories[0].frame!.scale).toBe(1);
    expect(d.news!.stories[0].title).not.toBe('Edited');
  });
});
