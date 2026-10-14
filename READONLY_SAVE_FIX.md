# Read-only scrolling and Save repair — 14 October 2026

## Use this release

`deployment-artifacts/magazoo-image-height-readonly-save-20261014.zip`

This cumulative package supersedes the earlier image-height ZIP. It contains the image-height / Physics Letter changes described in `IMAGE_HEIGHT.md`, plus the fixes below. It includes source, tests, server code and the rebuilt `dist` folder. No live deployment has been performed.

## Fixed

- Read-only pages scroll without allowing editing. The preview is no longer an inert subtree; click/drag editing is blocked independently of scrolling. Keyboard navigation is available on the labelled preview region, and native touch panning is permitted.
- Image/highlight placement and cover dragging inherit read-only mode. Rendering a read-only article cannot silently save a new highlight position.
- The access button has a visible purple background and white text. Its previous white-on-white appearance came from conflicting button styles.
- The read-only banner and preview have separate, bounded scrolling areas. Long messages and wrapped buttons do not consume the entire viewport. Read-only objects no longer show editing hover outlines or draggable-image tooltips.
- Save repairs a stale “Unsaved changes” label when the current document is already saved. Loading an unchanged online copy no longer falsely marks it dirty.
- Real edits still write to the current save target. Saves remain serial: undoing to an earlier saved state while another write is in flight does not skip the required follow-up write.
- Online saves have a 30-second request timeout and require a valid newer server version before reporting success. Failed saves keep the edits and support manual retry; stale-version conflicts are not overwritten.
- One-editor-at-a-time ownership remains enforced by the server, not just by disabled controls.

## Verification

- Production build passed.
- 687 editor tests across 88 files passed, including manual Save, stale status, queued undo, retry, version acknowledgement and read-only placement regressions.
- All 30 server tests passed, including editing-ownership enforcement.
- Two real browser tabs against a disposable local server: first tab edited; second remained read-only and could not take the active lock.
- Changed the title, observed “Unsaved changes”, clicked Save, then reloaded the second tab and verified the persisted title.
- “Save & finish editing” allowed the second tab to acquire ownership. After closing that tab, the remaining tab could recover editing access. Immediate release on every type of browser closure is not guaranteed: the existing three-minute lease expiry handles crashes, disconnected browsers or undelivered close requests.
- Read-only scrolling verified with native wheel/keyboard interaction, including reaching the last of four pages. Desktop and 390-pixel-wide viewport checks found no outer-page horizontal overflow; the document itself retains its intentional scrollable full-size preview.
- Button colors verified as purple `#4f46e5` and white `#ffffff`. The small-screen banner left a usable scrollable document area.

Screenshots: `output/read-only-scroll-save-20261014.jpg` and `output/read-only-mobile-20261014.jpg`.

The CSS checks cover the reported read-only states and their shared preview controls; they are not a claim that every possible custom stylesheet or browser has been exhaustively audited.

## Upload and deploy

1. Back up the current application and database.
2. Upload the package's application files, or commit its source to the deployment repository. Build with Node 22.5+ using `npm ci` and `npm run build` if the host rebuilds from source.
3. Preserve the existing environment configuration and persistent data. Do not replace or remove `.env`, `.magazoo-data`, or your configured database directory. None is included in the ZIP.
4. Redeploy/restart through the existing hosting workflow and refresh the browser. If your server is older than the editing-lock release, deploy the included server files too; uploading only CSS is insufficient.
5. Smoke-test a disposable shared document with two tabs: edit and Save in one; confirm the other can scroll but cannot edit; finish editing and acquire access in the other.

No manual conversion of existing documents is required.

## Changed files for this repair

- `src/store/projectFiles.ts`
- `src/paper/PreviewReadOnly.ts` (new; must be included)
- `src/paper/PaperPreview.tsx`
- `src/paper/PlacedImages.tsx`
- `src/paper/useVerticalDrag.ts`
- `src/components/shared-editing.css`
- `src/styles/page.css`

Tests: `src/store/projectFiles.test.ts`, `src/store/sharedProject.test.ts`, `src/paper/PlacedImages.test.tsx`, `src/issue/IssueProof.test.tsx`. `dist` was rebuilt. The image-height change list is in `IMAGE_HEIGHT.md`. Temporary test servers and fixtures are excluded from the release.
