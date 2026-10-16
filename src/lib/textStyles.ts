import type { Design, Doc, TextStyle } from '../schema/document';
import { fontStack } from './fonts';
import { TRACKING_SELECTORS, trackingSelector } from './textTracking';

export const cssQuote = (text: string) => `"${Array.from(text).map(c => /[a-zA-Z0-9_-]/.test(c) ? c : `\\${c.codePointAt(0)!.toString(16)} `).join('')}"`;

/** Select text, not its layout frame. These selectors also match measuring
 * copies, so typography edits participate in pagination and PDF preparation. */
export const TEXT_SELECTORS: Record<string, string> = {
  ...TRACKING_SELECTORS,
  title: `${TRACKING_SELECTORS.title}, .article-header-position .title, [data-editor-target="front-cover-style-title"]`,
  subtitle: `${TRACKING_SELECTORS.subtitle}, .article-header-position .subtitle, .front-cover-lede`,
  category: `${TRACKING_SELECTORS.category}, .front-cover-kicker`,
  kicker: '.mag-kicker, .front-cover-kicker',
  author: '.byline > span:first-child, .header > .byline, .mag-author, .mag-cover-author, .mag2-author, .fm-identity strong, .fm-signoff, .front-cover-author',
  affiliation: `${TRACKING_SELECTORS.affiliation}, .front-cover-strap, .fm-identity p`,
  masthead: `${TRACKING_SELECTORS.masthead}, .front-cover-masthead`,
  volume: '.tag-bar-detail, .front-cover-volume',
  strapline: '.front-cover-strap',
  storyTag: `${TRACKING_SELECTORS.storyTag}, .front-cover-story-tag`,
  photoCredit: `${TRACKING_SELECTORS.photoCredit}, .front-cover-photo-credit`,
  teaserTitle: '.front-cover-teaser h2', teaserBody: '.front-cover-teaser p',
  footerBrand: '.front-cover-footer-brand',
  heroCaption: '.article-hero-caption, .p2-hero-cap, [data-editor-target="meta-hero-caption"]',
  coverCaption: '[data-editor-target="meta-cover-caption"]',
  highlights: '.highlights, .mag2-hl li',
  highlightHeading: '[data-editor-target="highlights-label"], .mag2-hl h3',
  referenceHeading: '[data-editor-target="references-label"]',
  references: '.references',
  fmHeading: '.fm-entry-copy h2, .fm-rail h2',
  fmAbout: '.fm-page--board .fm-note-paragraph',
  fmNote: '.fm-page:not(.fm-page--board) .fm-note-text',
  fmContact: '.fm-board-contact',
  fmPage: '.fm-page-number',
  newsSource: '.news-source', newsCredit: '.news-photo-credit',
  brand: '.back-cover-brand-block h1', tagline: '.back-cover-brand-block h2', website: '.back-cover-website',
  qrLabel: '.back-cover-qr-label', socialLabel: '.back-cover-social-label',
  socialUrl: '.back-cover-social-url, .back-cover-social-line',
  footerText: '.back-cover-footer-text', imprint: '.back-cover-imprint',
};

export function textStyleSelector(key: string): string | undefined {
  if (key.startsWith('image-caption:')) return `[data-image-id=${cssQuote(key.slice(14))}] figcaption`;
  if (key.startsWith('fm-entry:')) {
    const [, id, role] = key.split(':');
    return `[data-measure-id=${cssQuote(id)}] ${role === 'title' ? 'h2' : '[data-fm-text]'}`;
  }
  if (key.startsWith('news:')) {
    const split = key.lastIndexOf(':');
    if (split === 4) return `[data-news-id=${cssQuote(key.slice(5))}] .news-copy p`;
    const selectors: Record<string,string> = {title:'h2',body:'.news-copy p:not(.news-source)',caption:'figcaption',kicker:'.news-story-kicker',deck:'.news-story-deck',byline:'.news-story-byline',source:'.news-source',credit:'.news-photo-credit'};
    return selectors[key.slice(split+1)] ? `[data-news-id=${cssQuote(key.slice(5,split))}] ${selectors[key.slice(split+1)]}` : undefined;
  }
  return TEXT_SELECTORS[key] ?? trackingSelector(key);
}

export function textStylesCss(design: Design, scope: string): string {
  return Object.entries(design.textStyles ?? {}).sort(([a],[b]) => Number(a.includes(':'))-Number(b.includes(':'))).flatMap(([key, style]) => {
    const selector = textStyleSelector(key);
    if (!selector || !style || typeof style !== 'object') return [];
    const rules: string[] = [];
    const number = (property: keyof TextStyle, css: string, min: number, max: number, unit='') => {
      const value=style[property];
      if (typeof value === 'number' && Number.isFinite(value)) rules.push(`${css}:${Math.max(min,Math.min(max,value))}${unit}`);
    };
    // Imported font/colour text must never become CSS syntax.
    if (typeof style.fontFamily === 'string' && /^[\p{L}\p{N} _-]{1,80}$/u.test(style.fontFamily)) rules.push(`font-family:${fontStack(style.fontFamily)}`);
    number('fontSize','font-size',4,120,'pt');
    number('fontWeight','font-weight',100,900);
    number('lineHeight','line-height',.8,3);
    if (typeof style.italic === 'boolean') rules.push(`font-style:${style.italic ? 'italic' : 'normal'}`);
    if (typeof style.underline === 'boolean') rules.push(`text-decoration-line:${style.underline ? 'underline' : 'none'}`);
    if (typeof style.color === 'string' && /^#[\da-f]{3,8}$/i.test(style.color)) rules.push(`color:${style.color}`);
    if (['left','center','right','justify'].includes(style.align ?? '')) rules.push(`text-align:${style.align}`);
    const output=rules.length ? [`[data-tracking-scope=${cssQuote(scope)}] :is(${selector}) { ${rules.map(rule=>`${rule} !important`).join(';')}; }`] : [];
    if(key.startsWith('news:')&&key.endsWith(':title')&&typeof style.fontFamily==='string'&&/^[\p{L}\p{N} _-]{1,80}$/u.test(style.fontFamily)) {
      output.push(`[data-tracking-scope=${cssQuote(scope)}] [data-news-id=${cssQuote(key.slice(5,-6))}] { --drop-cap-font:${fontStack(style.fontFamily)}; }`);
    }
    return output;
  }).join('\n');
}

/** Extra component groups without dedicated legacy font controls. */
export function extraTextGroups(doc: Doc): {group:string;label:string}[] {
  const groups = [{group:'highlightHeading',label:'Highlights heading'},{group:'referenceHeading',label:'References heading'},{group:'volume',label:'Issue / date text'}];
  if (doc.templateId?.startsWith('frontmatter')) groups.push(
    {group:'fmHeading',label:'Section / entry headings'}, {group:'fmAbout',label:'About copy'},
    {group:'fmNote',label:'Editor’s note'}, {group:'fmContact',label:'Contact text'}, {group:'fmPage',label:'Contents page numbers'},
    ...(doc.frontMatter?.entries ?? []).flatMap((entry,i)=>[{group:`fm-entry:${entry.id}:title`,label:`Entry ${i+1} heading`},{group:`fm-entry:${entry.id}:body`,label:`Entry ${i+1} text`}]),
  );
  for (const [i,image] of (doc.images ?? []).entries()) groups.push({group:`image-caption:${image.id}`,label:`Image ${i+1} caption`});
  if (doc.templateId === 'news-briefs') {
    groups.push({group:'newsSource',label:'Story sources'},{group:'newsCredit',label:'Photo credits'});
    for (const [i,story] of (doc.news?.stories ?? []).entries()) for (const role of ['title','body','caption','kicker','deck','byline','source','credit']) groups.push({group:`news:${story.id}:${role}`,label:`Story ${i+1} · ${role}`});
  }
  return groups;
}
