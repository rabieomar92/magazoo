import type {
  Design,
  FrontCoverTextRole,
  FrontCoverTextStyle,
} from '../schema/document';
import { fontStack } from './fonts';

export const FRONT_COVER_TEXT_ROLES: { role: FrontCoverTextRole; label: string }[] = [
  { role: 'masthead', label: 'Publication title' },
  { role: 'strapline', label: 'Publication strapline' },
  { role: 'kicker', label: 'Category label' },
  { role: 'title', label: 'Main headline' },
  { role: 'subtitle', label: 'Cover subtitle' },
  { role: 'author', label: 'Author' },
  { role: 'storyTag', label: 'Story tag' },
  { role: 'teaserTitle', label: 'Teaser headlines' },
  { role: 'teaserBody', label: 'Teaser descriptions' },
  { role: 'footerBrand', label: 'Footer publication' },
  { role: 'photoCredit', label: 'Photo credit' },
];

export type ResolvedFrontCoverTextStyle = Required<FrontCoverTextStyle>;

export function defaultFrontCoverTextStyle(
  design: Design,
  role: FrontCoverTextRole,
): ResolvedFrontCoverTextStyle {
  const white = '#ffffff';
  const body = design.fontBody;
  const display = design.fontDisplay;
  const category = design.fontCategory ?? body;
  const subtitle = design.fontSubtitle ?? display;
  const author = design.fontAuthor ?? body;
  const affiliation = design.fontAffiliation ?? body;

  const defaults: Record<FrontCoverTextRole, ResolvedFrontCoverTextStyle> = {
    masthead: { fontFamily: display, fontSize: 34, color: design.colors.accent, fontWeight: 900, letterSpacing: -0.055, visible: true },
    strapline: { fontFamily: affiliation, fontSize: design.sizes.affiliation, color: white, fontWeight: 700, letterSpacing: 0.11, visible: true },
    kicker: { fontFamily: category, fontSize: design.sizes.categoryLabel, color: '#111111', fontWeight: 900, letterSpacing: 0.13, visible: true },
    title: { fontFamily: display, fontSize: design.sizes.title, color: white, fontWeight: 900, letterSpacing: -0.04, visible: true },
    subtitle: { fontFamily: subtitle, fontSize: design.sizes.subtitle, color: white, fontWeight: 600, letterSpacing: 0, visible: true },
    author: { fontFamily: author, fontSize: design.sizes.author, color: white, fontWeight: 800, letterSpacing: 0.1, visible: true },
    storyTag: { fontFamily: body, fontSize: design.sizes.author, color: white, fontWeight: 800, letterSpacing: 0.1, visible: true },
    teaserTitle: { fontFamily: body, fontSize: design.sizes.body, color: white, fontWeight: 900, letterSpacing: 0.055, visible: true },
    teaserBody: { fontFamily: body, fontSize: Math.max(5, design.sizes.body * 0.88), color: white, fontWeight: 400, letterSpacing: 0, visible: true },
    footerBrand: { fontFamily: body, fontSize: 5.9, color: white, fontWeight: 800, letterSpacing: 0.13, visible: true },
    photoCredit: { fontFamily: body, fontSize: 5.9, color: white, fontWeight: 800, letterSpacing: 0.13, visible: true },
  };
  return { ...defaults[role], ...(design.frontCover?.text?.[role] ?? {}) };
}

const cssRole = (role: FrontCoverTextRole) =>
  role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

export function frontCoverTextVars(design: Design): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const { role } of FRONT_COVER_TEXT_ROLES) {
    const style = defaultFrontCoverTextStyle(design, role);
    const key = cssRole(role);
    vars[`--front-${key}-font`] = fontStack(style.fontFamily);
    vars[`--front-${key}-size`] = `${style.fontSize}pt`;
    vars[`--front-${key}-color`] = style.color;
    vars[`--front-${key}-weight`] = String(style.fontWeight);
    vars[`--front-${key}-tracking`] = `${style.letterSpacing}em`;
  }
  return vars;
}

export function frontCoverTextVisible(design: Design, role: FrontCoverTextRole): boolean {
  return defaultFrontCoverTextStyle(design, role).visible;
}
