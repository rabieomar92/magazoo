import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { articleGeometry } from '../lib/articleLayouts';
import { cssVars } from '../lib/geometry';
import { textStylesCss } from '../lib/textStyles';
import { textTrackingCss } from '../lib/textTracking';
import { TOP_BAR_HEIGHT_MM } from '../lib/topBar';
import { presetFor, TEMPLATE_META } from '../store/presets';
import { TagBar } from './TagBar';
import { MagPhotoPage } from './MagSplitCover';

const css = (name: string) => readFileSync(`${process.cwd()}/src/styles/${name}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const declarations = (source: string, selector: string) => {
  const found = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(match => match[1].trim() === selector);
  expect(found, `Missing CSS rule ${selector}`).toBeTruthy();
  return found![2].replace(/\s+/g, ' ');
};

describe('one Particle Feature running bar across every template', () => {
  it.each(TEMPLATE_META.map(meta => meta.id))('%s uses the same selectable label, square, issue and alternating arrangement', templateId => {
    const doc = presetFor(templateId);
    doc.design.showTopBar = true;
    doc.design.barSide = 'left';
    doc.meta.masthead = ' LEARN PHYSICS ';
    doc.meta.volume = ' ISSUE 2026 ';
    const before = JSON.stringify(doc);
    const bars = [0, 1, 2].map(pageIndex => {
      const host = document.createElement('div');
      host.innerHTML = renderToStaticMarkup(<TagBar doc={doc} pageIndex={pageIndex} />);
      return host.firstElementChild!;
    });
    for (const bar of bars) {
      expect([...bar.children].map(node => node.className)).toEqual(['tag-bar-mark', 'tag-bar-tag', 'tag-bar-fill']);
      expect(bar.querySelector('.tag-bar-tag')?.textContent).toBe('LEARN PHYSICS');
      expect(bar.querySelector('.tag-bar-detail')?.textContent).toBe('ISSUE 2026');
      expect(bar.getAttribute('data-editor-target')).toBe('design-topbar');
      expect(bar.querySelector('.tag-bar-tag')?.getAttribute('data-editor-target')).toBe('meta-masthead');
      expect(bar.querySelector('.tag-bar-detail')?.getAttribute('data-editor-target')).toBe('meta-volume');
    }
    expect(bars.map(bar => bar.classList.contains('tag-bar--flip'))).toEqual([false, true, false]);
    expect(JSON.stringify(doc)).toBe(before);
    doc.design.barSide = 'right';
    expect(renderToStaticMarkup(<TagBar doc={doc} pageIndex={0} />)).toContain('tag-bar--flip');
    expect(renderToStaticMarkup(<TagBar doc={doc} pageIndex={1} />)).not.toContain('tag-bar--flip');
    doc.design.showTopBar = false;
    expect(renderToStaticMarkup(<TagBar doc={doc} pageIndex={0} />)).toBe('');
  });

  it('keeps explicit issue suppression, custom typography, colours and offsets available', () => {
    const doc = presetFor('paper-4');
    doc.meta.volume = 'Not shown when explicitly suppressed';
    doc.design.textStyles = { masthead: { fontFamily: 'Arial', fontSize: 10, fontWeight: 700, italic: true, color: '#123456' } };
    doc.design.textTracking = { masthead: .22 };
    doc.design.topBarOffset = 23;
    doc.design.barColor = '#234567';
    expect(renderToStaticMarkup(<TagBar doc={doc} pageIndex={0} detail="" />)).not.toContain('tag-bar-detail');
    const style = textStylesCss(doc.design, 'proof');
    for (const expected of ['font-family:Arial', 'font-size:10pt', 'font-weight:700', 'font-style:italic', 'color:#123456']) expect(style).toContain(expected);
    expect(textTrackingCss(doc.design, 'proof', doc.templateId)).toContain('letter-spacing: 0.22em !important');
    expect(cssVars(doc.design, doc.templateId)['--topbar-offset']).toBe('23mm');
    expect(renderToStaticMarkup(<TagBar doc={doc} pageIndex={0} fullBleed />)).toContain('margin-left:calc(-1 * var(--margin))');
  });

  it('pins the shared default to the original Particle Feature typography instead of article body or category fonts', () => {
    const shared = css('page.css');
    const band = declarations(shared, '.tag-bar');
    const mark = declarations(shared, '.tag-bar-mark');
    const tag = declarations(shared, '.tag-bar-tag');
    expect(TOP_BAR_HEIGHT_MM).toBe(6);
    expect(band).toContain('height: var(--bar-h, 6mm)');
    expect(band).toContain("font-family: 'Avenir Next LT Pro Light'");
    expect(band).toContain('font-weight: 400');
    expect(band).toContain('font-style: normal');
    expect(band).toContain('line-height: 1');
    expect(mark).toContain('width: var(--bar-h, 6mm)');
    expect(tag).toContain('font-size: 7.225pt');
    expect(tag).toContain('padding: 0 0.9em');
    expect(tag).toContain('letter-spacing: 0.14em');
    expect(tag).toContain('font-family: inherit');
    expect(tag).toContain('line-height: 1');
    expect(band + tag).not.toMatch(/var\(--(?:sans|font-category|fs-eyebrow)/);
  });

  it('allows reference articles to position, but not restyle, the shared bar or shrink its content reservation', () => {
    const reference = css('article-layouts.css');
    const bar = declarations(reference, '.article-page > .tag-bar');
    expect(bar).toContain('top:var(--topbar-offset)');
    expect(bar).not.toMatch(/(?:height|font-size|font-family|letter-spacing)\s*:/);
    expect(reference).not.toMatch(/\.article-page\s+\.tag-bar-(?:mark|tag|fill)\s*\{/);
    const doc = presetFor('paper-4');
    doc.design.topBarOffset = 24;
    doc.design.gutter = 5;
    expect(articleGeometry('paper-4', doc.design).contentTop).toBe(24 + TOP_BAR_HEIGHT_MM + 5);
  });

  it('anchors the empty Particle Feature photo sheet without subtracting nonexistent page padding', () => {
    const doc = presetFor('magazine-2');
    doc.design.showHero = false;
    doc.meta.masthead = 'LEARN PHYSICS';
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<MagPhotoPage doc={doc} vars={{}} pageIndex={1} />);
    expect(host.querySelector('.mag2-photo--empty > .tag-bar--flip')).not.toBeNull();
    expect(host.querySelector('.tag-bar')?.getAttribute('style')).toBeNull();
    const placement = declarations(css('magazine.css'), '.mag2-photo--empty > .tag-bar');
    expect(placement).toContain('inset: var(--topbar-offset, 10mm) 0 auto');
    expect(placement).toContain('margin: 0');
  });
});
