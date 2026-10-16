import type { Design, TemplateId } from '../schema/document';
import { pageDimensions } from './pageFormat';

export function supportsArticleHeaderWidth(id?: TemplateId) {
  return !!id && /^paper-[1-8]$/.test(id);
}

/** A stable four-column heading grid, independent of the body column count.
 * Return undefined for legacy/default files, including malformed imports. */
export function articleHeaderWidth(design: Design): number | undefined {
  const count = design.headerWidthCols;
  if (![1, 2, 3, 4].includes(count as number)) return undefined;
  const content = pageDimensions(design).width - 2 * design.margin;
  return (content - 3 * design.gutter) / 4 * count! + design.gutter * (count! - 1);
}

export function articleHeaderWidthVars(design: Design): Record<string, string> {
  const width = articleHeaderWidth(design);
  return width === undefined ? {} : { '--article-header-width': `${width}mm` };
}
