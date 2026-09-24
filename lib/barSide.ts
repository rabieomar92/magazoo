import type { Design } from '../schema/document';

/** `barSide` is the page-1 choice; every following physical sheet alternates. */
export const barStartsRight = (base: Design['barSide'], pageIndex: number) =>
  (base === 'right') !== (pageIndex % 2 === 1);
