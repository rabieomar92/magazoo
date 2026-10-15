import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ARTICLE_LAYOUTS, type ReferenceArticleId } from '../lib/articleLayouts';
import { cssVars } from '../lib/geometry';
import { presetFor } from '../store/presets';
import { ArticlePages } from './ArticlePages';

describe('native article sheet markup', () => {
  it.each(Object.keys(ARTICLE_LAYOUTS) as ReferenceArticleId[])('%s marks the actual magazine trim on visible and measuring frames', template => {
    const doc = presetFor(template);
    doc.design.pageFormat = 'magazine';
    const before = JSON.stringify(doc);
    const html = renderToStaticMarkup(<ArticlePages doc={doc} vars={cssVars(doc.design, template)} onStatus={() => {}} readOnly />);
    expect(html).toContain('data-page-width-mm="203"');
    expect(html).toContain('data-page-height-mm="267"');
    expect(html).toContain('--page-w:203mm');
    expect(html).toContain('--page-h:267mm');
    expect(html).not.toContain('width:210mm');
    expect(JSON.stringify(doc)).toBe(before);
  });
});
