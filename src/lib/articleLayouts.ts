import { DEFAULT_TOP_BAR_OFFSET, type Design, type TemplateId } from '../schema/document';
import { pageDimensions } from './pageFormat';
import { TOP_BAR_HEIGHT_MM } from './topBar';
import { articleHeaderWidth } from './articleHeaderWidth';
import { lineGridUp, lineGridDown } from './lineGrid';

export const ARTICLE_LAYOUTS = {
  'paper-4': { name: 'Immersive Bleed', rank: 1, referencePage: 19, heroHeight: 154, titleTop: 126, titleCols: 2, bodyTop: 179, dark: true, fade: true },
  'paper-5': { name: 'Panoramic Bleed', rank: 2, referencePage: 15, heroHeight: 139, titleTop: 130, titleCols: 4, bodyTop: 160, dark: true, fade: true },
  'paper-6': { name: 'Stepped Image Lead', rank: 3, referencePage: 16, heroHeight: 113, titleTop: 124, titleCols: 3, bodyTop: 168, dark: false, fade: false },
  'paper-7': { name: 'Airy Edge Bleed', rank: 4, referencePage: 12, heroHeight: 115, titleTop: 119, titleCols: 4, bodyTop: 149, dark: false, fade: false },
  'paper-8': { name: 'Inset Research', rank: 5, referencePage: 13, heroHeight: 103, titleTop: 37, titleCols: 4, bodyTop: 68, dark: false, fade: false },
} as const;
export type ReferenceArticleId = keyof typeof ARTICLE_LAYOUTS;
export function isReferenceArticle(id?: TemplateId): id is ReferenceArticleId {
  return !!id && Object.prototype.hasOwnProperty.call(ARTICLE_LAYOUTS, id);
}
export const articlePageHeight = (design: Design) => design.pageFormat
  ? pageDimensions(design).height : design.articlePageSize === 'a4' ? 297 : 276;
/** The reference grid includes the rail; toggling a callout must not create
 * an extra, narrower image grid. Use only for geometry, not render decisions. */
export const articleGridDesign = (design: Design): Design => ({ ...design, highlightsPlacement: 'below',
  margin: Math.max(8, Math.min(30, design.margin)), gutter: Math.max(2, Math.min(12, design.gutter)),
  bodyCols: Math.max(2, Math.min(4, Math.round(design.bodyCols))) as Design['bodyCols'],
});
export interface ArticleRegion { page: number; column: number; x: number; y: number; width: number; height: number }
export interface ArticleObstacle { page: number; left: number; top: number; width: number; height: number }

/** All dimensions are physical millimetres. A single grid is shared by the
 * opening composition, continuation pages and independent placed images. */
export function articleGeometry(id: ReferenceArticleId, design: Design, measuredHeader = 0, captionHeight = 0, footerReserve = 0) {
  const layout = ARTICLE_LAYOUTS[id];
  const { width } = pageDimensions(design);
  const height = articlePageHeight(design);
  const margin = Math.max(8, Math.min(30, design.margin));
  const gutter = Math.max(2, Math.min(12, design.gutter));
  const columns = Math.max(2, Math.min(4, Math.round(design.bodyCols)));
  const col = (width - 2 * margin - (columns - 1) * gutter) / columns;
  const span = (count: number) => col * count + gutter * (count - 1);
  const titleCols = Math.max(1, Math.min(columns, Math.round(layout.titleCols * columns / 4)));
  const titleWidth = articleHeaderWidth({...design, margin, gutter}) ?? span(titleCols);
  const heroHeight = design.showHero === false ? 0 : Math.max(0, Math.min(160, design.heroHeight));
  const delta = heroHeight - layout.heroHeight;
  const inset = id === 'paper-8';
  const bottomHero = design.heroAtBottom === true && heroHeight > 0;
  const bottomBleed = bottomHero && design.heroBottomBleed === true;
  const mastheadBottom = design.showTopBar === false ? 0 : (design.topBarOffset ?? DEFAULT_TOP_BAR_OFFSET)+TOP_BAR_HEIGHT_MM+gutter;
  const contentTop = inset ? Math.max(margin, mastheadBottom)
    : Math.max(margin,25,(design.topBarOffset ?? DEFAULT_TOP_BAR_OFFSET)+TOP_BAR_HEIGHT_MM+gutter);
  const imageLeft = inset && (design.heroSide ?? (design.textDirection === 'rtl' ? 'left' : 'right')) === 'left';
  // Zero is the legacy automatic composition. An explicit inset title position
  // must be able to move up as well as down, without crossing a visible masthead.
  const customInsetTop = inset && (design.firstPageTopMargin ?? 0) > 0;
  const titleTop = customInsetTop ? Math.max(contentTop, design.firstPageTopMargin!)
    : Math.max(26, contentTop, bottomHero ? 26 : (inset ? layout.titleTop : layout.titleTop + delta), design.firstPageTopMargin ?? 0);
  const bodyTop = Math.max(titleTop + measuredHeader + gutter, customInsetTop ? 0 : bottomHero ? 26 : inset ? layout.bodyTop : layout.bodyTop + delta);
  const bottom = height - (footerReserve > 0 ? footerReserve : margin);
  const imageBottom = bottomBleed ? height : bottom;
  const heroColumns = Math.max(1, Math.min(columns, 3, Math.round(design.heroWidthCols ?? columns - 1)));
  const imageColumn = imageLeft ? 0 : columns - heroColumns;
  const image = inset
    ? { x: margin + imageColumn * (col + gutter), y: bottomHero ? imageBottom-heroHeight-(bottomBleed ? 0 : captionHeight+gutter) : bodyTop, width: span(heroColumns), height: heroHeight }
    : { x: 0, y: bottomHero ? imageBottom-heroHeight : 0, width, height: heroHeight };
  // Reserve the measured caption and one normal gutter, not an unrelated
  // 13 mm floor. Only columns actually covered by the inset photo move down.
  const insetCaptionSpace = captionHeight > 0 ? 1 + captionHeight : 0;
  const starts = Array.from({ length: columns }, (_, i) => !bottomHero && inset && i >= imageColumn && i < imageColumn + heroColumns && heroHeight > 0
    ? bodyTop + heroHeight + insetCaptionSpace + gutter
    : i * (col + gutter) < titleWidth - .01 ? bodyTop : titleTop);
  return { layout, width, height, margin, gutter, columns, col, span, titleCols, titleWidth, titleTop, bodyTop, bottom, image, starts, bottomHero, bottomBleed, contentTop };
}

/** Split each column top-to-bottom around placed photographs, then advance
 * to the next column. No text jumps over a photo and then doubles back. */
export function articleRegions(g: ReturnType<typeof articleGeometry>, throughPage: number, obstacles: ArticleObstacle[] = [], rtl = false, lineHeightMm=0): ArticleRegion[] {
  const result: ArticleRegion[] = [];
  for (let page = 0; page <= throughPage; page++) {
    for (let logical = 0; logical < g.columns; logical++) {
      const column = rtl ? g.columns - 1 - logical : logical;
      const x = g.margin + column * (g.col + g.gutter);
      let cursor = page === 0 ? g.starts[column] : g.contentTop;
      const bottomArt = g.bottomHero ? [{page:0,left:g.image.x,top:g.image.y,width:g.image.width,height:g.height-g.image.y}] : [];
      const cuts = [...obstacles,...bottomArt].filter(o => o.page === page && o.left < x + g.col && o.left + o.width > x)
        .map(o => ({ top: o.top - 2, bottom: o.top + o.height + 2 })).sort((a, b) => a.top - b.top);
      for (const cut of cuts) {
        if (cut.top > cursor + 8) result.push({ page, column, x, y: cursor, width: g.col, height: Math.min(cut.top, g.bottom) - cursor });
        cursor = Math.max(cursor, cut.bottom);
        if (cursor >= g.bottom) break;
      }
      if (cursor < g.bottom - 8) result.push({ page, column, x, y: cursor, width: g.col, height: g.bottom - cursor });
    }
  }
  return result.map(region=>{
    const origin=region.page===0?g.bodyTop:g.contentTop;
    const top=lineGridUp(region.y,lineHeightMm,origin);
    const bottom=lineGridDown(region.y+region.height,lineHeightMm,origin);
    return {...region,y:top,height:Math.max(0,bottom-top)};
  }).filter(r => r.height >= 8);
}

/** Explicit reset, never applied silently to an existing document on switch. */
export function referenceArticleDesign(id: ReferenceArticleId, base: Design): Design {
  const layout = ARTICLE_LAYOUTS[id];
  const bg = id === 'paper-4' ? '#241711' : id === 'paper-5' ? '#094441' : '#ffffff';
  return { ...base, articlePageSize: 'reference', bodyCols: 4, margin: 14, gutter: 4,
    heroHeight: layout.heroHeight, heroWidthCols: undefined, showHero: true, imageTheme: false, heroAtBottom: false, heroBottomBleed: false, articleLeading: 1.28,
    firstPageTopMargin: 0, subtitleGap: 1.5, bodyAlign: 'left', sidebar: true, highlightsPlacement: 'page1-flow',
    fontBody: 'Georgia', fontDisplay: 'Avenir Next LT Pro', fontSubtitle: 'Avenir Next LT Pro Light',
    fontCategory: 'Avenir Next LT Pro Light', fontAuthor: 'Avenir Next LT Pro', fontAffiliation: 'Avenir Next LT Pro', paperBg: bg,
    subtitleColor: undefined, authorColor: undefined, affiliationColor: undefined,
    subtitleWeight: 400, authorWeight: 400, affiliationWeight: 400,
    subtitleItalic: false, authorItalic: false, affiliationItalic: false,
    articleCaptionFont: 'Avenir Next LT Pro', articleCaptionSize: 7, articleCaptionColor: undefined, articleCaptionAlign: 'left',
    barColor: '#9a9a9a', barTagColor: bg, barTagInk: layout.dark ? '#ffffff' : '#555555',
    colors: { ...base.colors, ink: layout.dark ? '#ffffff' : '#202124', hero: bg, accent: '#ed7d31', accentSoft: layout.dark ? bg : '#f0f0f0' },
    sizes: { ...base.sizes, title: 28, body: 9, subtitle: 12, categoryLabel: 10, author: 7, affiliation: 7 },
  };
}
