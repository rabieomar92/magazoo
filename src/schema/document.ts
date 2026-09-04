export const SCHEMA_VERSION = 1;

/** Template family = which layout engine renders the document. */
export type TemplateFamily = 'paper' | 'magazine' | 'gallery';

/** A specific template. The family (engine) is the id's prefix; the number picks
 *  a preset (content + design tokens) within that engine. */
export type TemplateId =
  | 'paper-1'
  | 'paper-2'
  | 'magazine-1'
  | 'magazine-2'
  | 'magazine-3'
  | 'magazine-4'
  | 'gallery-1'
  | 'gallery-2'
  | 'gallery-3'
  | 'gallery-4';

/** The layout engine a template runs on — derived from the id, never stored. */
export const familyOf = (id: TemplateId | undefined): TemplateFamily =>
  id?.startsWith('gallery') ? 'gallery' : id?.startsWith('magazine') ? 'magazine' : 'paper';

/** A block never knows which page it lands on. Pages are computed, never stored. */
export type Block =
  | {
      id: string;
      type: 'paragraph';
      text: string;
      /**
       * First-line indent for this paragraph. Absent = family default (paper
       * indents body paragraphs except the page-1 opener and a continuation
       * run; magazine doesn't indent at all) — an explicit true/false always
       * wins over that default. A continuation run (a paragraph's tail after
       * a page break) never indents regardless of this field.
       */
      indent?: boolean;
      /** Optional paragraph-level typography overrides. Absent values inherit
       * the active template's body size and ink colour. */
      fontSize?: number;
      color?: string;
      /** Gallery text-card alignment. Article/editorial engines intentionally
       *  ignore it and keep using their template-level column alignment. */
      align?: 'left' | 'center' | 'right' | 'justify';
      /** Legacy v1 caret-image continuation. migrate() rejoins this text when
       * moving old article figures into Doc.images. */
      continuationOf?: string;
    }
  | {
      id: string;
      /** A display equation that stands on its own line, outside any paragraph.
       *  `tex` is verbatim LaTeX rendered by KaTeX in display mode; `caption` is
       *  an optional line under it. Atomic in the flow, like a figure. */
      type: 'equation';
      tex: string;
      caption: string;
      /** Caption text alignment. Absent = center (a display block reads centered). */
      align?: 'left' | 'center' | 'right';
    }
  | {
      id: string;
      /** Gallery slot image, plus the legacy v1 article-figure shape accepted
       * by migrate(). New article images belong in Doc.images instead. */
      type: 'figure';
      assetId: string;
      caption: string;
      /**
       * Width, in body columns: 1 = sits inside one flowing column (text beside
       * it in other columns keeps flowing independently — the only non-spanning
       * size). 2 | 3 | 4 = a spanning row (breaks every column, like 'body')
       * sized to that many columns' width. 'body' and 'bleed' are legacy values
       * retained so existing v1 files can be migrated without data loss.
       */
      span: 1 | 2 | 3 | 4 | 'body' | 'bleed';
      /** Caption text alignment. Absent = left (back-compat with v1 files). */
      align?: 'left' | 'center' | 'right';
      /**
       * Horizontal position of the image within its row when `span` is a
       * partial width (2 | 3 | 4) narrower than the row it's actually laid
       * out in — a 4-column figure only has room to move when the page also
       * carries a sidebar/rail column. For span 1 with `wrap` set to 'box' or
       * 'tight', this instead picks which side of the column the image floats
       * to (left/right only — 'center' falls back to 'left'). Ignored for
       * span 1 with `wrap` absent/'none', and for 'body' / 'bleed' (already
       * fill their row). Absent = 'center'.
       */
      pos?: 'left' | 'center' | 'right';
      /**
       * Text-wrap behaviour for a span-1 (single-column) figure only —
       * ignored for every wider span, which always wraps text as a full
       * rectangular box (there's no floating a CSS Grid spanning row).
       * Absent/'none' = today's behaviour: the image sits in the flow at full
       * column width, text above/below it but never beside it. 'box' floats
       * the image to the `pos` side of its column (rectangular wrap — text
       * runs beside it down to its bounding box). 'tight' also floats it but
       * additionally sets `shape-outside` from the image's own alpha channel,
       * so text hugs an irregular/transparent-background image's visible
       * silhouette instead of its rectangular box — most useful for PNGs with
       * transparent backgrounds. Both float modes need the source image
       * itself to have been exported with any transparency baked in; 'tight'
       * specifically needs an alpha channel to look different from 'box'.
       */
      wrap?: 'none' | 'box' | 'tight';
      /**
       * Emphasize: extend to the physical sheet edge on whichever side(s) the
       * image's rendered boundary actually sits closest to — left/right from
       * `span`+`pos` reaching the content edge, top/bottom from the image
       * landing as the first/last piece on its rendered page (where the page
       * allows it — a page whose top is already owned by a header/hero never
       * bleeds up into it). Ignored for span 1. A legacy `span: 'bleed'` block
       * implies this even when the field itself is absent.
       */
      bleed?: boolean;
      /**
       * Zoom/pan of the image inside its box, used by the gallery tiles to
       * reframe a photo without changing the tile size. Absent = fill (scale 1,
       * no shift). scale ≥ 1; offsets are percent of the box.
       */
      frame?: { scale: number; offsetX: number; offsetY: number };
    };

export interface Asset {
  /** data URL. Embedded into the .json so a saved file is self-contained. */
  src: string;
  naturalWidth: number;
  naturalHeight: number;
}

/**
 * A freely placed article image. Unlike gallery-slot figures, these images are
 * not part of `Doc.blocks` and therefore never split or otherwise participate
 * in paragraph flow.
 */
export interface PlacedImage {
  id: string;
  assetId: string;
  caption: string;
  /** Width is deliberately discrete: an image occupies whole grid columns. */
  widthCols: 1 | 2 | 3 | 4;
  /** Top-left anchor. Page is one-based; column is zero-based from the left. */
  anchor: { page: number; column: number; y: number };
  /** Caption text alignment. Absent = left for old/imported images. */
  align?: 'left' | 'center' | 'right';
  /** Extend artwork from its column-sized layout footprint to selected trim
   * edges. The source keeps its aspect ratio via cover-cropping; captions stay
   * aligned to the original footprint. */
  bleed?: { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean };
}

/** Optional free placement for the highlights/references callout. Like a page
 * image, its horizontal anchor snaps to the column grid while its vertical
 * anchor remains continuous within the physical sheet. */
export interface PlacedHighlights {
  widthCols: 1 | 2 | 3 | 4;
  anchor: { page: number; column: number; y: number };
}

/** Structured, not free text. The sample PDF's broken DOI is what free text costs. */
export interface Reference {
  id: string;
  authors: string;
  title: string;
  journal: string;
  year: string;
  doi: string;
}

export type FrontCoverTextRole =
  | 'masthead'
  | 'strapline'
  | 'kicker'
  | 'title'
  | 'subtitle'
  | 'author'
  | 'storyTag'
  | 'teaserTitle'
  | 'teaserBody'
  | 'footerBrand'
  | 'photoCredit';

/** Independent styling for one visible text object on magazine-4. */
export interface FrontCoverTextStyle {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  fontWeight?: number;
  /** em units. */
  letterSpacing?: number;
  visible?: boolean;
}

/** Dedicated controls for the fixed one-sheet front-cover composition. */
export interface FrontCoverDesign {
  alignment?: 'left' | 'center' | 'right';
  /** Distance from the masthead to the main story, in millimetres. */
  storyTop?: number;
  /** Percent of the safe page width occupied by the main story. */
  storyWidth?: number;
  /** 0..1 darkness placed over the cover photograph. */
  overlayOpacity?: number;
  kickerBackground?: string;
  teaserBackground?: string;
  /** 0..1 opacity of the teaser panel colour. */
  teaserBackgroundOpacity?: number;
  text?: Partial<Record<FrontCoverTextRole, FrontCoverTextStyle>>;
}

export interface Design {
  /** Body columns on page 1. Page 2 turns the sidebar slot into a text column. */
  bodyCols: 2 | 3 | 4;
  /** Body paragraph alignment. Absent = 'justify' (v1 files kept their look). */
  bodyAlign?: 'left' | 'center' | 'right' | 'justify';
  /**
   * Reading direction for body text, headers, captions and the highlights/
   * references box — for scripts like Arabic. Absent = 'ltr'. Flipping this
   * mirrors what's direction-aware for free (paragraph first-line indent,
   * multi-column reading order, default text alignment)
   * without touching layout chrome that isn't part of the running text — the
   * top bar, hero, sidebar placement and page margins keep their own explicit
   * left/right choices (barSide, pos, etc.) regardless of this setting.
   */
  textDirection?: 'ltr' | 'rtl';
  /** How a page's text columns are filled. Sequential is the editorial
   * default: every reading-order column is filled to the bottom before the
   * next one begins, leaving only the final column short when copy runs out. */
  columnFill?: 'sequential' | 'balanced';
  sidebar: boolean;
  /**
   * Where the highlights/references box sits. Absent = 'page1' (v1 files).
   * 'page1' = right rail, page 1 only. 'all' = right rail on every page.
   * 'below' = full-width block at the end of the article (in the text flow).
   * 'page1-flow' = single-column box at the end of the page-1 body flow, so
   *   body text fills the gap above it (col 4 top) before spilling to page 2.
   */
  highlightsPlacement?: 'page1' | 'all' | 'below' | 'page1-flow' | 'free';
  fontDisplay: string;
  fontBody: string;
  /**
   * Per-element font overrides. Absent = inherit the family that element used
   * before this setting existed (category/author/affiliation → body, subtitle →
   * display), so v1 files keep their exact look. See cssVars() for the mapping.
   */
  fontCategory?: string;
  fontSubtitle?: string;
  fontAuthor?: string;
  fontAffiliation?: string;
  /** Per-object typography and cover-only composition controls. */
  frontCover?: FrontCoverDesign;
  colors: { hero: string; accent: string; accentSoft: string; ink: string };
  /** Page/sheet background colour for every template. Absent = white. */
  paperBg?: string;
  /** Optional image painted behind every page. */
  pageBackgroundAssetId?: string;
  /** 0..1 opacity of the page background image. Absent = 1. */
  pageBackgroundOpacity?: number;
  /** Hide the article hero while retaining the document's top bar. */
  showHero?: boolean;
  /**
   * paper-2's top band. Absent = the defaults below, so v1 files and the other
   * templates (which never draw the band) are unaffected.
   * `barColor` = the rule itself, `barTagColor` = the block holding the tag
   * text, `barTagInk` = that text.
   */
  barColor?: string;
  barTagColor?: string;
  barTagInk?: string;
  /**
   * Which side the top bar's masthead/tag label begins on. Absent = 'left'
   * (v1 files, and every template's original look, are unaffected). Following
   * sheets alternate relative to this base side.
   */
  barSide?: 'left' | 'right';
  /** Physical distance from the page's top trim edge to the top bar, in mm. */
  topBarOffset?: number;
  /**
   * Physical top coordinate for the first page's main content, in mm. The top
   * bar is independent and remains at `topBarOffset`. Zero keeps the selected
   * template's native first-page composition.
   */
  firstPageTopMargin?: number;
  /** millimetres */
  margin: number;
  gutter: number;
  heroHeight: number;
  /** points */
  sizes: {
    categoryLabel: number;
    title: number;
    subtitle: number;
    author: number;
    affiliation: number;
    body: number;
  };
  /** Escape hatch. Injected raw into a <style> tag. */
  customCss: string;
}

export interface Doc {
  schemaVersion: number;
  /** Active layout template. Absent = 'paper-1' (v1 files keep their layout). */
  templateId?: TemplateId;
  meta: {
    categoryLabel: string;
    title: string;
    subtitle: string;
    author: string;
    affiliation: string;
    /** Dedicated top-bar label used by every template, e.g. "Research
     *  Highlights" or "KUANTA". It is deliberately independent of affiliation. */
    masthead?: string;
    /** Additional magazine fields. All optional for back-compat. */
    /** Caption under paper-2's top-right hero. */
    heroCaption?: string;
    /** Volume/date line, e.g. "VOL. IX · NO.2 · MARET 2026". */
    volume?: string;
    /** Location tag overlaid on the page-2 hero photo. */
    location?: string;
    /** Pull-quote body shown inside the spread. */
    pullQuote?: string;
    /** Pull-quote attribution, e.g. "— DR. ARIA PRATAMA, FEB 2026". */
    pullQuoteBy?: string;
    /** Credit line under the spread hero photo. */
    photoCredit?: string;
    /** Section heading over the highlights list. Absent = 'Highlights' — lets a
     *  non-English document (or just different house style) rename it without
     *  touching layout. Rendered verbatim (no forced case) so it works for
     *  scripts `text-transform: uppercase` has no effect on. */
    highlightsLabel?: string;
    /** Section heading over the reference list. Absent = 'References'. */
    referencesLabel?: string;
  };
  blocks: Block[];
  /** Article images are page objects, edited in Images rather than Content. */
  images: PlacedImage[];
  /** Present when highlights are manually arranged on a page. */
  highlightBox?: PlacedHighlights;
  highlights: string[];
  references: Reference[];
  hero: { assetId: string | null; offsetX: number; offsetY: number; scale: number };
  /**
   * Page-1 cover photo, distinct from the page-2 hero. Only magazine-1/-3/-4 read
   * it (their MagazineCover). Absent = fall back to `hero`, so v1 files and the
   * other templates keep their look — the cover only diverges once it's set.
   */
  cover?: { assetId: string | null; offsetX: number; offsetY: number; scale: number };
  assets: Record<string, Asset>;
  design: Design;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const emptyDoc = (): Doc => ({
  schemaVersion: SCHEMA_VERSION,
  templateId: 'paper-1',
  meta: { categoryLabel: '', title: '', subtitle: '', author: '', affiliation: '', volume: '' },
  blocks: [{ id: uid(), type: 'paragraph', text: '' }],
  images: [],
  highlights: [''],
  references: [],
  hero: { assetId: null, offsetX: 0, offsetY: 0, scale: 1 },
  assets: {},
  design: {
    bodyCols: 3,
    bodyAlign: 'justify',
    columnFill: 'sequential',
    sidebar: true,
    highlightsPlacement: 'page1',
    fontDisplay: 'Source Serif 4',
    fontBody: 'Source Sans 3',
    colors: { hero: '#0F2A5C', accent: '#C8102E', accentSoft: '#FDE7EA', ink: '#111418' },
    paperBg: '#ffffff',
    pageBackgroundOpacity: 1,
    showHero: true,
    topBarOffset: 0,
    firstPageTopMargin: 0,
    margin: 16,
    gutter: 5,
    heroHeight: 95,
    sizes: {
      categoryLabel: 8.5,
      title: 30,
      subtitle: 12,
      author: 9,
      affiliation: 9,
      body: 9.4,
    },
    customCss: '',
  },
});

/** Remove unused image asset data URLs from the doc's assets dictionary. */
export function cleanOrphanedAssets(doc: Doc): Doc {
  const used = new Set<string>();
  if (doc.hero?.assetId) used.add(doc.hero.assetId);
  if (doc.cover?.assetId) used.add(doc.cover.assetId);
  if (doc.design?.pageBackgroundAssetId) used.add(doc.design.pageBackgroundAssetId);
  for (const b of doc.blocks) {
    if (b.type === 'figure' && b.assetId) {
      used.add(b.assetId);
    }
  }
  for (const image of doc.images ?? []) {
    if (image.assetId) used.add(image.assetId);
  }
  for (const key of Object.keys(doc.assets || {})) {
    if (!used.has(key)) {
      delete doc.assets[key];
    }
  }
  return doc;
}

/** Bump this function, never the reader. Old files must keep opening. */
export function migrate(raw: any): Doc {
  if (raw.schemaVersion === SCHEMA_VERSION) {
    // Paper 3 was retired. Keep older saved files usable by opening their
    // content in the standard paper engine rather than rejecting the file.
    if ((raw as { templateId?: string }).templateId === 'paper-3') raw.templateId = 'paper-1';

    // v1 article figures lived between paragraphs. Move them into the page
    // image collection on read, while leaving gallery slot figures alone.
    // There was no page coordinate to preserve, so imported images start in a
    // tidy vertical stack on page 1 and can immediately be dragged into place.
    raw.images ??= [];
    if (familyOf(raw.templateId) !== 'gallery') {
      const kept: Block[] = [];
      let imported = 0;
      for (const block of raw.blocks as Block[]) {
        if (block.type !== 'figure') {
          const previous = kept.at(-1);
          if (
            block.type === 'paragraph' &&
            block.continuationOf &&
            previous?.type === 'paragraph'
          ) {
            previous.text += block.text;
          } else {
            if (block.type === 'paragraph') delete block.continuationOf;
            kept.push(block);
          }
          continue;
        }

        const totalCols = Math.min(4, Math.max(1, raw.design?.bodyCols ?? 3));
        const legacyWidth = (block.span === 'body' || block.span === 'bleed'
          ? totalCols
          : Math.min(totalCols, block.span)) as PlacedImage['widthCols'];
        raw.images.push({
          id: block.id,
          assetId: block.assetId,
          caption: block.caption,
          widthCols: legacyWidth,
          anchor: { page: 1, column: 0, y: Math.min(260, 16 + imported * 48) },
          align: block.align,
        } satisfies PlacedImage);
        imported += 1;
      }
      raw.blocks = kept;
    }
    return cleanOrphanedAssets(raw as Doc);
  }
  throw new Error(`Unsupported file version: ${raw.schemaVersion}`);
}
