import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ContentsSpread } from './ContentsSpread';
import { contentsDesignOf, DEFAULT_CONTENTS_DESIGN } from './model';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it('applies all three colours to both sheets in every contents layout', () => {
  for (const layout of ['mosaic', 'feature', 'sections'] as const) {
    act(() => root.render(<ContentsSpread entries={[]} design={{ ...DEFAULT_CONTENTS_DESIGN, layout, pageColor: '#102030', textColor: '#ffffff', topBarColor: '#800080' }} />));
    const pages = [...host.querySelectorAll<HTMLElement>('.page')];
    expect(pages).toHaveLength(2);
    for (const page of pages) {
      expect(page.style.getPropertyValue('--contents-paper')).toBe('#102030');
      expect(page.style.getPropertyValue('--contents-ink')).toBe('#ffffff');
      expect(page.style.getPropertyValue('--contents-bar')).toBe('#800080');
      expect(page.style.getPropertyValue('--contents-bar-ink')).toBe('#f8fafc');
    }
  }
});

it('alternates physical masthead sides independently of folios and reading direction', () => {
  for (const layout of ['mosaic', 'feature', 'sections'] as const) for (const direction of ['ltr', 'rtl'] as const) {
    for (const mastheadSide of ['left', 'right'] as const) {
      act(() => root.render(<ContentsSpread entries={[]} startNumber={38} direction={direction} mastheadSide={mastheadSide} design={{ ...DEFAULT_CONTENTS_DESIGN, layout }} />));
      expect([...host.querySelectorAll('.issue-contents-masthead')].map(bar => bar.classList.contains('is-right')))
        .toEqual(mastheadSide === 'left' ? [false, true] : [true, false]);
    }
  }
});

it('loads older plans safely and normalises colour picker values', () => {
  expect(contentsDesignOf({})).toEqual(DEFAULT_CONTENTS_DESIGN);
  expect(contentsDesignOf({ contentsDesign: { pageColor: '#abc', textColor: '#12345', topBarColor: 'bad' } }))
    .toMatchObject({ pageColor: '#aabbcc', textColor: DEFAULT_CONTENTS_DESIGN.textColor, topBarColor: DEFAULT_CONTENTS_DESIGN.topBarColor });
});
