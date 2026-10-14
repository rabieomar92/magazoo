# Article 4–8 editing compatibility — 12 October 2026

This release closes the editing gaps in the five new reference-inspired article
layouts. It retains the existing document format, editor panels and undo/redo
store. It does not replace the other template families or add their unrelated
special-purpose features (such as a dean's signature or gallery-specific slots)
to an article.

## Where to edit

| Feature | Existing controls used by Article 4–8 |
| --- | --- |
| Text, paragraph overrides, equations and decorative quotes | Content tab; contextual top typography toolbar |
| Font family, size, colour, alignment, line spacing and letter spacing | Top typography toolbar; choose the relevant text group or paragraph |
| Hero image, crop, zoom, height and caption | Images tab; caption typography in the top toolbar |
| Independent images | Images tab: add/replace/remove, page, column width, crop, caption and contour; drag on the page |
| Highlights and references | Highlights tab: visibility, headings, text, add/remove, free placement, column width and page |
| Five highlight placement modes | Design → Highlights position |
| Columns, margins, gutters, colours and image-matched palette | Design tab |
| Bottom-edge hero | Design → Photograph rises from the foot of the page |
| Inset hero side (Article 8) | Images → existing left/right placement control |
| Masthead, footer and per-page margin text | Existing shared controls; contextual typography toolbar |
| Save/reopen, undo/redo, issue compilation and A4/B5 export | Existing editor and Issue Studio commands |

The subsequent component-typography update adds independent highlight and heading
font controls. See `TYPOGRAPHY_TOPBAR.md` for the current controls and upload package.

## Behaviour repaired

- All five highlight modes now reserve the appropriate article space. Free boxes
  can move and change width without being replaced by a fixed end-of-copy box.
- Free boxes use the actual page height, snap to columns and avoid images and
  headings. Saved anchors beyond the populated article are clamped for display,
  rather than generating dozens of blank pages.
- Read-only compilation and measurement cannot move the editable document's box.
- Independent images and highlights use the same normalized article grid.
- Equations no longer create nested multicolumn text inside an article column.
- Image-derived colours keep highlight text readable; disabling the option
  restores manual colours and preserves local text overrides and background art.
- Lowered mastheads and bottom-edge heroes reserve space before text is flowed.

## Verification

On 12 October 2026: production build passed; 555 frontend tests in 79 files and
25 server tests passed. Lint had no errors, with existing warnings remaining.

Browser checks covered all five layouts × all five highlight positions with
long copy and a placed image. Additional checks covered bottom and hidden heroes,
right-to-left reading, two-column layouts, mirrored inset imagery, styled text,
paragraph-level overrides, decorative quotes and equations. Highlight editing,
width changes, dragging, undo/redo and a JSON save/reload round-trip were checked.
Oversized content was flagged rather than silently exported clipped.

A mixed issue containing the five articles, a cover and a two-page gallery
compiled to eight pages. The real exporter's prepared A4 (210 × 297 mm) and ISO B5
(176 × 250 mm) print sheets retained the highlight boxes and kept source pages
and text frames within their bounds. These were browser print-document checks,
not a saved operating-system PDF or a physical press proof.

Screenshot: `output/article-parity-proof-20261012.jpg`.

## Files changed in this compatibility follow-up

Production:

- `src/lib/articleLayouts.ts`
- `src/lib/placedHighlights.ts`
- `src/lib/textTracking.ts`
- `src/panel/sections/ArticleImagesSection.tsx`
- `src/panel/sections/DesignSection.tsx`
- `src/panel/sections/HeroSection.tsx`
- `src/panel/sections/HighlightsSection.tsx`
- `src/paper/ArticlePages.tsx`
- `src/paper/Flow.tsx`
- `src/paper/PaperPreview.tsx`
- `src/paper/PlacedImages.tsx`
- `src/paper/useImageTheme.ts`
- `src/styles/article-layouts.css`

Regression tests:

- `src/lib/articleLayouts.test.ts`
- `src/lib/placedHighlights.test.ts`
- `src/panel/sections/DesignSection.test.tsx`
- `src/paper/Flow.singleColumn.test.tsx`
- `src/paper/PlacedImages.test.tsx`
- `src/paper/useImageTheme.test.tsx`

Documentation: this file and `ARTICLE_LAYOUTS.md`. The complete deployment bundle
also includes the earlier article-layout, B5 and server work already in this
workspace, plus the rebuilt `dist/`; use it instead of uploading isolated files.
Temporary browser fixtures, dependencies, credentials and databases are excluded.

## Deployment and limits

The current cumulative package is `deployment-artifacts/magazoo-typography-topbar-20261012.zip`;
it supersedes this article-parity package and the older 7 October layout bundle.
Back up the existing site, preserve its environment
settings and data directory, then follow `SERVER_SETUP.md`. No database migration
is introduced by this follow-up. Nothing has been deployed automatically.

Review a saved PDF with your actual content before publishing. Very large text,
images or boxes can still exceed a page; resolve the overflow warning first.
The layouts remain editable interpretations, not pixel-identical RIKEN copies.
The previously reported dependency advisories remain unresolved; see
`ARTICLE_LAYOUTS.md`. This is not a security sign-off or a guarantee covering
every possible combination of settings.
