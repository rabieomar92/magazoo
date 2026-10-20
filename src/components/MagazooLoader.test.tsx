// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { MagazooLoader } from './MagazooLoader';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it('shows a minimal spinner and label without decorative artwork', () => {
  act(() => root.render(<MagazooLoader label="Preparing pages" />));
  expect(host.querySelector('.magazoo-loader-ring')).not.toBeNull();
  expect(host.querySelector('img,svg,.magazoo-loader-mark')).toBeNull();
  expect(host.querySelector('.magazoo-loader-animal,.magazoo-animal-gait')).toBeNull();
  expect(host.querySelector('mask,use')).toBeNull();
  expect(host.querySelector('.magazoo-loader-shine')).toBeNull();
  expect(host.querySelector('[role="progressbar"]')).toBeNull();
  expect(host.querySelector('[role="status"]')?.textContent).toContain('Preparing pages');
});

it('exposes determinate compilation progress to assistive technology', () => {
  act(() => root.render(<MagazooLoader label="Numbering pages" value={3} max={8} />));
  const progress = host.querySelector('[role="progressbar"]');
  expect(progress?.getAttribute('aria-valuenow')).toBe('3');
  expect(progress?.getAttribute('aria-valuemax')).toBe('8');
  expect(progress?.getAttribute('style')).toContain('37.5%');
});

it('keeps the inline wait state compact and omits the progress track', () => {
  act(() => root.render(<MagazooLoader variant="inline" label="Optimising image…" />));
  expect(host.querySelector('.magazoo-loader.is-inline')).not.toBeNull();
  expect(host.querySelector('[role="progressbar"]')).toBeNull();
});
