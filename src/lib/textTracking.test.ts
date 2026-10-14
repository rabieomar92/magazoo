import { describe, expect, it } from 'vitest';
import { emptyDoc, migrate } from '../schema/document';
import { cloneDocForUpdate } from '../store/useDoc';
import { textTrackingCss, trackingSelector } from './textTracking';
import { paginate } from './paginate';

describe('saved letter spacing', () => {
  it('does not override the specialized cover/gate controls after switching templates', () => {
    const design = emptyDoc().design;
    design.textTracking = { title:.4,category:.1,body:.02,'block:one':.06 };
    const css = textTrackingCss(design, 'one', 'magazine-3');
    expect(css).not.toContain('0.4em'); expect(css).not.toContain('0.1em');
    expect(css).toContain('0.02em'); expect(css).toContain('0.06em');
    expect(trackingSelector('block:one')).toContain('.flow-eq');
    expect(trackingSelector('block:one')).toContain('.front-cover-teaser');
  });
  it('does not change existing documents until a spacing setting is edited', () => {
    expect(textTrackingCss(emptyDoc().design, 'one')).toBe('');
  });
  it('persists independent caption and paragraph settings and keeps undo snapshots separate', () => {
    const doc = emptyDoc(); doc.design.textTracking = { storyTag: .02, body: .03, 'block:one': -.02 };
    const restored = migrate(JSON.parse(JSON.stringify(doc)));
    expect(restored.design.textTracking).toEqual(doc.design.textTracking);
    const draft = cloneDocForUpdate(doc); draft.design.textTracking!['block:one'] = .1;
    expect(doc.design.textTracking['block:one']).toBe(-.02);
    const css = textTrackingCss(restored.design, 'first');
    expect(css).toContain('.mag2-photo-tag');
    expect(css).toContain('letter-spacing: 0.02em');
    expect(css).toContain('p[data-source-block-id="one"]');
    expect(css).not.toContain('data-tracking-scope="second"');
  });
  it('keeps local overrides after defaults and rejects unsafe values/selectors', () => {
    const doc = emptyDoc();
    doc.design.textTracking = { 'block:one': .1, body: .2, title: NaN, unknown: .2 };
    const css = textTrackingCss(doc.design, 'one');
    expect(css.lastIndexOf('0.1em')).toBeGreaterThan(css.indexOf('0.2em'));
    expect(css).not.toContain('NaN'); expect(css).not.toContain('unknown');
    expect(trackingSelector('gallery-caption:figure1')).toContain('gallery-caption-figure1');
    expect(trackingSelector('news:story1:caption')).toBe('[data-news-id="story1"] figcaption');
    expect(trackingSelector('block:"]{}')).not.toContain('"]{}');
  });
  it('measures paragraphs using the same stable selector as the rendered fragments', () => {
    let seen = false;
    const result = paginate(document.createElement('div'), document.createElement('div'), [
      { kind: 'text', sourceId: 'tracked', text: 'Measured paragraph.' },
    ], host => { if (host.querySelector('p[data-source-block-id="tracked"]')) seen = true; return false; });
    expect(seen).toBe(true);
    expect(result.pages[0][0]).toMatchObject({ sourceId: 'tracked' });
  });
});
