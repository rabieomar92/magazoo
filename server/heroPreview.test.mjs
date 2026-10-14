import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heroSource, imageResponse } from './heroPreview.mjs';

test('card preview selects the hero, then cover, without using unrelated saved assets', () => {
  const doc = { hero: { assetId: 'hero' }, cover: { assetId: 'cover' },
    assets: { hero: { src: 'hero.png' }, cover: { src: 'cover.png' }, unused: { src: 'private.png' } } };
  assert.equal(heroSource(JSON.stringify(doc)), 'hero.png');
  delete doc.assets.hero;
  assert.equal(heroSource(JSON.stringify(doc)), 'cover.png');
  delete doc.assets.cover;
  assert.equal(heroSource(JSON.stringify(doc)), null);
  assert.equal(heroSource('private damaged JSON'), null);
  assert.equal(heroSource(JSON.stringify({ templateId: 5, assets: [] })), null);
});

test('galleries choose their central photo and news chooses the first story image when no hero is set', () => {
  const blocks = [{ type: 'figure', assetId: 'first' }, { type: 'figure', assetId: 'fold' }];
  const assets = { first: { src: 'first.png' }, fold: { src: 'fold.png' } };
  assert.equal(heroSource(JSON.stringify({ templateId: 'gallery-1', blocks, assets })), 'fold.png');
  assert.equal(heroSource(JSON.stringify({ templateId: 'gallery-2', blocks, assets })), 'first.png');
  assert.equal(heroSource(JSON.stringify({ templateId: 'news-1', news: { stories: [{ assetId: 'missing' }, { assetId: 'fold' }] }, assets })), 'fold.png');
});

test('preview decoding supports embedded raster files and existing URL-encoded SVG artwork', () => {
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const image = imageResponse(`data:image/png;base64,${bytes.toString('base64')}`, 'https://example.org/');
  assert.equal(image.type, 'image/png');
  assert.deepEqual(image.bytes, bytes);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Magazoo!</text></svg>';
  assert.equal(imageResponse(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, 'https://example.org/').bytes.toString(), svg);
  assert.equal(imageResponse(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, 'https://example.org/').type, 'image/svg+xml');
  for (const source of ['data:text/html;base64,PHNjcmlwdD4=', 'data:image/png;base64,!!!', 'data:image/png;unknown,x', 'data:image/svg+xml,%ZZ', 'data:image/png;base64,']) {
    assert.equal(imageResponse(source, 'https://example.org/'), null);
  }
});

test('legacy redirects allow image URLs only, never unsafe protocols, credentials or authenticated API paths', () => {
  const origin = 'https://example.org/magazoo/';
  assert.deepEqual(imageResponse('https://images.example.org/photo.jpg?size=small', origin), { location: 'https://images.example.org/photo.jpg?size=small' });
  assert.deepEqual(imageResponse('images/photo.png', origin), { location: 'https://example.org/magazoo/images/photo.png' });
  assert.deepEqual(imageResponse('/photo.png', 'http://127.0.0.1:8791/'), { location: 'http://127.0.0.1:8791/photo.png' });
  for (const source of ['javascript:photo.png', 'file:///private.png', 'blob:https://example.org/photo.png', 'http://images.example.org/photo.jpg', 'https://user:password@images.example.org/photo.jpg', 'https://example.org/api/private.png', '/magazoo/api/private.svg', 'https://images.example.org/document.html']) {
    assert.equal(imageResponse(source, origin), null);
  }
});
