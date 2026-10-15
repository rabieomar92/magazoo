import type { Asset, Doc } from '../schema/document';

export type SerializationAssets = Record<string, Asset>;

export interface SerializationMessage {
  id: number;
  doc: Omit<Doc, 'assets'>;
  /** The complete current key order also bounds the worker's retained cache. */
  assetIds: string[];
  changedAssets: SerializationAssets;
}

function sameAsset(left: Asset | undefined, right: Asset): boolean {
  if (!left) return false;
  const keys = Object.keys(right) as (keyof Asset)[];
  return Object.keys(left).length === keys.length &&
    keys.every(key => Object.hasOwn(left, key) && Object.is(left[key], right[key]));
}

/** Copy small asset records, while sharing their immutable source strings. */
export function serializationMessage(
  id: number,
  doc: Doc,
  previous: SerializationAssets,
): { message: SerializationMessage; assets: SerializationAssets } {
  const { assets, ...content } = doc;
  const entries = Object.entries(assets);
  const snapshot = Object.fromEntries(entries.map(([key, asset]) => [key, { ...asset }]));
  const changedAssets = Object.fromEntries(
    entries.filter(([key, asset]) => !sameAsset(previous[key], asset))
      .map(([key]) => [key, snapshot[key]]),
  );
  return {
    message: { id, doc: content, assetIds: entries.map(([key]) => key), changedAssets },
    assets: snapshot,
  };
}

/** Rebuild only this message's asset set; removed photos are not retained. */
export function hydrateSerializationMessage(message: SerializationMessage, previous: SerializationAssets) {
  const assets = Object.fromEntries(message.assetIds.map(key => {
    const source = Object.hasOwn(message.changedAssets, key)
      ? message.changedAssets[key]
      : Object.hasOwn(previous, key) ? previous[key] : undefined;
    if (!source) throw new Error('The document image cache is incomplete. Please save again.');
    return [key, source];
  }));
  // Orphan cleanup deletes entries. Give it a separate dictionary so a later
  // edit can reference an asset that this document has not used yet.
  return { assets, doc: { ...message.doc, assets: { ...assets } } as Doc };
}
