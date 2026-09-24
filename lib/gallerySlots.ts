import { uid, type Block, type Doc } from '../schema/document';

/** Keep the existing block-based targets; empty tiles have stable slot targets. */
export function galleryImageTarget(block: Block | undefined, slot: number): string {
  return block?.type === 'figure' ? `gallery-image-${block.id}` : `gallery-image-slot-${slot}`;
}

/** Figures already occupy ordinal gallery slots. Reserve skipped slots with
 * empty figures so later uploads never slide into an earlier tile. No fake
 * image assets are needed, and ordinary save/load and undo retain the gaps. */
export function ensureGalleryFigure(doc: Doc, slot: number): Extract<Block, { type: 'figure' }> {
  if (!Number.isInteger(slot) || slot < 0) throw new Error('Invalid gallery image slot.');
  const figures = doc.blocks.filter(block => block.type === 'figure');
  while (figures.length <= slot) {
    const figure: Extract<Block, { type: 'figure' }> = { id: uid(), type: 'figure', assetId: '', caption: '', span: 1 };
    doc.blocks.push(figure);
    figures.push(figure);
  }
  return figures[slot];
}
