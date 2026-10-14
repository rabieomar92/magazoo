# Article layout and editing update — 12 October 2026

## Five reference-inspired designs

The ranking below favours striking edge-bleed imagery, followed by clarity and
efficient use of a four-column grid. Page numbers are the **printed** numbers in
[RIKEN Research, Winter 2025](https://www.riken.jp/medialibrary/riken/pr/publications/riken_research/2025/rr202512.pdf).

| Rank | Magazoo layout | Reference page | Structure |
| --- | --- | --- | --- |
| 1 | Article 4 — Immersive Bleed | 19 | Large top photograph fading into a dark page; headline over two columns; two columns begin beside the headline. |
| 2 | Article 5 — Panoramic Bleed | 15 | Edge-to-edge photograph fading into a coloured page; wide headline; four aligned body columns. |
| 3 | Article 6 — Stepped Image Lead | 16 | Top-edge photograph; three-column headline with the fourth body column starting alongside it. |
| 4 | Article 7 — Airy Edge Bleed | 12 | White illustration-led page with edge-bleed artwork, wide headline, and four aligned columns. |
| 5 | Article 8 — Inset Research | 13 | Wide headline; first text column beside a large image spanning columns two to four; copy continues beneath the image. |

The reference PDF was measured, not only viewed: its trim is 210 × 276 mm;
the grid has 14 mm side margins, four 42.5 mm columns, and 4 mm gutters.
All continuation pages retain the same column width. Larger headings and
captions reserve additional space; article copy continues onto further pages.
Independent photographs retain the existing crop, drag, grid-snap, bleed,
caption, and contour controls, with text kept outside their occupied areas.

These are editable layout reproductions, **not pixel-identical copies** of the
published pages. RIKEN uses proprietary Minion Pro and Proxima Nova fonts and
licensed photographs. This update supplies original demonstration copy and
vector artwork, using Magazoo's fonts plus Georgia for the reference-style body.
No magazine photograph, article text, or embedded font file is bundled.

## Using the templates

- Select **Article 4–8** under **Article** in the layout chooser.
- When switching an existing document, its content and design are preserved.
  For the reference's intended defaults, open **Design → Apply reference design
  defaults**. This is undoable; paragraphs, photographs and local text overrides
  are not deleted.
- All five use the same Content, Images, Highlights and Design tabs. Font controls
  remain in the top toolbar. Select body text, a paragraph or the hero caption
  for the relevant controls, including letter spacing.
- **Design → Page proportions** offers the original reference trim or A4. A4
  extends the text area below the composition rather than stretching pictures.
- Highlights/references support all five existing positions: first-page sidebar,
  flowing end-of-copy box, every-page sidebar, full-width end box, and free placement.
  Use **Highlights → Arrange freely on page** to drag the box, change its column
  width or choose its page. Text wraps around it; the layout avoids photographs
  and the first-page heading. Edit headings, highlight text and references in
  the same tab. A red overflow warning must be resolved before export.
- Shared image-matched colours and bottom-edge hero placement are available in
  **Design**; Article 8 also offers the existing left/right hero control in
  **Images**. Turning image-matched colours off restores the manual palette.
- See `ARTICLE_PARITY.md` for the editing features, regression checks and the
  scope of this compatibility update.

## A4 and B5 output

Both the editor and Issue Studio offer A4 and **ISO B5, 176 × 250 mm** output.
The exporter fits complete source pages proportionally, preserving text,
vectors, image crops and line breaks. It does not stretch or crop artwork.
Different source/output proportions create centred allowances filled with the
page's background colour. An image reaches its source-page edge, not necessarily
the output-sheet edge when those proportions differ.

In the browser print dialog, use the selected paper size, **100% scale**, no
printer margins, background graphics enabled, and browser headers/footers off.
This is trim-size output, not a commercial-press PDF with added bleed or crop marks.
Always review the saved PDF before sending it to a printer.

## Deployment

Deploy the complete accompanying source bundle and rebuild; do not upload only
one or two changed components. It includes the current `src/`, `public/`,
`server/`, package files and build configuration, but no local credentials or
database. The prebuilt `dist/` is also included.

For the existing Node deployment: Node 24.x, install `npm ci --include=dev`,
build `npm run build`, and start `npm start` (`server/index.mjs`).
Preserve production environment settings and `.magazoo-data/` or your configured
data directory. Take a normal backup first. No database migration is added by
these article layouts. See `SERVER_SETUP.md` for hosting details.

The website is not redeployed automatically by this task.

## Verification performed

- Production TypeScript/Vite build: passed.
- Complete ZIP extracted into a fresh folder, dependencies installed with
  `npm ci --include=dev`, and production build repeated successfully.
- Frontend automated suite: 555 tests passed across 79 files.
- Server automated suite: 25 tests passed.
- Lint: no errors; existing development-only/export-structure warnings remain.
- Each new layout: default page inspected; six times the demonstration copy
  plus an independent two-column photo paginated to three pages without losing
  paragraph text, overlapping the photo, or overflowing the text frames.
- A mixed issue containing all five new articles, a cover and a two-page gallery
  compiled to eight pages. The real exporter's prepared A4 and B5 print documents
  were measured in the browser: every source page stayed within its output sheet
  and the text frames remained inside their bounds.
- Caption font size, letter spacing and alignment were exercised independently;
  an oversized caption was detected as an overflowing layout.
- All five highlight positions were checked in each new article layout with
  long copy and an independent placed image. Paragraph text was retained and
  the rendered text frames did not overflow. Free boxes were also checked with
  bottom/hidden heroes, right-to-left text, two columns and styled content.
- Highlight text editing, column width, dragging, undo/redo and saved-document
  reload were exercised. Read-only issue rendering cannot write highlight anchors
  into the editor document. Equation flow has a dedicated single-column regression
  test; image-matched palettes have contrast and manual-palette restoration tests.

The print-document checks do not replace reviewing a PDF saved by your browser:
the operating-system print dialog and a physical printer were not tested here.
Neither a pixel-identical RIKEN result nor an unrestricted guarantee for every
possible combination of content and settings is claimed.

### Dependency audit warning

The dependency audit originally run on 7 October 2026 reported three existing dependency
advisories: `source-map-js` and `undici` (high), and `katex` (low). These are
unresolved in this bundle. Dependency versions were not changed as part of the
layout work; this is not a security-clean release. Review and address these
separately before treating it as a production security sign-off. Do not apply
`npm audit fix --force` without testing the resulting dependency changes.
