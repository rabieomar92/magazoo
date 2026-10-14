# Page-image height and Physics Letter alignment — 14 October 2026

## What's changed

- **Images → Page images → Image height (mm)**: enter a precise height or use the slider. Each image has its own saved height, independent of its column width.
- **Use original proportions** removes the override. Existing documents keep their original image sizing until a height is edited.
- Available in every existing independent page-image editor: Paper 1–8 and Magazine 1–3, including continuation pages. Fixed gallery slots, news photos and front-matter artwork remain on their separate image systems; this change does not add free-floating page images to those templates.
- Custom frames range from 1 mm to the composition's full height (297 mm for A4 compositions, 276 mm for reference-proportion articles). These are layout dimensions; B5 export scales the entire composition proportionally as before.
- Photos crop rather than stretch. Existing zoom, pan, contour wrapping, caption alignment and explicit bleed settings still apply. Vertical bleed intentionally extends the frame to the selected trim edge; choose None to use the exact entered height.
- Resizing keeps the image frame within its page. Captions that no longer fit below the frame shift over the bottom of the photo instead of being cut off at the page edge.
- **Physics Letter / Paper 2 hero** meets the bottom of the top bar on either side. The title retains its independent top spacing. With the top bar hidden, the hero meets the top of the sheet. Hiding the hero does not lift the text column.
- The visible text regions and pagination measurement regions use the same updated geometry.

## Verification

- Production build passed.
- 680 editor tests in 88 files passed (`npm test -- --maxWorkers=2`). The unrestricted parallel run hit five test timeouts under local resource contention; the complete bounded-concurrency rerun passed without changing timeouts or skipping tests.
- All 30 server tests passed; no server source changes were needed for this feature.
- Browser checks at narrow and desktop widths verified Physics Letter hero/title positioning. Hero-to-bar difference was below 0.01 CSS px, with the authored 40 mm title position retained. Left-side hero, hidden hero and hidden top bar were checked.
- All 11 independent page-image templates rendered a 95.5 mm frame; browser line-box checks found no body text crossing those test frames and captions stayed within the page.
- Save/reload, undo/redo, width changes, original-proportions reset, slider input, invalid saved heights and per-image independence are covered by tests.
- A full-height 297 mm frame kept its caption within the trim.
- The generated B5 print document contained two pages, the final 176 × 250 mm page rule, proportional fitting, the 95.5 mm layout-height override and the aligned Physics Letter hero. This checks the browser print document, not a physical print from a particular printer.

Visual checks: `output/page-image-height-20261014.jpg` and `output/physics-letter-hero-20261014.jpg`.

## Deploy

Use `deployment-artifacts/magazoo-image-height-20261014.zip`. This is a cumulative source-and-build package, including the earlier editing-lock and bilingual writing-guide work.

1. Back up the current application and its live database.
2. Replace the application source/build with the package contents, or commit the included source to your deployment repository and rebuild with `npm ci` followed by `npm run build`.
3. Preserve the server's existing environment settings and persistent data directory. The package does not include credentials, `.env`, `.magazoo-data`, databases or `node_modules`.
4. Redeploy/restart using your normal hosting workflow, then refresh the editor. Existing saved articles need no manual conversion or database migration.

The live website has not been deployed by this task.

## Changed source files for this feature

- `src/schema/document.ts`
- `src/lib/placedImage.ts`
- `src/lib/paper2.ts`
- `src/panel/sections/ArticleImagesSection.tsx`
- `src/paper/PlacedImages.tsx`
- `src/paper/PaperTwo.tsx`
- `src/paper/PaperPreview.tsx`
- `src/styles/page.css`
- `src/styles/paper2.css`

Tests: `src/lib/placedImage.test.ts`, `src/lib/paper2.test.ts`, `src/panel/sections/ArticleImagesSection.test.tsx`, `src/paper/templateImageCoverage.test.tsx`. Documentation: this file and the updated image-height rule in `CLAUDE.md`. `dist` was rebuilt. Temporary browser fixtures are excluded from the package.
