import { describe, expect, it } from 'vitest';
import {
  arrangeNewsRows,
  newsCopyHtml,
  newsCopySpan,
  newsParagraphs,
  newsPhotoSpan,
  newsTextColumns,
  packNews,
  type NewsPiece,
} from './newsLayout';
import { newNewsStory, makeNews } from '../store/news';
import { assetIsReferenced, migrate } from '../schema/document';
import { cloneDocForUpdate } from '../store/useDoc';
import { parseRuns, runsToHtml } from './richtext';

const story = (id: string, text = 'a b c d'): NewsPiece => {
  // Preset-only data represents files saved before the flexible grid controls.
  const legacy: NewsPiece = { ...newNewsStory(), id, title: id, text };
  delete legacy.widthCols;
  delete legacy.textCols;
  delete legacy.photoPosition;
  delete legacy.rowAlign;
  return legacy;
};
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
    let measurements=0;
    const result=packNews([story('huge','word '.repeat(10000))],10,5,()=>{measurements++;return 100;});
    expect(result.overflow).toBe(true);
    expect(result.pages).toHaveLength(1);
    expect(result.pages.flat()[0].text).toBe('word '.repeat(10000));
    expect(measurements).toBeLessThan(10);
  });
  it('measures split heads without the source that prints only on the final fragment',()=>{
    const text='aa bb cc dd ee ff gg hh ii jj';
    const result=packNews([{...story('sourced',text),source:'source'}],30,0,
      p=>8+textOf(p.text).length+(p.continues?0:10));
    expect(result.overflow).toBe(false);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0][0].text).toBe('aa bb cc dd ee ff gg ');
    expect(result.pages[0][0].continues).toBe(true);
    expect(result.pages[1][0].continues).toBe(false);
    expect(result.pages.flat().map(p=>textOf(p.text)).join('')).toBe(text);
  });
  it('reports an impossible source without filling dozens of continuation pages',()=>{
    const text='ordinary copy '.repeat(1000);
    const result=packNews([{...story('source',text),source:'oversized source'}],40,0,
      p=>8+p.text.length+(p.continues?0:50));
    expect(result.overflow).toBe(true);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0][0].text).toBe(text);
  });
  it('keeps literal unmatched markers and atomic math through several continuations',()=>{
    const text='A * literal asterisk and __ unfinished underline. **Bold science words** with $E = mc^2$ in the copy. '.repeat(1);
    const result=packNews([story('rich',text)],28,0,p=>5+parseRuns(p.text).reduce((size,run)=>size+run.text.length,0));
    expect(result.overflow).toBe(false);
    expect(result.pages.length).toBeGreaterThan(3);
    const pieces=result.pages.flat();
    expect(pieces.every(piece=>(piece.text.match(/\$/gu)?.length??0)%2===0)).toBe(true);
    const visible=(value:string)=>parseRuns(value).flatMap(run=>Array.from(run.text).map(char=>({
      char,...(!/\s/u.test(char)?{b:run.b,i:run.i,u:run.u,math:!!run.math}:{}),
    })));
    expect(pieces.flatMap(piece=>visible(piece.text))).toEqual(visible(text));
  });
  it('allows an empty issue and recalculates when text changes',()=>{
    expect(packNews([],100,5,measure).pages).toEqual([[]]);
    expect(packNews([story('one')],100,5,measure).pages.length).toBe(1);
    expect(packNews([story('one','a b c d '.repeat(30))],100,5,measure).pages.length).toBeGreaterThan(1);
  });
});
describe('flexible news grid',()=>{
  const flexible=(id:string,width:1|2|3|4,extra:Partial<NewsPiece>={}):NewsPiece=>({
    ...newNewsStory(),id,title:id,text:'short copy',widthCols:width,textCols:1,photoPosition:'none',...extra,
  });
  it('packs several explicit widths into one four-column row',()=>{
    const result=packNews([
      flexible('one',1),flexible('two',1),flexible('three',2),flexible('full',4),
    ],100,5,()=>20,4);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].map(piece=>piece.id)).toEqual(['one','two','three','full']);
    expect(result.pages[0].map(piece=>piece.row)).toEqual([0,0,0,1]);
    expect(result.pages[0].map(piece=>piece.gridSpan)).toEqual([1,1,2,4]);
    expect(result.pages[0].map(piece=>piece.gridStart)).toEqual([1,2,3,1]);
  });
  it('starts a fresh row on request without wasting a page',()=>{
    const result=packNews([
      flexible('one',1),flexible('two',1,{rowBreakBefore:true}),flexible('three',3),
    ],100,5,()=>20,4);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].map(piece=>piece.row)).toEqual([0,1,1]);
  });
  it('starts a fresh page on request without adding an empty opening page',()=>{
    const result=packNews([
      flexible('one',2),flexible('two',2,{breakBefore:true}),
    ],100,5,()=>20,4);
    expect(result.pages.map(page=>page.map(piece=>piece.id))).toEqual([['one'],['two']]);
    expect(packNews([flexible('opening',4,{breakBefore:true})],100,5,()=>20,4).pages)
      .toHaveLength(1);
  });
  it('balances a four-column feature between copy and photograph',()=>{
    const feature=flexible('feature',4,{layout:'lead',textCols:2,photoPosition:'right'});
    expect(newsCopySpan(feature,4,'right')).toBe(2);
    expect(newsPhotoSpan(feature,4,'right')).toBe(2);
    expect(newsTextColumns(feature,4,'right')).toBe(2);
  });
  it('honours a bounded custom side photograph width while retaining copy space',()=>{
    const feature=flexible('feature',4,{layout:'lead',textCols:4,photoPosition:'left',photoCols:1});
    expect(newsCopySpan(feature,4,'left')).toBe(3);
    expect(newsPhotoSpan(feature,4,'left')).toBe(1);
    expect(newsTextColumns(feature,4,'left')).toBe(3);
    expect(newsCopySpan({...feature,photoCols:4},4,'left')).toBe(1);
    expect(newsPhotoSpan({...feature,photoCols:4},4,'left')).toBe(3);
  });
  it('preserves the original logical column when earlier stories finish first',()=>{
    const result=packNews([
      flexible('short',1),flexible('long',2,{text:'word '.repeat(20)}),
    ],40,0,p=>10+p.text.length,4);
    expect(result.pages.length).toBeGreaterThan(2);
    expect(result.pages[0].map(piece=>piece.gridStart)).toEqual([1,2]);
    expect(result.pages.slice(1).every(page=>page.length===1&&page[0].gridStart===2)).toBe(true);
    expect(result.pages.flat().filter(piece=>piece.id==='long').map(piece=>piece.text).join('')).toBe('word '.repeat(20));
  });
  it('applies incomplete-row alignment once and retains it on continuation pages',()=>{
    const stories=[flexible('end',1,{rowAlign:'end',text:'word '.repeat(10)})];
    expect(arrangeNewsRows(stories,4)[0].pieces[0].gridStart).toBe(4);
    expect(packNews(stories,35,0,p=>10+p.text.length,4).pages.flat().every(piece=>piece.gridStart===4)).toBe(true);
    const centered=arrangeNewsRows([flexible('center',1,{rowAlign:'center'}),flexible('next',1)],4);
    expect(centered[0].pieces.map(piece=>piece.gridStart)).toEqual([2,3]);
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
    expect(newsParagraphs('one\n\n\ntwo')).toEqual(['one','two']);
    expect(newsParagraphs('hard wrapped\nPDF copy')).toEqual(['hard wrapped PDF copy']);
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
  it('preserves formatting and spacing through several exact paragraph breaks',()=>{
    const text='**aaa bbb\r\n\r\nccc ddd\r\n\r\neee fff\r\n\r\nggg hhh**';
    const result=packNews([spaced(text,[3,5,7,9])],21,0,p=>10+textOf(p.text).length);
    expect(result.overflow).toBe(false);
    expect(result.pages).toHaveLength(4);
    const pieces=result.pages.flat();
    expect(pieces.map(piece=>piece.paragraphTops?.[0])).toEqual([3,5,7,9]);
    expect(pieces.slice(1).every(piece=>piece.paragraphCut===false)).toBe(true);
    expect(pieces.every(piece=>parseRuns(piece.text).filter(run=>run.text.trim()).every(run=>run.b))).toBe(true);
    expect(pieces.map(piece=>textOf(piece.text)).join('')).toBe(textOf(text));
    expect(newsCopyHtml(pieces[0])).toBe('<p class="news-para" style="padding-top:3px"><strong>aaa bbb</strong></p>');
    expect(newsCopyHtml(pieces[1])).toBe('<p class="news-para news-para--indent" style="padding-top:5px"><strong>ccc ddd</strong></p>');
  });
  it('renders formatting that spans paragraphs consistently before pagination',()=>{
    expect(newsCopyHtml(story('bold','**first paragraph\n\nsecond paragraph**')))
      .toBe('<p class="news-para"><strong>first paragraph</strong></p><p class="news-para"><strong>second paragraph</strong></p>');
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
