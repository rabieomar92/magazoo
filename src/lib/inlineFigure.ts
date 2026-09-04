import { uid, type Block, type Doc } from '../schema/document';
import { splitRichTextAt } from './richtext';

export interface ImageInsertionPoint {
  paragraphId: string;
  offset: number;
}

/** A continuation is valid only while it directly follows its anchor image,
 * and that image still directly follows the paragraph head. Reordering any of
 * the three pieces intentionally turns the tail into an ordinary paragraph. */
export function normalizeInlineContinuations(blocks: Block[]): void {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type !== 'paragraph' || !block.continuationOf) continue;
    const figure = blocks[i - 1];
    const head = blocks[i - 2];
    if (
      figure?.type !== 'figure' ||
      figure.id !== block.continuationOf ||
      head?.type !== 'paragraph'
    ) {
      delete block.continuationOf;
    }
  }
}

/** Insert a newly loaded image at the current paragraph caret. A middle cut
 * becomes head → figure → continuation; a caret at either boundary simply
 * inserts before/after the paragraph. With no usable caret, preserve the old
 * behaviour and append a full-width figure. */
export function insertArticleFigure(doc: Doc, assetId: string, at?: ImageInsertionPoint): string {
  const id = uid();
  const figure: Extract<Block, { type: 'figure' }> = {
    id,
    type: 'figure',
    assetId,
    caption: '',
    // A caret supplies the anchor, not a different kind of image. Keep the
    // established full-width figure default; the author can still choose any
    // 1–4-column size afterward.
    span: 'body',
    align: 'left',
  };
  if (!at) {
    doc.blocks.push(figure);
    return id;
  }

  const index = doc.blocks.findIndex((block) => block.id === at.paragraphId);
  const paragraph = doc.blocks[index];
  if (index < 0 || paragraph?.type !== 'paragraph') {
    doc.blocks.push(figure);
    return id;
  }

  const offset = Math.max(0, Math.min(paragraph.text.length, at.offset));
  if (offset === 0) {
    doc.blocks.splice(index, 0, figure);
    return id;
  }
  if (offset === paragraph.text.length) {
    doc.blocks.splice(index + 1, 0, figure);
    return id;
  }

  const { head, tail } = splitRichTextAt(paragraph.text, offset);
  paragraph.text = head;
  const continuation: Extract<Block, { type: 'paragraph' }> = {
    id: uid(),
    type: 'paragraph',
    text: tail,
    continuationOf: id,
    fontSize: paragraph.fontSize,
    color: paragraph.color,
  };
  doc.blocks.splice(index + 1, 0, figure, continuation);
  return id;
}

/** Remove a block while preserving a caret-inserted paragraph's semantics.
 * Deleting its image joins the two text halves back together. */
export function removeArticleBlock(doc: Doc, index: number): Block | undefined {
  const [removed] = doc.blocks.splice(index, 1);
  if (!removed) return undefined;
  if (removed.type === 'figure') {
    const head = doc.blocks[index - 1];
    const tail = doc.blocks[index];
    if (
      head?.type === 'paragraph' &&
      tail?.type === 'paragraph' &&
      tail.continuationOf === removed.id
    ) {
      head.text += tail.text;
      doc.blocks.splice(index, 1);
    }
  }
  normalizeInlineContinuations(doc.blocks);
  return removed;
}
