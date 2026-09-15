import type {
  BackCoverDesign,
  BackCoverTextRole,
  BackCoverTextStyle,
  Design,
} from '../schema/document';

export const BACK_COVER_TEXT_ROLES: BackCoverTextRole[] = [
  'brand',
  'tagline',
  'website',
  'qrLabel',
  'socialLabel',
  'socialUrl',
  'footerText',
  'imprint',
];

const TEXT_DEFAULTS: Record<BackCoverTextRole, Required<Omit<BackCoverTextStyle, 'color' | 'fontFamily'>>> = {
  brand: { fontSize: 25, fontWeight: 800, italic: false, letterSpacing: -0.045, lineHeight: .95, visible: true, spaceBefore: 0 },
  tagline: { fontSize: 10, fontWeight: 700, italic: false, letterSpacing: .015, lineHeight: 1, visible: true, spaceBefore: 1.5 },
  website: { fontSize: 7.2, fontWeight: 400, italic: false, letterSpacing: 0, lineHeight: 1.35, visible: true, spaceBefore: 0 },
  qrLabel: { fontSize: 6.2, fontWeight: 400, italic: false, letterSpacing: 0, lineHeight: 1.35, visible: true, spaceBefore: 2.2 },
  socialLabel: { fontSize: 7.1, fontWeight: 700, italic: false, letterSpacing: 0, lineHeight: 1.15, visible: true, spaceBefore: 0 },
  socialUrl: { fontSize: 6.5, fontWeight: 400, italic: false, letterSpacing: 0, lineHeight: 1.15, visible: true, spaceBefore: .4 },
  footerText: { fontSize: 5.8, fontWeight: 700, italic: false, letterSpacing: .035, lineHeight: 1.2, visible: true, spaceBefore: 1.4 },
  imprint: { fontSize: 5.5, fontWeight: 400, italic: false, letterSpacing: .06, lineHeight: 1.2, visible: true, spaceBefore: 5 },
};

export const BACK_COVER_TEXT_LABELS: Record<BackCoverTextRole, string> = {
  brand: 'Publication name',
  tagline: 'Tagline',
  website: 'Website',
  qrLabel: 'QR description',
  socialLabel: 'Social-media labels',
  socialUrl: 'Social-media links',
  footerText: 'Centre footer text',
  imprint: 'Issue mark',
};

/** Fresh values for the design-only reset button. Copy, links and assets live
 * elsewhere and therefore cannot be erased by this operation. */
export function defaultBackCoverDesign(): BackCoverDesign {
  return {
    brandTop: 82,
    brandWidth: 88,
    brandAlign: 'center',
    sideInset: 14,
    bottomInset: 12,
    footerGap: 8,
    qrSize: 27,
    qrGap: 7,
    logoWidth: 32,
    logoHeight: 16,
    socialIconSize: 5.5,
    socialItemGap: 2.6,
    socialTextGap: 1.8,
    ruleVisible: true,
    ruleWidth: 18,
    ruleThickness: .35,
    ruleTopGap: 4,
    ruleBottomGap: 3,
    showQr: true,
    showCentreLogo: true,
    showSocial: true,
    showImprint: true,
  };
}

export function clampBackCover(value: number | undefined, min: number, max: number, fallback: number): number {
  const safe = Number.isFinite(value) ? Number(value) : fallback;
  return Math.max(min, Math.min(max, safe));
}

/** Resolve new nested settings while retaining every old flat backCover* value. */
export function backCoverLayout(design: Design) {
  const value = design.backCover ?? {};
  return {
    brandTop: clampBackCover(value.brandTop ?? design.backCoverBrandTop, 28, 170, 82),
    brandWidth: clampBackCover(value.brandWidth, 45, 150, 88),
    brandAlign: value.brandAlign ?? 'center',
    sideInset: clampBackCover(value.sideInset ?? design.backCoverSideInset, 6, 35, design.margin),
    bottomInset: clampBackCover(value.bottomInset ?? design.backCoverSocialBottom, 6, 42, 12),
    footerGap: clampBackCover(value.footerGap, 2, 22, 8),
    qrSize: clampBackCover(value.qrSize ?? design.backCoverQrSize, 12, 55, 27),
    qrGap: clampBackCover(value.qrGap, 0, 20, 7),
    logoWidth: clampBackCover(value.logoWidth ?? design.backCoverLogoWidth, 10, 80, 32),
    logoHeight: clampBackCover(value.logoHeight ?? design.backCoverLogoHeight, 5, 42, 16),
    socialIconSize: clampBackCover(value.socialIconSize ?? design.backCoverSocialIconSize, 3, 14, 5.5),
    socialItemGap: clampBackCover(value.socialItemGap, 0, 10, 2.6),
    socialTextGap: clampBackCover(value.socialTextGap, 0, 8, 1.8),
    mutedColor: value.mutedColor ?? design.colors.ink,
    socialIconColor: value.socialIconColor ?? design.colors.accent,
    ruleColor: value.ruleColor ?? design.colors.accent,
    ruleVisible: value.ruleVisible !== false,
    ruleWidth: clampBackCover(value.ruleWidth, 0, 80, 18),
    ruleThickness: clampBackCover(value.ruleThickness, 0, 2, .35),
    ruleTopGap: clampBackCover(value.ruleTopGap, 0, 20, 4),
    ruleBottomGap: clampBackCover(value.ruleBottomGap, 0, 20, 3),
    showQr: value.showQr !== false,
    showCentreLogo: value.showCentreLogo !== false,
    showSocial: value.showSocial !== false,
    showImprint: value.showImprint !== false,
  } satisfies Required<Omit<BackCoverDesign, 'text'>>;
}

export function backCoverTextStyle(design: Design, role: BackCoverTextRole): Required<BackCoverTextStyle> {
  const base = TEXT_DEFAULTS[role];
  const custom = design.backCover?.text?.[role] ?? {};
  const muted = role === 'qrLabel' || role === 'socialUrl';
  return {
    fontFamily: custom.fontFamily ?? design.fontBody,
    fontSize: clampBackCover(custom.fontSize, 4.5, 72, base.fontSize),
    fontWeight: clampBackCover(custom.fontWeight, 100, 900, base.fontWeight),
    italic: custom.italic ?? base.italic,
    letterSpacing: clampBackCover(custom.letterSpacing, -.15, .5, base.letterSpacing),
    lineHeight: clampBackCover(custom.lineHeight, .75, 2.5, base.lineHeight),
    color: custom.color ?? (muted ? design.backCover?.mutedColor ?? design.colors.ink : design.colors.ink),
    visible: custom.visible ?? base.visible,
    spaceBefore: clampBackCover(custom.spaceBefore, -12, 40, base.spaceBefore),
  };
}

/** Preserve the old translucent muted treatment unless the editor chooses an
 * explicit per-role colour (or a dedicated muted colour). */
export function backCoverTextColor(design: Design, role: BackCoverTextRole): string {
  const explicit = design.backCover?.text?.[role]?.color;
  if (explicit) return explicit;
  if ((role === 'qrLabel' || role === 'socialUrl') && design.backCover?.mutedColor) {
    return design.backCover.mutedColor;
  }
  if (role === 'qrLabel') return 'color-mix(in srgb, var(--ink) 66%, transparent)';
  if (role === 'socialUrl') return 'color-mix(in srgb, var(--ink) 72%, transparent)';
  return 'var(--ink)';
}
