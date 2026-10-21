import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';

it('shares comfortable caption insets across templates, measurement and PDF',()=>{
 const css=readFileSync('src/styles/caption-spacing.css','utf8');
 for(const selector of ['.page','.pages','.measure-root','.article-measure','.fm-measure','.news-measure','.pdf-export-pages','.placed-image > figcaption','.hero-caption','.free-hero-caption','.article-hero-caption','.article-inset-caption','.p2-hero-cap','.mag2-photo-tag','.fm-board-caption','.g-img .g-cap'])expect(css).toContain(selector);
 expect(css).toContain('.news-story figcaption');
 expect(css).toContain('padding:var(--caption-padding-block,0mm) var(--caption-padding-inline,0mm) !important');
 expect(css).toContain('padding: var(--caption-padding-block,2.5mm) var(--caption-padding-inline,3mm) !important');
 expect(css).toContain('box-sizing: border-box !important');
 expect(css).not.toContain('.g-img figcaption');
 expect(css).not.toMatch(/(?:^|\n)\s*(?:width|height|opacity|color):/);
 expect(readFileSync('src/styles/page.css','utf8')).toContain("@import './caption-spacing.css'");
});
