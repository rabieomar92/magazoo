/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { quoteFlowHtml, quoteFlowText } from './decorativeQuote';
import { paginate, type Piece } from './paginate';
import { packFrontMatter } from './frontMatterLayout';
import { Flow } from '../paper/Flow';
import { emptyDoc } from '../schema/document';
import { readFileSync } from 'node:fs';

describe('decorative paragraph quotes', () => {
  it('keeps enlarged bookends out of the text line boxes', () => {
    const style = document.createElement('style');
    const pageStyles = readFileSync('src/styles/page.css', 'utf8');
    // Isolate these production rules from print/page directives unsupported
    // by jsdom. Real line heights are additionally checked in the browser.
    style.textContent = (pageStyles.match(/\.decorative-quote[^{}]*\{[^}]*\}/g) ?? []).join('\n');
    const paragraph = document.createElement('p');
    paragraph.className = 'decorative-quote';
    paragraph.style.lineHeight = '24px';
    paragraph.innerHTML = quoteFlowHtml(quoteFlowText('Uniformly spaced quote text.', true), true);
    document.head.append(style);
    document.body.append(paragraph);
    try {
      const copy = paragraph.querySelector('.decorative-quote-copy')!;
      for (const mark of copy.querySelectorAll('.decorative-quote-mark')) {
        expect(getComputedStyle(mark).display).toBe('inline-block');
        expect(getComputedStyle(mark).height).toBe('0px');
        expect(getComputedStyle(mark).lineHeight).toBe('0');
        expect(getComputedStyle(mark.querySelector('.decorative-quote-glyph')!).fontSize).toBe('0px');
        expect(mark.getAttribute('data-quote')).toMatch(/[“”]/);
      }
    } finally {
      paragraph.remove();
      style.remove();
    }
  });
  it('leaves ordinary and empty paragraphs unchanged', () => {
    expect(quoteFlowText('Original **copy**')).toBe('Original **copy**');
    expect(quoteFlowText('  ', true)).toBe('  ');
    expect(quoteFlowHtml('Normal')).toBe('Normal');
  });
  it.each(['Words here', '“Words here”', '"Words here"', '**“Words here”**'])('adds one pair of bookends to %s', text => {
    const html = quoteFlowHtml(quoteFlowText(text, true), true, true);
    const node = document.createElement('div'); node.innerHTML = html;
    expect(node.querySelectorAll('.decorative-quote-mark')).toHaveLength(2);
    expect(node.querySelectorAll('.decorative-quote-mark--open')).toHaveLength(1);
    expect(node.querySelectorAll('.decorative-quote-mark--close')).toHaveLength(1);
    expect(node.querySelector('.drop-cap')).toBeNull();
    expect(node.textContent?.replace(/\u2060/g, '')).toBe('“Words here”');
    expect(node.textContent).toContain('“\u2060');
    expect(node.textContent).toContain('\u2060”');
    if (text.startsWith('**')) expect(node.querySelector('strong')?.textContent).toBe('Words here');
  });
  it('escapes authored HTML and does not enlarge interior quotations', () => {
    const html = quoteFlowHtml(quoteFlowText('An “inner quote” <img src=x onerror=alert(1)>', true), true);
    const node = document.createElement('div'); node.innerHTML = html;
    expect(node.querySelector('img')).toBeNull();
    expect(node.querySelectorAll('.decorative-quote-mark')).toHaveLength(2);
    expect(node.textContent).toContain('An “inner quote” <img');
  });
  it('measures and renders each bookend exactly once across page splits', () => {
    const text = quoteFlowText('Alpha beta gamma delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa.', true);
    let measuredQuote = false;
    const result = paginate(document.createElement('div'), document.createElement('div'), [{kind:'text', sourceId:'quote', text, decorativeQuote:true, fontSize:14}], el => {
      measuredQuote ||= !!el.querySelector('.decorative-quote .decorative-quote-mark');
      return (el.textContent?.length ?? 0) > 35;
    });
    const pieces = result.pages.flat().filter((piece): piece is Extract<Piece,{kind:'text'}> => piece.kind === 'text');
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.every(piece => piece.decorativeQuote && piece.fontSize === 14)).toBe(true);
    expect(pieces.map(piece => piece.text).join(' ')).toBe(text);
    expect(measuredQuote).toBe(true);
    const node = document.createElement('div');
    node.innerHTML = result.pages.map(page => renderToStaticMarkup(<Flow pieces={page} doc={emptyDoc()}/>)).join('');
    expect(node.querySelectorAll('.decorative-quote-mark')).toHaveLength(2);
    expect(node.querySelectorAll('[role=blockquote]')).toHaveLength(pieces.length);
    expect(node.querySelector('.drop-cap')).toBeNull();
  });
  it('retains quote style and bookends when dean paragraphs split', () => {
    const text = quoteFlowText('Alpha beta gamma delta echo foxtrot golf hotel india juliet kilo lima.', true);
    const packed = packFrontMatter([{id:'q',text,decorativeQuote:true}], 25, unit=>unit.text.length, 0);
    const fragments = packed.columns.flat();
    expect(fragments.length).toBeGreaterThan(1);
    expect(fragments.every(unit=>unit.decorativeQuote)).toBe(true);
    const node=document.createElement('div');node.innerHTML=fragments.map(unit=>quoteFlowHtml(unit.text,unit.decorativeQuote)).join('');
    expect(node.querySelectorAll('.decorative-quote-mark')).toHaveLength(2);
  });
});
