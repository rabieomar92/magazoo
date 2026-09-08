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
  it('omits the photo on continued and text-only stories',()=>{
    const doc=makeNews();const piece=doc.news!.stories[0];
    expect(renderToStaticMarkup(<NewsItem piece={{...piece,continued:true}} doc={doc}/>)).not.toContain('<img');
    expect(renderToStaticMarkup(<NewsItem piece={{...piece,layout:'text'}} doc={doc}/>)).not.toContain('<img');
    expect(renderToStaticMarkup(<NewsItem piece={{...piece,layout:'single'}} doc={doc}/>)).not.toContain('<img');
    expect(renderToStaticMarkup(<NewsItem piece={{...piece,layout:'single'}} doc={doc}/>)).toContain('news-story--single');
    expect(renderToStaticMarkup(<NewsItem piece={{...piece,layout:'aside'}} doc={doc}/>)).not.toContain('<img');
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
  it('caps only the opening Latin story when requested, never Arabic',()=>{
    const doc=makeNews();doc.design.dropCap=true;const piece=doc.news!.stories[0];
    expect(renderToStaticMarkup(<NewsItem piece={piece} doc={doc}/>)).toContain('class="drop-cap"');
    expect(renderToStaticMarkup(<NewsItem piece={doc.news!.stories[1]} doc={doc}/>)).not.toContain('class="drop-cap"');
    expect(renderToStaticMarkup(<NewsItem piece={{...piece,text:'العلم يفتح آفاقاً جديدة'}} doc={doc}/>)).not.toContain('class="drop-cap"');
  });
});
