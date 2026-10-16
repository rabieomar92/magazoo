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

- Select **Image-led Feature** under **Article**, then choose **Editorial**,
  **Immersive bleed** or **Panoramic bleed** in **Composition**. Their saved
  template IDs and renderers are unchanged. Article 6–8 remain separate choices.
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

## Shared image tools — 16 October 2026

- **Design → Match page colour to a photo** is available in every template.
  Choose an embedded photograph, click an unobstructed background area, then
  **Apply sampled page colour**. Sampling is local and uses only a small patch,
  so foreground subjects elsewhere in the image do not determine the colour.
  The command sets a solid page base and contrasting theme ink, turns off
  automatic hero colour matching, and clears a separate page-background graphic.
  Existing full-bleed photos and explicit text-colour overrides remain unchanged.
  Linked images and SVG placeholders are not sampled; upload a bitmap photo.
- **Images → Page images → Text wrap shape → Draw outline** is available in
  every article/editorial layout that supports independent page images. Choose
  **Draw border** on the image (or **Draw border on canvas** in the panel), then
  trace the subject directly on the actual page. There are no point/coordinate
  inspection controls. A compact floating toolbar offers Undo stroke, Rectangle,
  smoothing, text gap, Cancel and Apply border. **Apply border** saves one undoable
  change; drawing does not continually save or repaginate the article. Escape
  cancels the draft. Finish or cancel a border draft before exporting.
  The image outside the outline is clipped transparently. Copy now follows the
  border **line by line** using native CSS Shapes within the existing fixed-width
  column grid. Curve smoothing and text clearance are adjustable; a two-pixel
  optical guard protects letter overhang even at zero clearance. The saved
  control points remain separate from the sampled curve, preventing drift.
  Unreadably narrow lanes are skipped until the contour leaves room for words.
  Opposing images that leave no single-side text lane reserve that line safely;
  atomic figures/equations may move to a later clear region.
- **Caption position → Free position** provides independent X, Y and width
  controls for every page image; captions can also be dragged independently.
  Hover/focus a caption to reveal left/right width handles. Drag either handle
  to resize; arrow keys adjust by 1mm (Shift: 5mm). Resizing commits once on
  release, supports undo and never changes the caption's words or image anchor.
  Body text avoids the measured caption box. Captions are nudged to the nearest
  space outside drawn image borders (including concave pockets), and stay inside
  the sheet. Drawing, image resizing and source text are independent. An impossible
  caption position produces a fit warning; reduce its width/font size or move the
  image. Read-only previews never persist the automatic safe-position adjustment.
- Image hover/focus reveals Move image and Draw border together. Dragging remains
  column-snapped horizontally and free vertically; the move button also supports
  arrows (one column horizontally, 1mm vertically; Shift: 5mm vertically). Clicks
  do not save a fake movement, canceled drags roll back, and transparent cut-out
  space passes pointer input through to the text. Read-only views expose no
  editing handles; none of these controls enter the PDF. Paragraph hover uses a
  subtle text-only cue instead of a solid rectangle over cut-out artwork.
- A three-line drop cap gets a measured clear opening before contour-wrapped
  continuation text. This avoids Chromium's initial-letter/CSS Shapes conflict
  without changing the authored text, font sizes, fixed column widths, or the
  shared three-line first-letter rule.
- Uploading/replacing a hero explicitly restores its visibility (and a positive
  height if previously set to zero). A contextual Show image action also reveals
  an existing hidden hero without uploading again. Typing during image decoding
  no longer cancels the upload; a new document session, newer replacement, or
  unmounted picker still prevents late uploads from changing the wrong target.
- **Use hero as a wrapped page image** reuses the source and crop, copies its
  caption, hides the original hero placement, and adds an outline-ready image.
  Position and size it with the existing page/column/height/bleed controls.
  Undo restores the original hero placement; no photograph or text is deleted.
- **Inset Research** also has one-, two- and three-column hero widths, left/right
  placement, and **Design → Top to title**. The measured caption reserves normal
  spacing rather than a fixed blank band. A visible masthead always retains its
  clearance; entering zero or resetting restores the automatic title position.

### Freely placed hero captions and consistent initials — 16 October 2026

Hero and cover captions can be dragged outside the photo crop, anywhere within
their own sheet. Their native position remains unchanged until deliberately
moved. The Images panel provides X/Y/width and Reset caption position; arrows
move 1mm, Shift-arrows 5mm. A gesture saves once on release and is undoable.
Canceled gestures do not create saves. Read-only output retains the saved
position without editing handles. Body text excludes the moved caption's box;
the existing native caption slot is retained to prevent an unrelated layout jump.

Drop caps use the title font, including toolbar font overrides and independent
news-headline overrides, without changing the native three-line fitting rule.
Contour wrapping now skips unreadably narrow text lanes: it requires nine body
ems, capped at 75% of the fixed column width, before putting text beside a cutout.
The image outline, authored wording, column widths and alignment stay unchanged.

Current verification: 1,124 frontend tests in 114 files, production build and
lint pass (two pre-existing warnings). Browser checks cover 33 title-font/layout
combinations and 21 Editorial shape/size combinations with no detected collisions
or lost paragraph words. Caption dragging was checked at fit and 105% zoom,
with undo, JSON reload and read-only mode. A4/B5/203 × 267mm prepared print clones
retain caption coordinates and text line breaks within 0.01 CSS px, and contain
no editor handles. This is not an exhaustive check of every authored outline,
nor a test of an OS print dialog. Production data and credentials were untouched.

Earlier canvas-editor verification (16 October 2026): 1,103 editor tests across
112 files, 38 server tests, production build and lint pass (two pre-existing
lint warnings). Ninety-nine browser cases cover three image configurations in
all 11 article/editorial layouts at A4, B5 and 203 × 267mm. Each checked layout
retains the copy, avoids image/caption collisions and fits the initial alongside
exactly three lines. Thirty-three prepared print comparisons preserve line
positions within 0.01 CSS px. Actual pointer gestures exercise image movement,
caption resizing, stroke drawing/undo and read-only controls. A real file-picker
upload restores a previously hidden hero; async upload tests preserve intervening
text edits and reject a changed document or newer image. PDF controls are stripped,
and export refuses an unfinished border draft. No live data or credentials changed.

Verification (16 October 2026, earlier contour pass): 1,074 editor tests across 109 files, 38 server
tests and the production build pass. Lint has no errors; two pre-existing
warnings remain outside this work. Final browser checks cover 165 size/outline
cases, 44 rich-text/equation/long-caption cases, and 33 multi-image compositions
across the 11 article/editorial layouts. Tested shapes include rounded, concave,
self-crossing, rectangular and dense paths; cases include RTL, bleed, 1mm frames,
one/four-column widths and independent captions. No image/text or caption/text
collisions, fit warnings or lost paragraph words were detected in those cases.

Thirty-three final print-clone comparisons (A4, B5 and 203 × 267mm for each
layout) preserve line breaks and positions, within 0.01 CSS px. The exporter
now retains inherited document language, so hyphenation cannot silently change
in its iframe. Styled split candidates are measured with their final formatting
markers closed, matching the committed text rather than a different plain font.
Reference compositions refit from original blocks if a real rendered line still
exceeds its measured region. An impossible caption fit blocks export explicitly.

Local evidence is in `output/contour-caption-20261016/` (not application source).
These checks are not an exhaustive guarantee for every possible outline/content
combination, nor a test of an operating-system print dialog or physical printer.
Review fit warnings and the saved PDF before publication. No production database,
credentials or deployment settings were changed by this work.

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
