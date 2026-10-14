# Admin library and paragraph spacing — 15 October 2026

## Upload package

Use `deployment-artifacts/magazoo-admin-library-20261015.zip`. This is a cumulative application package with source, tests, server files, public assets and the rebuilt production `dist` folder. It includes the earlier image-height, editing-lock, read-only scrolling and Save fixes. The live website has not been changed.

## Admin library

The latest local source follow-up adds saved hero images to the article cards, with cover/gallery/news image fallbacks and a clean placeholder where no image exists. Preview images load lazily through an authenticated admin route. This follow-up requires both frontend and server files and is not included in the earlier ZIP above; use the approved source-publishing workflow in `GITHUB_WORKFLOW.md` for the current source.

Articles appear as responsive cards grouped by project. Each card keeps its original JSON filename, saved version, update date and the existing editor, private-link and delete actions. Project controls include Compile issue, Rename and Delete. New project and Add article open compact forms without losing a draft when the panel is closed.

Search examines filenames and project names across the entire library before pagination. It accepts multiple words, ignores case and accents, and treats punctuation, underscores and hyphens as separators. Project filtering and sorting work together with search. Sorting applies within each project. Choose 12, 24 or 48 cards per page. Changing pages scrolls back to the results and focuses the result count for keyboard users.

This is library search, not full-text search inside article bodies. The card list does not fetch every private article's JSON contents. Empty projects remain visible and can also be searched.

The admin interface has its own scoped styles, clear focus indicators, responsive forms and dialogs, and buttons with visible text and backgrounds.

## Paragraph spacing

Ordinary body paragraphs now follow one another without an added vertical gap and use a first-line indent. This applies to the paper article layouts, magazine article layouts, news body copy and the Dean's message. The newer reference article layouts already used this behavior.

Paragraph continuations remain flush because they are part of the same paragraph. Drop-cap opening paragraphs, explicit flush settings and manually chosen top spacing are respected. Headings, captions and decorative quotes keep their separate spacing. The News & Briefs option for explicitly spaced paragraphs remains available. Gallery descriptions and separate content cards retain their layout spacing.

Column leveling no longer inserts a paragraph gap when the paragraph's normal gap is zero. Dean quote continuations use the same zero top padding in measurement and rendering, preventing a split quote from consuming unexpected space.

Existing articles using default paragraph spacing will reflow. Review compiled issue page numbers and contents entries before final publication.

## Verification

- Production build passed; the upload package also passes a clean install and production build after extraction.
- Full editor suite: 706 tests across 90 files passed. After the final Dean quote-padding repair, all 20 focused front-matter and column-leveling tests passed, including the additional regression test.
- All 30 server tests passed during this release verification.
- Admin browser checks used a disposable local server: search across pages, project filters, article/project creation, dialog sizing, empty projects, and successful issue compilation.
- Responsive admin checks covered 320, 390, 560, 768, 1024 and 1440-pixel widths. No horizontal overflow or clipped card controls was found, including a 115-character unbroken filename. Rename and delete dialogs were opened and cancelled; no production data was deleted.
- Actual rendered paragraph checks covered all eight paper article layouts, all three magazine article layouts and the Dean's message. Normal paragraph margins were zero, indents were present, the explicit flush override remained zero, and all 24 sample paragraphs remained in the generated pages.

Proof images: `output/admin-library-20261014.png` and `output/paragraph-spacing-20261014.png`. These show disposable test content.

## Dependency audit

The clean install builds successfully, but the current dependency audit reports three advisories in the existing lockfile. `source-map-js` and `undici` have high-severity advisories in development dependencies used by Vite/jsdom. A production-only audit reports one low-severity advisory for KaTeX 0.16.47: [trust restrictions can be bypassed when prototype pollution already exists](https://github.com/advisories/GHSA-238p-pmpm-9mq7). No high-severity production dependency advisory was reported by that check. This UI release does not update dependency versions; it is not a dependency-security release.

## Deploy

1. Back up the existing application and database.
2. Upload the application files from the ZIP or commit its source to the deployment repository. If the host builds from source, use Node 22.5 or newer, `npm ci`, then `npm run build`.
3. Preserve the server's existing `.env`, `.magazoo-data` and configured database directory. Credentials and persistent data are excluded from the ZIP.
4. Restart/redeploy using the existing hosting workflow. Reload existing editor and admin browser tabs after deployment so they use the new build's assets.
5. Check admin search, open a disposable article, save an edit, and compile a sample issue. Review the issue's page numbers after the paragraph reflow.

## Changed source files for this update

- `src/admin/AdminPage.tsx`
- `src/admin/AdminLibrary.tsx`
- `src/admin/AdminIcon.tsx` (new)
- `src/admin/libraryModel.ts` (new)
- `src/styles/admin.css`
- `src/styles/page.css`
- `src/styles/magazine.css`
- `src/styles/news.css`
- `src/styles/front-matter.css`
- `src/paper/Flow.tsx`
- `src/paper/FrontMatterPages.tsx`
- `src/lib/fullColumnLevel.ts`
- `src/schema/document.ts` (documentation comment only)

Tests: `src/admin/AdminPage.test.tsx`, `src/admin/AdminLibrary.test.tsx`, `src/admin/libraryModel.test.ts`, `src/paper/FrontMatterPages.test.tsx`, `src/lib/frontMatterLayout.test.ts` and `src/lib/fullColumnLevel.test.ts`. The production `dist` folder was rebuilt. Temporary fixtures and local test servers are excluded.
