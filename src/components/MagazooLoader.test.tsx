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

it('uses the canonical mark for the base and independently moving animal layers', () => {
  act(() => root.render(<MagazooLoader label="Preparing pages" />));
  const images = [...host.querySelectorAll('img')];
  expect(images).toHaveLength(7);
  expect(new Set(images.map(image => image.getAttribute('src'))).size).toBe(1);
  expect(images[0].getAttribute('src')).toContain('magazoo-mark.png');
  expect(host.querySelectorAll('.magazoo-loader-animal')).toHaveLength(6);
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
