import type { Design, TemplateId } from '../schema/document';

export type HeadingTextRole = 'subtitle' | 'author' | 'affiliation';

/** One resolution path for the controls, preview and measuring hosts. */
export function headingTextStyle(design: Design, templateId: TemplateId | undefined, role: HeadingTextRole) {
  const front = templateId === 'magazine-4';
  const split = templateId === 'magazine-2';
  const defaultWeight = role === 'author' && (front || split) ? 800
    : role === 'subtitle' && front ? 600
    : role === 'affiliation' && front ? 700 : 400;
  return {
    color: design[`${role}Color`] ?? design.colors.ink,
    fontWeight: design[`${role}Weight`] ?? defaultWeight,
    fontStyle: (design[`${role}Italic`] ?? (role === 'subtitle' && !!templateId?.startsWith('magazine') && !front))
      ? 'italic' as const : 'normal' as const,
  };
}

export function headingTextVars(design: Design, templateId?: TemplateId): Record<string, string> {
  const vars: Record<string, string> = {
    // Captions over photographs need their own light default; an explicitly
    // chosen description colour still applies to both cards and captions.
    '--caption-subtitle-color': design.subtitleColor ?? '#e5e7eb',
  };
  for (const role of ['subtitle', 'author', 'affiliation'] as const) {
    const style = headingTextStyle(design, templateId, role);
    vars[`--${role}-color`] = style.color;
    vars[`--${role}-weight`] = String(style.fontWeight);
    vars[`--${role}-style`] = style.fontStyle;
  }
  return vars;
}
