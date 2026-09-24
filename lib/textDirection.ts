import { familyOf, type Design, type TemplateId } from '../schema/document';

export function dropCapEnabled(design: Design, template?: TemplateId) {
  return design.dropCap ?? (familyOf(template) === 'paper' || (familyOf(template) === 'magazine' && template !== 'magazine-4'));
}

/** Switching language should also choose its natural start edge, while
 * retaining deliberately centred/justified copy and physical image anchors. */
export function setTextDirection(design: Design, direction: 'ltr'|'rtl') {
  const previousStart = design.textDirection === 'rtl' ? 'right' : 'left';
  const nextStart = direction === 'rtl' ? 'right' : 'left';
  if (design.bodyAlign === previousStart) design.bodyAlign = nextStart;
  if (design.frontCover?.alignment === previousStart) design.frontCover = {...design.frontCover,alignment:nextStart};
  design.textDirection = direction;
}
