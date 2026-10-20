// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it,vi } from 'vitest';
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
  vi.unstubAllGlobals();
});

it('shows the monochrome poster safely before motion preferences are available', () => {
  act(() => root.render(<MagazooLoader label="Preparing pages" />));
  expect(host.querySelector('img')?.getAttribute('src')).toContain('magazoo-loading-mono.webp');
  expect(host.querySelector('video')).toBeNull();
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
  expect(host.querySelector('video,img')).toBeNull();
  expect(host.querySelector('.magazoo-loader-ring')).not.toBeNull();
});

it('plays the supplied compressed film silently and falls back to a still on failure',()=>{
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  act(()=>root.render(<MagazooLoader label="Loading"/>));
  const video=host.querySelector('video')!;
  expect(video.autoplay).toBe(true);expect(video.muted).toBe(true);expect(video.loop).toBe(true);expect(video.playsInline).toBe(true);
  expect(video.controls).toBe(false);expect(video.querySelector('source')?.getAttribute('type')).toBe('video/mp4');
  act(()=>video.dispatchEvent(new Event('error')));
  expect(host.querySelector('video')).toBeNull();expect(host.querySelector('img')).not.toBeNull();
});
it('keeps a still frame when reduced motion is requested',()=>{
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  act(()=>root.render(<MagazooLoader/>));
  expect(host.querySelector('video')).toBeNull();expect(host.querySelector('img')).not.toBeNull();
});
