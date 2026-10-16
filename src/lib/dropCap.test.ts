/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { TEMPLATES } from '../store/presets';
import { makeNews } from '../store/news';
import { Flow } from '../paper/Flow';
import { NewsItem } from '../paper/NewsPages';
import { quoteFlowHtml, quoteFlowText } from './decorativeQuote';
import type { NewsPiece } from './newsLayout';
import { runsToHtml } from './richtext';
import { dropCapEnabled } from './textDirection';
import {cssVars} from './geometry';
import {fontStack,ALL_FONTS} from './fonts';

// jsdom cannot measure glyphs, baselines or line wrapping. These tests protect
// the shared CSS/markup contract; actual three-line fitting is browser-tested.
const css = readFileSync('src/styles/drop-caps.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const firstLetterRules = [...css.matchAll(/([^{}]+)::first-letter\s*\{([^{}]*)\}/g)]
  .map(([, selector, declarations]) => ({ selector: selector.trim(), declarations }));
const fallback = firstLetterRules.find(rule => /font-size-adjust:\s*cap-height\s+\.7/.test(rule.declarations))!;
const native = firstLetterRules.find(rule => /(?:^|;)\s*initial-letter:\s*3\s*;/.test(rule.declarations))!;
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
const node = (html: string) => {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
};
const marker = runsToHtml('Imagine a tiny world.', true);

describe('shared three-line drop-cap geometry', () => {
  it.each(ALL_FONTS)('follows the title font %s without changing three-line sizing',font=>{
    const doc=emptyDoc();doc.design.fontDisplay=font;
    expect(cssVars(doc.design)['--drop-cap-font']).toBe(fontStack(font));
    expect(fallback.declarations).toContain('font-family: var(--drop-cap-font, var(--serif))');
    expect(native.declarations).toMatch(/initial-letter:\s*3\s*;/);
  });
  it('follows a title toolbar override, ignores body fonts and rejects invalid imported title CSS',()=>{
    const d=emptyDoc().design;d.fontDisplay='Playfair Display';d.fontBody='Arial';d.textStyles={title:{fontFamily:'Helvetica'},body:{fontFamily:'Bebas Neue'}};
    expect(cssVars(d)['--drop-cap-font']).toBe(fontStack('Helvetica'));
    d.textStyles.title.fontFamily='Arial; } body {';
    expect(cssVars(d)['--drop-cap-font']).toBe(fontStack('Playfair Display'));
  });
  it('draws only the first-letter pseudo-element, leaving markers in the sentence', () => {
    expect(css).toMatch(/\.drop-cap\s*\{\s*all:\s*unset;\s*display:\s*inline;/);
    expect(fallback).toBeDefined();
    expect(native).toBeDefined();
    expect(normalize(native.selector)).toBe(normalize(fallback.selector));
  });

  it('uses native three-line fitting, with a paragraph-relative fallback', () => {
    expect(css).toMatch(/@supports\s*\(initial-letter:\s*3\)\s*or\s*\(-webkit-initial-letter:\s*3\)/);
    expect(native.declarations).toMatch(/-webkit-initial-letter:\s*3\s*;/);
    expect(native.declarations).toMatch(/float:\s*none\s*;/);
    expect(native.declarations).toMatch(/line-height:\s*inherit\s*;/);
    expect(fallback.declarations).toMatch(/font-size:\s*calc\(\(2lh\s*\+\s*1cap\)\s*\/\s*\.7\)/);
    expect(fallback.declarations).toMatch(/line-height:\s*3lh\s*;/);
    // A paragraph size/leading override must not leave a globally sized glyph.
    expect(fallback.declarations.match(/font-size:[^;]+/)?.[0]).not.toContain('--fs-body');
    expect(fallback.declarations.match(/line-height:[^;]+/)?.[0]).not.toContain('--fs-body');
  });

  it('removes the incompatible template-specific font-size and line-height multipliers', () => {
    for (const filename of readdirSync('src/styles').filter(name => name.endsWith('.css'))) {
      const styles = readFileSync(`src/styles/${filename}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(styles, filename).not.toMatch(/--drop-cap-(?:font-size|line-height)\s*:/);
    }
  });

  it.each(['src/App.tsx', 'src/issue/IssueRenderer.tsx'])('loads the same rules in editor and compiled issue: %s', filename => {
    const source = readFileSync(filename, 'utf8');
    expect(source.match(/import\s+['"][^'"]*styles\/drop-caps\.css['"]/g)).toHaveLength(1);
    expect(source.indexOf('styles/drop-caps.css')).toBeGreaterThan(source.indexOf('styles/news.css'));
    expect(source.indexOf('styles/drop-caps.css')).toBeGreaterThan(source.indexOf('styles/magazine.css'));
  });

  it.each(['body-cols--p1', 'p2-flow-l', 'p2-host-l', 'mag-cols--p1', 'mag2-cols'])(
    'fits visible and measuring opening paragraphs in %s, not a split continuation', region => {
      const root = node(`<div class="${region}"><p class="flow-opener">${marker}</p><p class="flow-opener cont">${marker}</p><p>${marker}</p></div>`);
      expect(root.querySelectorAll(fallback.selector)).toHaveLength(1);
      expect(root.querySelector(fallback.selector)?.className).toBe('flow-opener');
      expect(root.querySelectorAll(native.selector)).toHaveLength(1);
    },
  );

  it.each(['body-cols--p2', 'mag-cols--p2', 'p2-flow-r', 'p2-host-r', 'article-column'])(
    'does not enlarge an inert marker in continuation region %s', region => {
      const root = node(`<div class="${region}"><p class="flow-opener">${marker}</p></div>`);
      expect(root.querySelectorAll(native.selector)).toHaveLength(0);
    },
  );

  it('includes news and Dean measuring twins, without enlarging a continued Dean unit', () => {
    const root = node(`<div class="news-copy"><p>${marker}</p></div><article class="fm-paragraph"><div data-fm-text>${marker}</div></article><article class="fm-paragraph fm-continued"><div data-fm-text>${marker}</div></article>`);
    expect(root.querySelectorAll(native.selector)).toHaveLength(2);
    expect(root.querySelector('.fm-continued [data-fm-text]')?.matches(native.selector)).toBe(false);
  });

  it('disables the complete pseudo-element for the existing off toggle', () => {
    const off = firstLetterRules.find(rule => rule.selector.startsWith('.drop-caps-off'))!;
    expect(off.declarations).toMatch(/all:\s*unset\s*!important/);
    const root = node(`<div class="drop-caps-off"><div class="body-cols--p1"><p class="flow-opener">${marker}</p></div><div class="fm-paragraph"><div data-fm-text>${marker}</div></div><div class="news-copy"><p>${marker}</p></div></div>`);
    expect(root.querySelectorAll(off.selector)).toHaveLength(3);
  });
});

describe('drop-cap authored-text and continuation safety', () => {
  it.each(['Imagine a tiny world.', '**Imagine** a tiny world.', '*Imagine a tiny world.*', '__Imagine__ a tiny world.', 'E\u0301tudier les atomes.', '“Imagine a tiny world.”'])(
    'keeps every authored character and rich-text run intact: %s', text => {
      const plain = node(runsToHtml(text)).textContent;
      const decorated = node(runsToHtml(text, true));
      expect(decorated.textContent).toBe(plain);
      expect(decorated.querySelectorAll('.drop-cap')).toHaveLength(1);
      if (text.startsWith('**')) expect(decorated.querySelector('strong > .drop-cap')?.textContent).toBe('I');
      if (text.startsWith('*') && !text.startsWith('**')) expect(decorated.querySelector('em > .drop-cap')).not.toBeNull();
      if (text.startsWith('__')) expect(decorated.querySelector('u > .drop-cap')).not.toBeNull();
      if (text.startsWith('E\u0301')) expect(decorated.querySelector('.drop-cap')?.textContent).toBe('E\u0301');
    },
  );

  it.each(['العلم نور', '**العِلْم نور**', '«العلم نور»', 'فيزيک ممبنتو کيت ممهمي عالم'])(
    'never detaches Arabic or Jawi script: %s', text => {
      const root = node(runsToHtml(text, true));
      expect(root.querySelector('.drop-cap')).toBeNull();
      expect(root.textContent).toBe(node(runsToHtml(text)).textContent);
    },
  );

  it('does not turn decorative quote marks into drop capitals', () => {
    const text = quoteFlowText('Words that should keep their regular line height.', true);
    const root = node(quoteFlowHtml(text, true, true));
    expect(root.querySelector('.drop-cap')).toBeNull();
    expect(root.querySelectorAll('.decorative-quote-mark')).toHaveLength(2);
  });

  it('enlarges only the first article paragraph, not subsequent or continued flow', () => {
    const doc = emptyDoc();
    const html = renderToStaticMarkup(createElement(Flow, {
      doc,
      pieces: [
        { kind: 'text', sourceId: 'first', text: 'Imagine a tiny world.' },
        { kind: 'text', sourceId: 'second', text: 'Another paragraph follows.' },
      ],
    }));
    const root = node(`<div class="body-cols--p1">${html}</div>`);
    expect(root.querySelectorAll(native.selector)).toHaveLength(1);
    expect(root.querySelectorAll('.drop-cap')).toHaveLength(1);
    const continued = renderToStaticMarkup(createElement(Flow, {
      doc, pieces: [{ kind: 'text', sourceId: 'first', text: 'world continues on the next page.', cont: true }],
    }));
    // Existing continuation markers may remain inline for faithful text flow;
    // their presence must never re-enable a new initial on another sheet.
    expect(node(`<div class="body-cols--p1">${continued}</div>`).querySelectorAll(native.selector)).toHaveLength(0);
    expect(node(`<div class="body-cols--p2">${continued}</div>`).querySelectorAll(native.selector)).toHaveLength(0);
  });

  it('caps only the first Latin news story and never its continuation', () => {
    const doc = makeNews();
    doc.design.dropCap = true;
    const first = doc.news!.stories[0];
    const render = (piece: NewsPiece) => node(renderToStaticMarkup(createElement(NewsItem, { doc, piece })));
    expect(render({ ...first, text: 'Imagine a tiny world.\n\nA second paragraph.' }).querySelectorAll(native.selector)).toHaveLength(1);
    expect(render({ ...first, continued: true }).querySelectorAll('.drop-cap')).toHaveLength(0);
    expect(render(doc.news!.stories[1]).querySelectorAll('.drop-cap')).toHaveLength(0);
    expect(render({ ...first, text: 'العلم نور' }).querySelectorAll('.drop-cap')).toHaveLength(0);
    doc.design.dropCap = false;
    expect(render(first).querySelectorAll('.drop-cap')).toHaveLength(0);
  });

  it('retains explicit on/off behavior for every existing template', () => {
    for (const template of TEMPLATES) {
      const design = template.make().design;
      design.dropCap = false;
      expect(dropCapEnabled(design, template.id), template.id).toBe(false);
      design.dropCap = true;
      expect(dropCapEnabled(design, template.id), template.id).toBe(true);
    }
  });
});
