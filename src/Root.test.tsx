import { describe, expect, it } from 'vitest';
import { isAdminHash } from './routing';

describe('application entry routes', () => {
  it('opens the admin workspace for the bare URL and admin hash', () => {
    expect(isAdminHash('')).toBe(true);
    expect(isAdminHash('#admin')).toBe(true);
  });

  it('keeps editor and shared-document hashes out of the admin workspace', () => {
    expect(isAdminHash('#editor')).toBe(false);
    expect(isAdminHash('#edit=private-token')).toBe(false);
  });
});
