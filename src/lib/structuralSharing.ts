/** Reuse unchanged JSON branches after a mutable draft update. Large image
 * strings are compared by identity, never serialized or copied. This keeps
 * subscriptions to unrelated fonts, assets and paragraphs quiet while typing. */
export function shareUnchanged<T>(previous: T, next: T): T {
  if (Object.is(previous, next)) return previous;
  if (!previous || !next || typeof previous !== 'object' || typeof next !== 'object' || Array.isArray(previous) !== Array.isArray(next)) return next;
  const before = previous as Record<string, unknown>;
  const after = next as Record<string, unknown>;
  const keys = Object.keys(after);
  let equal = keys.length === Object.keys(before).length && (!Array.isArray(previous) || previous.length === (next as unknown[]).length);
  for (const key of keys) {
    if (!Object.hasOwn(before, key)) { equal = false; continue; }
    after[key] = shareUnchanged(before[key], after[key]);
    if (!Object.is(before[key], after[key])) equal = false;
  }
  return equal ? previous : next;
}
