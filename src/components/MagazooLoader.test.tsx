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

it('renders one animal-free lettering layer and eight independently moving characters', () => {
  act(() => root.render(<MagazooLoader label="Preparing pages" />));
  expect(host.querySelectorAll('.magazoo-loader-base')).toHaveLength(1);
  expect(host.querySelector('.magazoo-loader-base')?.getAttribute('href')).toContain('magazoo-letters.png');
  expect(host.querySelectorAll('.magazoo-loader-animal')).toHaveLength(8);
  expect(host.querySelectorAll('.magazoo-animal-gait')).toHaveLength(8);
  expect([...host.querySelectorAll('.magazoo-animal-gait')].every(frame => frame.getAttribute('href')?.includes('magazoo-animals.png'))).toBe(true);
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
