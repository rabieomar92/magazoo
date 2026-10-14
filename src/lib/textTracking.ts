import type { Design, TemplateId } from '../schema/document';

/** Shared selectors reach the visible text AND its pagination measuring twin.
 * Only explicit settings emit CSS: existing files keep their native tracking. */
export const TRACKING_SELECTORS: Record<string, string> = {
  body: 'p[data-source-block-id], .fm-unit [data-fm-text], .fm-note-text, .fm-note-paragraph, .news-copy p, .g-card .g-desc',
  title: '.header .title, .mag-title, .mag2-title, .fm-header h1, .fm-board-list-header h1, .news-header h1, .g-title',
  subtitle: '.header .subtitle, .mag-lede, .mag2-lede, .fm-subtitle, .g-desc',
  category: '.eyebrow, .mag-kicker, .mag2-kicker, .fm-kicker, .news-kicker',
  author: '.byline, .mag-author, .mag2-author, .fm-identity strong, .fm-signoff',
  affiliation: '.affiliation, .mag2-affil, .fm-identity span',
  masthead: '.tag-bar-tag, .tag-bar-detail, .mag-topbar',
  footer: '.page-folio, .page-folio-text, .page-folio-number',
  marginText: '.page-margin-text',
  storyTag: '.mag2-photo-tag, .mag-hero-tag',
  photoCredit: '.mag-hero-credit, .fm-credit, [data-editor-target="meta-photo-credit"]',
  quote: '.mag-quote-text, .mag2-quote-text',
  attribution: '.mag-quote-by, .mag2-quote-by',
  caption: '.placed-image figcaption, .flow-fig figcaption, .flow-eq figcaption, .fm-board-caption',
  heroCaption: '.article-hero-caption, .p2-hero-cap, [data-editor-target="meta-hero-caption"]',
  highlights: '.highlights, .mag2-hl li, .sidebar h3, .hl-below h3, .hl-col h3, .placed-highlights h3, .mag2-hl h3',
  references: '.references',
  newsHeadline: '.news-story h2',
  newsCaption: '.news-story figcaption',
  newsKicker: '.news-story-kicker',
  newsDeck: '.news-story-deck',
  newsByline: '.news-story-byline',
};

// A quoted CSS attribute value, safe even for imported document/block IDs.
const quote = (text: string) => `"${Array.from(text).map(c => /[a-zA-Z0-9_-]/.test(c) ? c : `\\${c.codePointAt(0)!.toString(16)} `).join('')}"`;
export function trackingSelector(key: string): string | undefined {
  if (key.startsWith('block:')) {
    const id = quote(key.slice(6));
    return `p[data-source-block-id=${id}], .g-card[data-source-block-id=${id}] :is(.g-title,.g-desc), [data-measure-id=${id}] [data-fm-text], .front-cover-teaser[data-source-block-id=${id}] :is(h2,p), .flow-eq[data-source-block-id=${id}] figcaption`;
  }
  if (key.startsWith('gallery-caption:')) return `[data-editor-target=${quote(`gallery-caption-${key.slice(16)}`)}] :is(.g-title,.g-desc)`;
  if (key.startsWith('news:')) {
    const split = key.lastIndexOf(':');
    const id = quote(key.slice(5, split));
    const role = key.slice(split + 1);
    const selectors: Record<string, string> = { title: 'h2', body: '.news-copy p', caption: 'figcaption' };
    return selectors[role] ? `[data-news-id=${id}] ${selectors[role]}` : undefined;
  }
  return TRACKING_SELECTORS[key];
}

export function trackingRoleSupported(id: TemplateId | undefined, role: string): boolean {
  const specialized = id === 'magazine-4' ? ['masthead','category','title','subtitle','author','storyTag','photoCredit']
    : id === 'magazine-3' ? ['title','category','subtitle','quote','attribution','author','photoCredit'] : [];
  return !specialized.includes(role);
}

export function textTrackingCss(design: Design, scope: string, templateId?: TemplateId, resolve = trackingSelector): string {
  const settings = Object.entries(design.textTracking ?? {});
  // Local settings always win, regardless of insertion order in the saved file.
  settings.sort(([a], [b]) => Number(a.includes(':')) - Number(b.includes(':')));
  return settings.flatMap(([key, value]) => {
    const selector = resolve(key);
    if (!selector || !Number.isFinite(value) || !trackingRoleSupported(templateId, key)) return [];
    const spacing = Math.max(-.1, Math.min(1, value));
    return [`[data-tracking-scope=${quote(scope)}] :is(${selector}) { letter-spacing: ${spacing}em !important; }`];
  }).join('\n');
}
