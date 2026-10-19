import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { TagBar } from './TagBar';

describe('TagBar', () => {
  it('tracks the text margin by default, mirrors it, and supports the legacy short stub opt-out',()=>{
    const doc=emptyDoc();doc.meta.masthead='Physics';doc.design.margin=14;doc.design.bleedCanvas=true;doc.design.bleedMm=5;
    for(const side of ['left','right'] as const){doc.design.barSide=side;const host=document.createElement('div');host.innerHTML=renderToStaticMarkup(<TagBar doc={doc} pageIndex={0}/>);expect(host.querySelector<HTMLElement>('.tag-bar-mark')!.style.width).toBe('var(--margin)');}
    doc.design.mastheadAlignMargin=false;expect(renderToStaticMarkup(<TagBar doc={doc} pageIndex={0}/>)).toContain('calc(var(--bar-h, 6mm) + 5mm)');
  });
  it('never substitutes the affiliation for dedicated top-bar text', () => {
    const doc = emptyDoc();
    doc.meta.affiliation = 'School of Physics';
    const html = renderToStaticMarkup(<TagBar doc={doc} pageIndex={0} />);
    expect(html).not.toContain('School of Physics');
    expect(html).not.toContain('tag-bar-tag');
  });

  it('alternates from the author-selected first-page side', () => {
    const doc = emptyDoc();
    doc.meta.masthead = 'Physics';
    doc.design.barSide = 'right';
    expect(renderToStaticMarkup(<TagBar doc={doc} pageIndex={0} />)).toContain(
      'tag-bar--flip',
    );
    expect(renderToStaticMarkup(<TagBar doc={doc} pageIndex={1} />)).not.toContain(
      'tag-bar--flip',
    );
  });

  it('publishes separate preview targets for the bar surface and its text', () => {
    const doc = emptyDoc();
    doc.meta.masthead = 'Physics';
    const html = renderToStaticMarkup(<TagBar doc={doc} pageIndex={0} />);
    expect(html).toContain('data-editor-target="design-topbar"');
    expect(html).toContain('data-editor-target="meta-masthead"');
  });
});
