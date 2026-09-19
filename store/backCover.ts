import { emptyDoc, type BackCover, type BackCoverSocialLink, type Doc } from '../schema/document';

/** A fresh set of editable back-cover copy. The image slots intentionally start
 * empty: editors can upload a real, scannable QR code and the official logo
 * rather than receiving a decorative placeholder that only looks like one. */
export const emptyBackCover = (): BackCover => ({
  qr: { assetId: null, offsetX: 0, offsetY: 0, scale: 1 },
  logo: { assetId: null, offsetX: 0, offsetY: 0, scale: 1 },
  qrLabel: 'Scan for the School of Physics website',
  brand: 'THE PHYSICIST',
  tagline: 'SCHOOL OF PHYSICS',
  website: 'www.physics.usm.my',
  socialLeft: 'Science Blog\nphysics.usm.my/blog\n\nFacebook\nfacebook.com/USMPhysics',
  socialRight: 'X @usmphysics\nx.com/usmphysics\n\nLinkedIn\nlinkedin.com/company/usmphysics',
  socialLinks: [
    { id: 'social-left-blog', platform: 'website', label: 'Science Blog', url: 'physics.usm.my/blog', side: 'left' },
    { id: 'social-left-facebook', platform: 'facebook', label: 'Facebook', url: 'facebook.com/USMPhysics', side: 'left' },
    { id: 'social-right-x', platform: 'x', label: 'X @usmphysics', url: 'x.com/usmphysics', side: 'right' },
    { id: 'social-right-linkedin', platform: 'linkedin', label: 'LinkedIn', url: 'linkedin.com/company/usmphysics', side: 'right' },
  ] satisfies BackCoverSocialLink[],
  footerText: 'SCHOOL OF PHYSICS · USM',
  imprint: 'ISSUE 01 · 2026',
});

/** Prestigious, restrained back cover inspired by the supplied RIKEN example:
 * a single colour field, centered brand lock-up, optional QR/logo artwork and
 * a quiet three-part social footer. It is a fixed one-sheet composition. */
export function makeBackCover(): Doc {
  const d = emptyDoc();
  d.templateId = 'backcover-1';
  d.blocks = [];
  d.images = [];
  d.highlights = [];
  d.references = [];
  d.news = undefined;
  d.frontMatter = undefined;
  d.hero = { assetId: null, offsetX: 0, offsetY: 0, scale: 1 };
  d.cover = undefined;
  d.backCover = emptyBackCover();
  d.meta = {
    masthead: 'The Physicist',
    categoryLabel: '',
    title: '',
    subtitle: '',
    author: '',
    affiliation: '',
    volume: '',
  };
  d.footer = { enabled: false, text: d.backCover.footerText, startNumber: 1 };
  d.design = {
    ...d.design,
    // The back cover has no article flow, but the shared design schema keeps
    // body columns at the supported 2–4 range for older renderers.
    bodyCols: 2,
    bodyAlign: 'left',
    sidebar: false,
    highlightsPlacement: 'page1',
    margin: 14,
    gutter: 5,
    heroHeight: 0,
    showHero: false,
    topBarOffset: 0,
    firstPageTopMargin: 0,
    backCoverBrandTop: 82,
    backCoverSideInset: 14,
    backCoverSocialBottom: 12,
    backCoverQrSize: 27,
    backCoverLogoWidth: 32,
    backCoverLogoHeight: 16,
    backCoverSocialIconSize: 5.5,
    fontDisplay: 'Helvetica',
    fontBody: 'Helvetica',
    fontCategory: 'Helvetica',
    fontSubtitle: 'Helvetica',
    fontAuthor: 'Helvetica',
    fontAffiliation: 'Helvetica',
    paperBg: '#f5b719',
    colors: {
      hero: '#f5b719',
      accent: '#161616',
      accentSoft: '#ffe28a',
      ink: '#161616',
    },
    sizes: {
      ...d.design.sizes,
      categoryLabel: 8,
      title: 25,
      subtitle: 10,
      author: 8,
      affiliation: 8,
      body: 8,
    },
  };
  return d;
}
