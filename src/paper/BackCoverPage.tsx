import type { CSSProperties, ReactNode } from 'react';
import type { BackCover, BackCoverSocialLink, BackCoverSocialPlatform, BackCoverTextRole, Doc } from '../schema/document';
import { emptyBackCover } from '../store/backCover';
import { FramedImage } from '../components/FramedImage';
import { BACK_COVER_TEXT_ROLES, backCoverLayout, backCoverTextColor, backCoverTextStyle } from '../lib/backCoverDesign';
import { fontStack } from '../lib/fonts';
import type { IconDefinition } from '@fortawesome/fontawesome-common-types';
import {
  faBluesky,
  faDiscord,
  faFacebook,
  faGithub,
  faInstagram,
  faLinkedin,
  faMastodon,
  faPinterest,
  faReddit,
  faTelegram,
  faTiktok,
  faThreads,
  faTwitch,
  faWhatsapp,
  faXTwitter,
  faYoutube,
} from '@fortawesome/free-brands-svg-icons';

function lines(text: string): ReactNode {
  return text.split(/\r?\n/).map((line, index) => (
    <span className={line.trim() ? 'back-cover-social-line' : 'back-cover-social-gap'} key={`${index}-${line}`}>
      {line || '\u00a0'}
    </span>
  ));
}

const SOCIAL_PLATFORM_LABELS: Record<BackCoverSocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  threads: 'Threads',
  bluesky: 'Bluesky',
  whatsapp: 'WhatsApp',
  github: 'GitHub',
  telegram: 'Telegram',
  discord: 'Discord',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  mastodon: 'Mastodon',
  twitch: 'Twitch',
  website: 'Website',
  email: 'Email',
  rss: 'RSS feed',
};

/** Real brand marks are rendered as inline SVG paths so they stay crisp in the
 * browser and in the print/PDF clone without relying on a remote icon font. */
const SOCIAL_BRAND_ICONS: Partial<Record<BackCoverSocialPlatform, IconDefinition>> = {
  facebook: faFacebook,
  instagram: faInstagram,
  x: faXTwitter,
  linkedin: faLinkedin,
  youtube: faYoutube,
  tiktok: faTiktok,
  threads: faThreads,
  bluesky: faBluesky,
  whatsapp: faWhatsapp,
  github: faGithub,
  telegram: faTelegram,
  discord: faDiscord,
  pinterest: faPinterest,
  reddit: faReddit,
  mastodon: faMastodon,
  twitch: faTwitch,
};

const UTILITY_ICON_PATHS: Partial<Record<BackCoverSocialPlatform, string>> = {
  website: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.92 9h-3.01a15.7 15.7 0 0 0-1.2-5.12A8.03 8.03 0 0 1 18.92 11ZM12 4c.84 1.2 1.55 3.6 1.82 7h-3.64c.27-3.4.98-5.8 1.82-7ZM9.29 5.88A15.7 15.7 0 0 0 8.09 11H5.08a8.03 8.03 0 0 1 4.21-5.12ZM5.08 13h3.01c.2 1.99.61 3.77 1.2 5.12A8.03 8.03 0 0 1 5.08 13Zm6.92 7c-.84-1.2-1.55-3.6-1.82-7h3.64c-.27 3.4-.98 5.8-1.82 7Zm2.71-1.88c.59-1.35 1-3.13 1.2-5.12h3.01a8.03 8.03 0 0 1-4.21 5.12ZM21.5 3.5 17 8h3v2h-6V4h2v3l4.5-4.5 1 1Z',
  email: 'M2.5 5.5h19v13h-19v-13Zm1.7 1.8 7.8 5.9 7.8-5.9H4.2Zm15.6 9.4V9.8L12 15.45 4.2 9.8v6.9h15.6Z',
  rss: 'M4.2 17.1a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4ZM2 2v3.1c9.3 0 16.9 7.6 16.9 16.9H22C22 11 13 2 2 2Zm0 6.2v3.1c5.9 0 10.7 4.8 10.7 10.7h3.1C15.8 14.4 9.6 8.2 2 8.2Z',
};

function SocialIcon({ platform }: { platform: BackCoverSocialPlatform }) {
  const brand = SOCIAL_BRAND_ICONS[platform];
  const utilityPath = UTILITY_ICON_PATHS[platform];
  const pathData = brand?.icon[4];
  const paths = brand
    ? (Array.isArray(pathData) ? pathData : [pathData])
    : utilityPath
      ? [utilityPath]
      : [];
  const [width, height] = brand?.icon ?? [24, 24];
  return (
    <span className={`back-cover-social-icon back-cover-social-icon--${platform}`} data-platform={platform} aria-hidden="true">
      <svg viewBox={`0 0 ${width} ${height}`} focusable="false" aria-hidden="true">
        {paths.map((path, index) => <path d={path} key={`${platform}-${index}`} />)}
      </svg>
    </span>
  );
}

function socialHref(link: BackCoverSocialLink): string | undefined {
  const value = link.url.trim();
  if (!value) return undefined;
  if (/^(?:https?:|mailto:|tel:)/i.test(value)) return value;
  if (link.platform === 'email' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  return `https://${value.replace(/^\/+/, '')}`;
}

function socialLink(link: BackCoverSocialLink, visibility: { label: boolean; url: boolean }) {
  const label = link.label?.trim() || SOCIAL_PLATFORM_LABELS[link.platform];
  const href = socialHref(link);
  return <div className="back-cover-social-link" key={link.id} data-editor-tab="content" data-editor-target={`backcover-social-link-${link.id}`}>
    <SocialIcon platform={link.platform} />
    <span className="back-cover-social-copy" dir="auto">
      {visibility.label && <strong className="back-cover-social-label">{label}</strong>}
      {visibility.url && link.url && (href
        ? <a className="back-cover-social-url" href={href}>{link.url}</a>
        : <span className="back-cover-social-url">{link.url}</span>)}
    </span>
  </div>;
}

function socialContent(content: BackCover, side: 'left' | 'right', visibility: { label: boolean; url: boolean }): ReactNode {
  if (Array.isArray(content.socialLinks)) {
    const links = content.socialLinks.filter(link => link && link.side === side && SOCIAL_PLATFORM_LABELS[link.platform]);
    return <div className="back-cover-social-links">{links.map(link => socialLink(link, visibility))}</div>;
  }
  if (!visibility.label && !visibility.url) return null;
  return lines(side === 'left' ? content.socialLeft : content.socialRight);
}

/** A quiet, one-sheet reverse cover. It deliberately has no running folio or
 * top bar; the publication mark and issue imprint belong to this composition. */
export function BackCoverPage({ doc, vars }: { doc: Doc; vars: CSSProperties }) {
  const content = doc.backCover ?? emptyBackCover();
  const qrAsset = content.qr.assetId ? doc.assets[content.qr.assetId] : null;
  const logoAsset = content.logo.assetId ? doc.assets[content.logo.assetId] : null;
  const layout = backCoverLayout(doc.design);
  const typography = Object.fromEntries(BACK_COVER_TEXT_ROLES.map(role => [role, backCoverTextStyle(doc.design, role)])) as Record<BackCoverTextRole, ReturnType<typeof backCoverTextStyle>>;
  const textVars = Object.fromEntries(BACK_COVER_TEXT_ROLES.flatMap(role => {
    const text = typography[role];
    const name = role.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    return [
      [`--back-${name}-font`, fontStack(text.fontFamily)],
      [`--back-${name}-size`, `${text.fontSize}pt`],
      [`--back-${name}-weight`, String(text.fontWeight)],
      [`--back-${name}-style`, text.italic ? 'italic' : 'normal'],
      // Arabic relies on joined glyphs; keep the stored Latin tracking but do
      // not apply it while the document is right-to-left.
      [`--back-${name}-tracking`, `${doc.design.textDirection === 'rtl' ? 0 : text.letterSpacing}em`],
      [`--back-${name}-leading`, String(text.lineHeight)],
      [`--back-${name}-color`, backCoverTextColor(doc.design, role)],
      [`--back-${name}-space`, `${text.spaceBefore}mm`],
    ];
  })) as Record<string, string>;
  const alignItems = layout.brandAlign === 'start' ? 'flex-start' : layout.brandAlign === 'end' ? 'flex-end' : 'center';
  const style = {
    ...vars,
    '--back-brand-top': `${layout.brandTop}mm`,
    '--back-brand-width': `${layout.brandWidth}mm`,
    '--back-brand-align': layout.brandAlign,
    '--back-brand-items': alignItems,
    '--back-side-inset': `${layout.sideInset}mm`,
    '--back-social-bottom': `${layout.bottomInset}mm`,
    '--back-footer-gap': `${layout.footerGap}mm`,
    '--back-qr-size': `${layout.qrSize}mm`,
    '--back-qr-gap': `${layout.qrGap}mm`,
    '--back-logo-width': `${layout.logoWidth}mm`,
    '--back-logo-height': `${layout.logoHeight}mm`,
    '--back-social-icon-size': `${layout.socialIconSize}mm`,
    '--back-social-item-gap': `${layout.socialItemGap}mm`,
    '--back-social-text-gap': `${layout.socialTextGap}mm`,
    '--back-rule-width': `${layout.ruleWidth}mm`,
    '--back-rule-thickness': `${layout.ruleThickness}mm`,
    '--back-rule-top-gap': `${layout.ruleTopGap}mm`,
    '--back-rule-bottom-gap': `${layout.ruleBottomGap}mm`,
    '--back-rule-color': doc.design.backCover?.ruleColor ?? 'var(--accent)',
    '--back-social-icon-color': doc.design.backCover?.socialIconColor ?? 'var(--accent)',
    ...textVars,
  } as CSSProperties;
  const showFooterText = typography.footerText.visible && !!content.footerText;
  const showCentre = layout.showCentreLogo || showFooterText;
  return (
    <div
      className="page back-cover-page"
      style={style}
      dir={doc.design.textDirection === 'rtl' ? 'rtl' : 'ltr'}
    >
      <div className="back-cover-inner">
        <main className="back-cover-brand-block" data-editor-tab="content" data-editor-target="backcover-brand">
          {layout.showQr && <div
            className={`back-cover-qr${qrAsset ? '' : ' back-cover-qr--empty'}`}
            data-editor-tab="images"
            data-editor-target="image-backcover-qr"
            aria-label={content.qrLabel || 'QR code'}
          >
            {qrAsset ? (
              <FramedImage asset={qrAsset} frame={content.qr} fit="contain" />
            ) : (
              <span className="back-cover-qr-placeholder" aria-hidden="true">QR</span>
            )}
          </div>}
          {typography.brand.visible && <h1 data-editor-tab="content" data-editor-target="backcover-brand">{content.brand}</h1>}
          {typography.tagline.visible && <h2 data-editor-tab="content" data-editor-target="backcover-tagline">{content.tagline}</h2>}
          {layout.ruleVisible && layout.ruleWidth > 0 && layout.ruleThickness > 0 && <span className="back-cover-rule" aria-hidden="true" />}
          {typography.website.visible && <p className="back-cover-website" data-editor-tab="content" data-editor-target="backcover-website">{content.website}</p>}
          {typography.qrLabel.visible && content.qrLabel && <p className="back-cover-qr-label" data-editor-tab="content" data-editor-target="backcover-qr-label">{content.qrLabel}</p>}
        </main>

        {(layout.showSocial || showCentre) && <footer className="back-cover-footer">
          {layout.showSocial && <div className="back-cover-social back-cover-social--left" data-editor-tab="content" data-editor-target="backcover-social-left">
            {socialContent(content, 'left', { label: typography.socialLabel.visible, url: typography.socialUrl.visible })}
          </div>}
          {showCentre && <div className="back-cover-centre-mark" data-editor-tab="images" data-editor-target="image-backcover-logo">
            {layout.showCentreLogo && (logoAsset
              ? <div className="back-cover-logo-frame"><FramedImage asset={logoAsset} frame={content.logo} fit="contain" /></div>
              : <span className="back-cover-logo-symbol" aria-label="Centre logo placeholder">◖</span>)}
            {showFooterText && <span className="back-cover-footer-text" data-editor-tab="content" data-editor-target="backcover-footer-text">{content.footerText}</span>}
          </div>}
          {layout.showSocial && <div className="back-cover-social back-cover-social--right" data-editor-tab="content" data-editor-target="backcover-social-right">
            {socialContent(content, 'right', { label: typography.socialLabel.visible, url: typography.socialUrl.visible })}
          </div>}
        </footer>}
        {layout.showImprint && typography.imprint.visible && <div className="back-cover-imprint" data-editor-tab="content" data-editor-target="backcover-imprint">{content.imprint}</div>}
      </div>
    </div>
  );
}
