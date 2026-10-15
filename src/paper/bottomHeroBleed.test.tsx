import { readFileSync } from 'node:fs';
import { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { cssVars } from '../lib/geometry';
import { migrate, type Doc } from '../schema/document';
import { presetFor } from '../store/presets';
import { Page1 } from './Page1';
import { PageFooters } from './PageFooters';

describe('bottom hero trim bleed', () => {
  it('keeps Paper 3 opt-in and preserves the setting through JSON round trips', () => {
    const doc = presetFor('paper-3');
    doc.design.heroAtBottom = true;
    const legacy = renderToStaticMarkup(<Page1 doc={doc} vars={cssVars(doc.design, doc.templateId)} pieces={[]} />);
    expect(legacy).toContain('page--hero-bottom');
    expect(legacy).not.toContain('page--hero-bottom-bleed');
    doc.design.heroBottomBleed = true;
    const saved = migrate(JSON.parse(JSON.stringify(doc)));
    expect(saved.design.heroBottomBleed).toBe(true);
    const html = renderToStaticMarkup(<Page1 doc={saved} vars={cssVars(saved.design, saved.templateId)} pieces={[]} />);
    expect(html).toContain('page--hero-bottom-bleed');
    expect(html).toContain('data-image-fit="cover"');
    saved.design.showHero = false;
    expect(renderToStaticMarkup(<Page1 doc={saved} vars={cssVars(saved.design, saved.templateId)} pieces={[]} />))
      .not.toContain('page--hero-bottom-bleed');
  });

  it.each(['paper-3','paper-4','paper-5','paper-6','paper-7','paper-8'] as const)('%s retains an editable, readable footer over only the bleeding opening photo', template => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const doc = presetFor(template);
    doc.design.heroAtBottom = true;
    doc.design.heroBottomBleed = true;
    doc.footer = { ...doc.footer, enabled: true, text: 'Magazoo! · Photo edition', bottomOffset: 8 };
    function Sheets({ source }: { source: Doc }) {
      const pages = useRef<HTMLDivElement>(null);
      return <><div ref={pages}><div className="page page--hero-bottom-bleed" /><div className="page" /></div>
        <PageFooters doc={source} root={pages} /></>;
    }
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(<Sheets source={doc} />));
    const footers = [...host.querySelectorAll<HTMLElement>('.page-folio')];
    expect(footers).toHaveLength(2);
    expect(footers[0].classList.contains('page-folio--photo-overlay')).toBe(true);
    expect(footers[0].style.color).toBe('rgb(255, 255, 255)');
    expect(footers[0].style.paddingBottom).toBe('8mm');
    expect(footers[0].querySelector('[data-editor-target="footer-text"]')?.textContent).toBe(doc.footer.text);
    expect(footers[1].classList.contains('page-folio--photo-overlay')).toBe(false);
    act(() => root.render(<Sheets source={{ ...doc, design: { ...doc.design, heroBottomBleed: false } }} />));
    expect(host.querySelector('.page-folio--photo-overlay')).toBeNull();
    act(() => root.unmount());
    host.remove();
  });

  it('uses an edge-anchored photo and non-opaque print-safe footer instead of a blank trim band', () => {
    const styles = readFileSync('src/styles/paper3-footer.css', 'utf8');
    expect(styles).toMatch(/\.page--hero-bottom \.hero\s*\{[^}]*inset:\s*auto 0 0;/s);
    expect(styles).toMatch(/\.page\.page--hero-bottom-bleed > \.page-folio--photo-overlay\s*\{[^}]*z-index:\s*14;[^}]*background:\s*linear-gradient\(to bottom, transparent,/s);
    const articleStyles = readFileSync('src/styles/article-layouts.css', 'utf8');
    expect(articleStyles).toMatch(/\.article-hero--bottom-bleed > \.article-hero-caption\s*\{[^}]*top:auto;[^}]*bottom:var\(--hero-bottom-caption-clearance,/s);
  });
});
