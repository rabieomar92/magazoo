import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanOrphanedAssets, emptyDoc, type Doc } from '../schema/document';
import { hydrateSerializationMessage, type SerializationAssets, type SerializationMessage } from './serializeProtocol';

/** Match the browser's FIFO cloning boundary without timing-dependent tests. */
class SerializationWorker {
  static instances: SerializationWorker[] = [];
  onmessage: ((event: { data: { id: number; text?: string; error?: string } }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  messages: SerializationMessage[] = [];
  assets: SerializationAssets = {};
  failNextPost = false;
  terminated = false;
  pending: SerializationMessage[] = [];
  constructor() { SerializationWorker.instances.push(this); }
  postMessage(message: SerializationMessage) {
    if (this.failNextPost) {
      this.failNextPost = false;
      throw new DOMException('Cannot clone this document', 'DataCloneError');
    }
    const cloned = structuredClone(message);
    this.messages.push(cloned);
    this.pending.push(cloned);
  }
  flush() {
    for (const message of this.pending.splice(0)) {
      try {
        const hydrated = hydrateSerializationMessage(message, this.assets);
        this.assets = hydrated.assets;
        this.onmessage?.({ data: { id: message.id, text: JSON.stringify(cleanOrphanedAssets(hydrated.doc)) } });
      } catch (error) {
        this.onmessage?.({ data: { id: message.id, error: error instanceof Error ? error.message : String(error) } });
      }
    }
  }
  terminate() { this.terminated = true; }
}

function imageDocument(): Doc {
  const doc = emptyDoc();
  doc.assets.photo = { src: `data:image/jpeg;base64,${'a'.repeat(2 * 1024 * 1024)}`, naturalWidth: 1600, naturalHeight: 1200 };
  doc.hero.assetId = 'photo';
  return doc;
}

beforeEach(() => {
  vi.resetModules();
  SerializationWorker.instances = [];
  vi.stubGlobal('Worker', SerializationWorker);
});
afterEach(() => vi.unstubAllGlobals());

describe('document serialization worker asset deltas', () => {
  it('sends each unchanged photo once across concurrent text edits, while preserving complete JSON', async () => {
    const { serializeDocument } = await import('./serializeDocument');
    const first = imageDocument();
    const second = { ...first, assets: { photo: { ...first.assets.photo } }, meta: { ...first.meta, title: 'A second edit' } };
    const third = { ...second, meta: { ...second.meta, title: 'A third edit' } };
    const saves = [first, second, third].map(serializeDocument);
    const worker = SerializationWorker.instances[0];
    expect(worker.messages).toHaveLength(3);
    expect(worker.messages.map(message => Object.keys(message.changedAssets).length)).toEqual([1, 0, 0]);
    expect(worker.messages.every(message => !Object.hasOwn(message.doc, 'assets'))).toBe(true);
    const sentPhotoCharacters = worker.messages.reduce((total, message) => total + Object.values(message.changedAssets).reduce((count, asset) => count + asset.src.length, 0), 0);
    expect(sentPhotoCharacters).toBe(first.assets.photo.src.length);
    expect(JSON.stringify(worker.messages[1]).length).toBeLessThan(10_000);
    worker.flush();
    const restored = (await Promise.all(saves)).map(text => JSON.parse(text));
    expect(restored.map(doc => doc.meta.title)).toEqual([first.meta.title, second.meta.title, third.meta.title]);
    expect(restored.every(doc => doc.assets.photo.src === first.assets.photo.src)).toBe(true);
  });

  it('sends source and dimension changes, drops removed assets, and re-sends an asset when reintroduced', async () => {
    const { serializeDocument } = await import('./serializeDocument');
    const first = imageDocument();
    const changed = { ...first, assets: { photo: { ...first.assets.photo, src: 'data:image/png;base64,replacement', naturalWidth: 700 } } };
    const resized = { ...changed, assets: { photo: { ...changed.assets.photo, naturalHeight: 900 } } };
    const removed = { ...resized, assets: {}, hero: { ...resized.hero, assetId: null } };
    const saves = [first, changed, resized, removed].map(serializeDocument);
    const worker = SerializationWorker.instances[0];
    expect(worker.messages.map(message => Object.keys(message.changedAssets).length)).toEqual([1, 1, 1, 0]);
    worker.flush();
    const restored = (await Promise.all(saves)).map(text => JSON.parse(text));
    expect(restored[1].assets.photo).toEqual(changed.assets.photo);
    expect(restored[2].assets.photo.naturalHeight).toBe(900);
    expect(restored[3].assets).toEqual({});
    expect(Object.keys(worker.assets)).toEqual([]);
    const reintroduced = serializeDocument(first);
    expect(worker.messages.at(-1)?.changedAssets.photo.src).toBe(first.assets.photo.src);
    worker.flush();
    expect(JSON.parse(await reintroduced).assets.photo).toEqual(first.assets.photo);
    expect(Object.keys(worker.assets)).toEqual(['photo']);
  });

  it('keeps orphan cleanup isolated from cached images and from the live document', async () => {
    const { serializeDocument } = await import('./serializeDocument');
    const orphan = imageDocument();
    orphan.hero.assetId = null;
    const later = { ...orphan, hero: { ...orphan.hero, assetId: 'photo' } };
    const first = serializeDocument(orphan);
    const second = serializeDocument(later);
    const worker = SerializationWorker.instances[0];
    worker.flush();
    expect(JSON.parse(await first).assets).toEqual({});
    expect(JSON.parse(await second).assets.photo).toEqual(orphan.assets.photo);
    expect(worker.messages[1].changedAssets).toEqual({});
    expect(orphan.assets.photo).toBeDefined();
    expect(worker.assets.photo).toBeDefined();
  });

  it('does not advance its cache after a rejected postMessage', async () => {
    const { serializeDocument } = await import('./serializeDocument');
    const first = imageDocument();
    const initial = serializeDocument(first);
    const worker = SerializationWorker.instances[0];
    worker.flush();
    await initial;
    const changed = { ...first, assets: { photo: { ...first.assets.photo, src: 'replacement' } } };
    worker.failNextPost = true;
    await expect(serializeDocument(changed)).rejects.toThrow('Cannot clone');
    const retry = serializeDocument(changed);
    expect(worker.messages.at(-1)?.changedAssets.photo.src).toBe('replacement');
    worker.flush();
    expect(JSON.parse(await retry).assets.photo.src).toBe('replacement');
  });

  it.each(['onerror', 'onmessageerror'] as const)('re-sends assets after %s and ignores delayed events from the failed worker', async failure => {
    const { serializeDocument } = await import('./serializeDocument');
    const doc = imageDocument();
    const failedSave = serializeDocument(doc);
    const oldWorker = SerializationWorker.instances[0];
    const rejection = expect(failedSave).rejects.toThrow('Unable to prepare');
    oldWorker[failure]?.();
    await rejection;
    expect(oldWorker.terminated).toBe(true);
    const retry = serializeDocument(doc);
    const newWorker = SerializationWorker.instances[1];
    expect(newWorker.messages[0].changedAssets.photo.src).toBe(doc.assets.photo.src);
    oldWorker.onerror?.();
    oldWorker.flush();
    expect(newWorker.terminated).toBe(false);
    newWorker.flush();
    expect(JSON.parse(await retry).assets.photo.src).toBe(doc.assets.photo.src);
  });

  it('retains the latest asset cache after a serialization error so later jobs remain aligned', async () => {
    const { serializeDocument } = await import('./serializeDocument');
    const doc = imageDocument();
    const invalid = { ...doc, meta: { ...doc.meta, invalid: 1n } } as unknown as Doc;
    const rejected = serializeDocument(invalid);
    const rejection = expect(rejected).rejects.toThrow();
    const recovered = serializeDocument(doc);
    const worker = SerializationWorker.instances[0];
    expect(worker.messages[1].changedAssets).toEqual({});
    worker.flush();
    await rejection;
    expect(JSON.parse(await recovered).assets.photo.src).toBe(doc.assets.photo.src);
  });
});
