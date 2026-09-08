import type { CSSProperties } from 'react';
import type { Design, GateTextRole, GateTextStyle } from '../schema/document';
import { headingTextStyle } from './headingText';
import { fontStack } from './fonts';
import { clampSpacing, SUBTITLE_GAP, TEXT_SPACE_AFTER } from './spacing';

const bounded = (value: number, fallback: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

/** Shared by the controls and rendered cover, including the print DOM. */
export function gateTypography(design: Design, role: GateTextRole): Required<GateTextStyle> {
  const rtl = design.textDirection === 'rtl';
  const heading = role === 'subtitle' || role === 'author' ? headingTextStyle(design, 'magazine-3', role) : undefined;
  const titleSize = design.gateTitleSize ?? 46;
  const base: Required<GateTextStyle> = {
    fontFamily: design.fontBody, fontSize: 8.5, color: '#cbd5e1', fontWeight: 400,
    italic: false, lineHeight: 1.4, letterSpacing: 0, spaceAfter: 0,
  };
  const defaults: Record<GateTextRole, GateTextStyle> = {
    title: { fontFamily: design.fontDisplay, fontSize: titleSize, color: '#ffffff', fontWeight: 800, lineHeight: rtl ? 1.3 : .92, letterSpacing: -.03 * titleSize * 4 / 3 },
    kicker: { fontSize: 10, color: design.colors.accent, fontWeight: 800, letterSpacing: .16 * 10 * 4 / 3, spaceAfter: 16 },
    subtitle: { fontFamily: design.fontSubtitle ?? design.fontDisplay, fontSize: design.sizes.subtitle, color: heading?.color, fontWeight: heading?.fontWeight, italic: heading?.fontStyle === 'italic', lineHeight: 1.45, spaceAfter: 18 },
    quote: { fontFamily: design.fontDisplay, fontSize: 17, color: '#ffffff', fontWeight: 700, italic: true, lineHeight: 1.3 },
    attribution: { color: design.colors.accent, fontWeight: 700, letterSpacing: .12 * 8.5 * 4 / 3 },
    author: { fontFamily: design.fontAuthor ?? design.fontBody, fontSize: design.sizes.author, color: heading?.color, fontWeight: heading?.fontWeight, italic: heading?.fontStyle === 'italic', letterSpacing: .14 * 8.5 * 4 / 3 },
    photoCredit: { letterSpacing: .14 * 8.5 * 4 / 3 },
  };
  const fallback = { ...base, ...defaults[role] } as Required<GateTextStyle>;
  const style = { ...fallback, ...design.gateTypography?.[role] };
  return {
    ...style,
    fontSize: bounded(style.fontSize, fallback.fontSize, 6, 100),
    fontWeight: bounded(style.fontWeight, fallback.fontWeight, 100, 900),
    lineHeight: bounded(style.lineHeight, fallback.lineHeight, .8, 2.5),
    letterSpacing: rtl ? 0 : bounded(style.letterSpacing, fallback.letterSpacing, -3, 12),
    spaceAfter: clampSpacing(style.spaceAfter, TEXT_SPACE_AFTER, fallback.spaceAfter),
  };
}

/** Allow opted-in negative margins to paint above their text block without
 * removing its bottom clipping (which protects the footer). Units are CSS px. */
export function gateSpacingBleed(design: Design, side: 'title' | 'text') {
  const roles: GateTextRole[] = side === 'title' ? ['kicker', 'title'] : ['subtitle', 'quote', 'attribution'];
  return roles.reduce((sum, role) => sum + Math.min(0, gateTypography(design, role).spaceAfter),
    side === 'text' ? Math.min(0, clampSpacing(design.subtitleGap, SUBTITLE_GAP)) * 96 / 25.4 : 0);
}

export function gateTypographyCss(design: Design, role: GateTextRole): CSSProperties {
  const style = gateTypography(design, role);
  return {
    fontFamily: fontStack(style.fontFamily), fontSize: `${style.fontSize}pt`, color: style.color,
    fontWeight: style.fontWeight, fontStyle: style.italic ? 'italic' : 'normal',
    lineHeight: style.lineHeight, letterSpacing: `${style.letterSpacing}px`, marginBottom: `${style.spaceAfter}px`,
  };
}
