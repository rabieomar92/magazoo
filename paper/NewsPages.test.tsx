import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { makeNews } from '../store/news';
import { NewsItem } from './NewsPages';

describe('brief rendering',()=>{
  it('uses embedded photos, captions and editor targets',()=>{
    const doc=makeNews();const piece=doc.news!.stories[0];
    const html=renderToStaticMarkup(<NewsItem piece={piece} doc={doc}/>);
    expect(html).toContain('<img');expect(html).toContain(piece.caption);
    expect(html).toContain(`news-photo-${piece.id}`);
  });
  it('omits the photo on continued stories and when photo position is none',()=>{
    const doc=makeNews();const piece=doc.news!.stories[0];
    expect(renderToStaticMarkup(<NewsItem piece={{...piece,continued:true}} doc={doc}/>)).not.toContain('<img');
    expect(renderToStaticMarkup(<NewsItem piece={{...piece,layout:'text',photoPosition:'none'}} doc={doc}/>)).not.toContain('<img');
    expect(renderToStaticMarkup(<NewsItem piece={{...piece,layout:'single',photoPosition:'none'}} doc={doc}/>)).not.toContain('<img');
    expect(renderToStaticMarkup(<NewsItem piece={{...piece,layout:'single',photoPosition:'none'}} doc={doc}/>)).toContain('news-story--single');
    expect(renderToStaticMarkup(<NewsItem piece={{...piece,layout:'aside',photoPosition:'none'}} doc={doc}/>)).not.toContain('<img');
  });
  it('marks a side column and the narrowed story it runs beside',()=>{
    const doc=makeNews();const piece=doc.news!.stories[0];
    expect(renderToStaticMarkup(<NewsItem piece={{...piece,layout:'aside'}} doc={doc}/>)).toContain('news-story--aside');
    const main=renderToStaticMarkup(<NewsItem piece={{...piece,pair:'main'}} doc={doc}/>);
    expect(main).toContain('news-story--paired');
    expect(main).toContain('<img');
    expect(renderToStaticMarkup(<NewsItem piece={piece} doc={doc}/>)).not.toContain('news-story--paired');
  });
  it('prints paragraph blocks and their top-to-text spacing',()=>{
    const doc=makeNews();const piece=doc.news!.stories[0];
    const html=renderToStaticMarkup(<NewsItem piece={{...piece,text:'one\n\ntwo',paragraphTops:[0,16]}} doc={doc}/>);
    expect(html).toContain('<p class="news-para">one</p>');
    expect(html).toContain('padding-top:16px');
    expect(renderToStaticMarkup(<NewsItem piece={piece} doc={doc}/>)).not.toContain('padding-top');
  });
  it('renders newsroom furniture, photo credit and accessible image text',()=>{
    const doc=makeNews();const piece={...doc.news!.stories[0],kicker:'RESEARCH',deck:'A concise standfirst.',byline:'By the campus desk',photoCredit:'ATLAS Collaboration',photoAlt:'A detector event rendered as coloured tracks'};
    const html=renderToStaticMarkup(<NewsItem piece={piece} doc={doc}/>);
    expect(html).toContain('RESEARCH');
    expect(html).toContain('A concise standfirst.');
    expect(html).toContain('By the campus desk');
    expect(html).toContain('ATLAS Collaboration');
    expect(html).toContain('aria-label="A detector event rendered as coloured tracks"');
  });
  it('carries per-story typography and frame settings into the printed markup',()=>{
    const doc=makeNews();const piece={...doc.news!.stories[0],headlineSize:31,bodySize:10.5,lineHeight:1.6,photoHeight:64,photoFit:'contain' as const};
    const html=renderToStaticMarkup(<NewsItem piece={piece} doc={doc}/>);
    expect(html).toContain('--news-headline-size:31pt');
    expect(html).toContain('--news-body-size:10.5pt');
    expect(html).toContain('--news-line-height:1.6');
    expect(html).toContain('data-news-photo-fit="contain"');
  });
  it('prints a source only on the final fragment of a continued story',()=>{
    const doc=makeNews();const piece={...doc.news!.stories[0],source:'https://example.test/source'};
    const opening=renderToStaticMarkup(<NewsItem piece={{...piece,continues:true}} doc={doc}/>);
    const ending=renderToStaticMarkup(<NewsItem piece={{...piece,continued:true,continues:false}} doc={doc}/>);
    expect(opening).not.toContain('https://example.test/source');
    expect(ending).toContain('https://example.test/source');
  });
  it('caps only the opening Latin story when requested, never Arabic',()=>{
    const doc=makeNews();doc.design.dropCap=true;const piece=doc.news!.stories[0];
    expect(renderToStaticMarkup(<NewsItem piece={piece} doc={doc}/>)).toContain('class="drop-cap"');
    expect(renderToStaticMarkup(<NewsItem piece={doc.news!.stories[1]} doc={doc}/>)).not.toContain('class="drop-cap"');
    expect(renderToStaticMarkup(<NewsItem piece={{...piece,text:'العلم يفتح آفاقاً جديدة'}} doc={doc}/>)).not.toContain('class="drop-cap"');
  });
});
