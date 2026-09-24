import { familyOf, type TemplateId } from '../schema/document';
import type { Piece } from './paginate';

function pieceHasFlowContent(piece: Piece): boolean {
  if (piece.kind === 'text') return Boolean(piece.text.trim());
  if (piece.kind === 'image-columns') {
    return piece.columns.some((column) =>
      column.segments.some((segment) =>
        segment.pieces.some((textPiece) => Boolean(textPiece.text.trim())),
      ),
    );
  }
  return true;
}

/** Map pagination regions back to physical sheets. Paper 2 spends two regions
 * on sheet 1; editorial covers/photo sheets shift article regions forward. */
export function populatedPhysicalPages(
  pages: Piece[][],
  templateId: TemplateId | undefined,
): number[] {
  const physical = new Set<number>();
  pages.forEach((pieces, regionIndex) => {
    if (!pieces.some(pieceHasFlowContent)) return;
    if (templateId === 'paper-2') {
      physical.add(regionIndex <= 1 ? 1 : regionIndex);
    } else if (templateId === 'magazine-2') {
      physical.add(regionIndex === 0 ? 1 : regionIndex + 2);
    } else if (templateId === 'magazine-3') {
      physical.add(regionIndex + 3);
    } else if (familyOf(templateId) === 'magazine') {
      physical.add(regionIndex + 2);
    } else {
      physical.add(regionIndex + 1);
    }
  });
  return Array.from(physical).sort((a, b) => a - b);
}
