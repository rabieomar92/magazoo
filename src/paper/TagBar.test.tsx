import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { TagBar } from './TagBar';

describe('TagBar', () => {
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
});
