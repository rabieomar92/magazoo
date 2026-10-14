# Exclusive shared editing and bilingual writing guide — 13 October 2026

## Shared documents: one editor at a time

Opening a shared editing link reserves that document for the first tab. Other
visitors see a read-only preview and **Check & start editing**. They cannot edit
or save until ownership becomes available. Different documents remain independent.

- **Save & finish editing** saves the current work and releases ownership. It
  does not release access if the save fails or newer typing is still unsaved.
- Closing or leaving the editor attempts a small background release request.
  Browser shutdown, forced tab closure, suspended tabs and network failures can
  prevent that request. The reservation expires within approximately three
  minutes of its last successful renewal/save; another visitor can then retry.
- Switching tabs does not deliberately release access. The editor renews its
  reservation every 20 seconds while the browser can run it.
- If ownership cannot be confirmed, editing pauses. Unsaved work stays in that
  tab, with a browser recovery backup and a **Download my unsaved draft** action.
  No browser can guarantee that the very last keystrokes survive a hard crash;
  use Save before closing and download a copy if there is a connection warning.
- A reconnect retrieves the current server version. A recovered draft based on
  an older version is preserved for download, not silently merged or overwritten.
  The author can explicitly choose **Load latest after saving my copy**.
- No editor names are collected. The notice says another editor is active.

The server, not just the UI, checks ownership on every save. A private, per-tab
identifier is held only in memory, never in the project file or recovery backup.
Existing version checks remain an additional guard against stale writes. SQLite
transactions grant only one reservation, including across processes using the
same database. Reservations survive server restarts. Issue finalisation and
deletion reject changes to a document with an active editor; compiling a preview,
reading and renaming are not author-content writes.

This is exclusive editing, not collaborative merging or a live-updating reader.
Read-only previews refresh when the visitor checks for access. There is no
force-takeover button that could discard another author's work.

## Writing controls

- Font controls use the same family → size → weight/style → colour → letter
  spacing → line spacing → alignment order. Paragraph layout controls follow.
- **Format text ↗** beside a paragraph selects its existing contextual controls.
  The document's typography settings, undo/redo and layout engine are unchanged.
- Each paragraph has a compact sentence-length guide: word count, sentence
  count and average words per sentence. Expand **Writing coach** for suggestions.
  Multi-paragraph story fields also show separate paragraph metrics.
- Choose **Auto**, **English**, or **Bahasa Melayu** per writing field. Automatic
  detection is approximate; use manual selection for short or mixed-language copy.
- Suggestions cover common punctuation/spacing, repeated words, unmatched
  brackets/quotes and formatting markers, selected English grammar patterns,
  selected Malay prefix/preposition patterns, and long or unnecessarily formal
  expressions. Scientific notation, URLs, email and inline code are protected
  from most punctuation checks. Text inside maths/code is not grammar-checked.
- Highlighted excerpts show the passage to review. Clicking one selects it in
  the original field. **Ignore for this text** dismisses a suggestion locally.
  No changes are applied automatically. Language choices and dismissals are
  local UI preferences and reset when that editor field unmounts/reloads.
- The guide appears in body paragraphs across templates, news stories, gallery
  descriptions, news captions and narrative front-matter fields. Names, contact
  details and equation source are not treated as prose paragraphs.

All checks run locally: no API subscription, AI service or external transmission
of drafts is used. These are transparent, limited rules, not comprehensive
grammar/spelling correction or a guarantee of correctness. Sentence length is
an editorial readability indicator, not a validated Malaysian reading-age score.
Scientific accuracy, meaning, terminology and reader testing still matter.

The coaching approach uses brief actionable feedback, familiar examples,
progressive disclosure and optional review rather than grades or forced changes.
The sentence-length target is a flexible editorial starting point for either
language, not a claim that English and Malay have identical readability scales.

Background guidance: [CDC plain-language advice](https://www.cdc.gov/health-literacy/php/develop-materials/plain-language.html)
and [limitations of readability formulas](https://www.cdc.gov/ccindex/tool/index-different.html).
Malay location-word examples can be checked in [DBP's language advice](https://prpm.dbp.gov.my/Cari1?d=175768&keyword=kata+sendi+nama).

## Deploy the complete update

Use **deployment-artifacts/magazoo-edit-lock-writing-20261013.zip**. This is a
cumulative package including the previous article, B5, typography and top-bar work.

1. Ask current editors to save/download any outstanding drafts and close their
   editing tabs before deployment. Older browser builds cannot save without the
   new reservation header once the server is upgraded; reload after deployment.
2. Back up the live application and SQLite data using the hosting provider's
   supported backup process. Preserve `.env`, hosting secrets, `.magazoo-data`
   and any configured `MAGAZOO_DATA_DIR`. They are intentionally NOT in the ZIP.
3. Deploy the complete `server/` and frontend together, with the included source,
   public assets, package files and build configuration. Install locked dependencies
   with `npm ci`, build with `npm run build`, then restart the Node application.
   The included `dist/` is already built for a root-domain deployment.
4. Keep the existing origin and database configuration. On startup the server
   adds `document_edit_locks` without rewriting project documents or arrangements.
   All server processes must share this same persistent SQLite database. Separate
   per-instance databases cannot coordinate editing ownership.
5. Open one shared link in two tabs. Confirm only the first is editable. Save and
   finish there, then check access from the second and confirm the saved text.
   Test the writing guide with both languages before resuming normal editing.

Uploading only the server or only the frontend is insufficient. GitHub Pages
alone cannot provide server-enforced editing locks. This release has NOT been
automatically deployed to magazoo.usmphysics.org. See SERVER_SETUP.md for hosting.

The previously noted dependency advisories remain outside this update's scope;
this package is not a complete security audit or a press-production sign-off.

## Verification

659 frontend tests across 86 files and all 30 server tests pass. The production
build passes. Lint has no errors; pre-existing warnings remain.

Production build and automated suites cover ownership, stale saves, expiry,
heartbeat failure, safe recovery, loading cancellation, local autosave after
Save As, bilingual patterns, paragraph metrics and exact source selection.
Server tests additionally cover simultaneous arrivals, wrong-origin requests,
restart persistence, multiple database connections and atomic finalisation.

Browser smoke tests use an isolated local server with an in-memory test document,
not the live website or production database. Checks include two-tab blocking,
save-and-finish handover, preservation of saved text, and both language guides.
Forced tab closure may rely on lease expiry rather than an unload notification.

Proof images: `output/edit-lock-readonly-20261012.png` and
`output/bilingual-writing-guide-20261012.png`.

## Changed source files

Server: `server/editLocks.mjs`, `server/editLocks.test.mjs`, `server/storage.mjs`,
`server/app.mjs`, `server/app.test.mjs`.

Access and saving: `src/store/editLease.ts`, `src/store/editLease.test.ts`,
`src/store/sharedProject.ts`, `src/store/sharedProject.test.ts`,
`src/store/projectFiles.ts`, `src/store/projectFiles.test.ts`,
`src/store/persist.ts`, `src/App.tsx`, `src/App.editing.test.tsx`, `src/Root.tsx`,
`src/components/SharedEditingAccess.tsx`, `src/components/shared-editing.css`.

Writing and controls: `src/lib/writingCheck.ts`, `src/lib/writingCheck.test.ts`,
`src/panel/WritingGuide.tsx`, `src/panel/WritingGuide.test.tsx`,
`src/panel/writing-guide.css`, `src/panel/Field.tsx`,
`src/panel/TypographyToolbar.tsx`, and `src/panel/sections/` files:
`BodySection.tsx`, `NewsSection.tsx`, `GallerySection.tsx`,
`FrontMatterSection.tsx`, `NewsImageEditor.tsx`.

Also included: this guide, updated SERVER_SETUP.md, proof images and rebuilt dist/.
