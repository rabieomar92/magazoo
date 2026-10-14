# Top-bar visibility and component typography — 12 October 2026

This update applies to all 21 document templates, including Article 4–8,
the four galleries, news, front matter and both dedicated covers. It includes
the earlier article compatibility work described in ARTICLE_PARITY.md.

## Using the controls

- **Design → Show top bar** shows or hides the running masthead bar throughout
  that document, including continuation pages. Text, colours and alternating
  side are preserved when it is hidden. Page footers, margin text and the
  front-cover publication title remain independent.
- Dedicated front/back covers retain their previous default: no running bar.
  It can now be enabled explicitly. The back cover also exposes its bar text.
- Select a text component in the preview, focus its content field, or choose
  its name from **Text controls**. The top toolbar exposes font family, size,
  weight/bold, italic, underline, colour, alignment, line spacing and letter
  spacing. Existing specialised font controls remain in use; missing controls
  are added alongside them.
- Select a **Paragraph**, **Image caption**, or individual **Story** component
  for a local edit. **Body defaults**, **Theme defaults**, and shared role groups
  deliberately affect all matching text. News headlines, body, captions,
  kickers, decks, bylines, sources and photo credits have separate groups.
- Highlights, their heading, references and their heading can be styled
  separately. Front-matter entry headings/text and cover text roles also have
  their own groups. Image/equation captions are text; mathematical notation
  continues to use the equation renderer's fonts.
- **Template font/weight/alignment**, blank numeric override fields and the
  colour reset restore inherited settings. **Reset added styling** clears only
  that selected component's new overrides. Original specialised reset actions
  and the letter-spacing reset remain separate.
- The typography row stays 64 pixels high. Use its arrow buttons or horizontal
  scrolling for options that do not fit a narrow window.

Changes use the existing document save and undo/redo flow. Old files have no
new font overrides until a control is changed. Explicit local styles take
precedence over shared typography, including after a template switch.

## Verification

- 625 frontend tests across 81 files and 25 server tests passed.
- Production build passed. Lint reports no errors; existing warnings remain.
- Browser checks covered showing/hiding the bar across all 21 templates.
- Paragraph and news-headline font changes stayed local after a JSON save/load
  round trip. Cover typography and editable back-cover running text were checked.
- A 31-page collection of all templates retained hidden bars and edited font
  styles in the real exporter's prepared A4 and ISO B5 print documents. No source
  page exceeded its sheet bounds in these fixtures. This checks the browser print
  document, not a saved operating-system PDF or a physical press proof.
- Narrow (516 px) and desktop (1440 px) toolbar checks retained the 64 px row.
- The compiler also retained the local font overrides after unmounting each
  source article: a seven-document/eight-page issue kept its edited titles,
  captions and footers through compilation and prepared B5 export.

Proof: `output/typography-topbar-proof-20261012.jpg`.

Large font sizes, long captions and extreme spacing can still exceed the space
available. Check overflow warnings and review a saved PDF with your actual copy
before publishing. Fonts without a supplied weight/style may use the browser's
synthetic bold/italic. This is not a promise that every font has every native face.

## Upload / deploy

Use **deployment-artifacts/magazoo-typography-topbar-20261012.zip** as the complete
replacement release package. It contains the current source, public assets,
server files, root build configuration and rebuilt `dist/`. Do not upload only
individual changed files: the new shared typography modules are required.

Back up the existing deployment first. Preserve its `.env`, hosting secrets and
`.magazoo-data` / configured database directory. Those are intentionally excluded,
as are dependencies, temporary browser fixtures and previous release bundles.
Follow SERVER_SETUP.md for the server's install/build/restart steps. This update
introduces no server or database change and has not been deployed automatically.

Previously reported dependency advisories remain unresolved (see
ARTICLE_LAYOUTS.md); this package is not a security sign-off.

## Source files changed since the article-parity package

New shared modules and tests:

- src/lib/textStyles.ts; src/lib/textStyles.test.ts; src/lib/topBar.ts
- src/panel/TextStyleFields.tsx; src/panel/sections/TopBarSection.tsx
- src/paper/topBarVisibility.test.tsx

Shared integration:

- src/lib/textTracking.ts
- src/schema/document.ts; src/store/useDoc.ts
- src/panel/Panel.tsx; src/panel/TypographyToolbar.tsx;
  src/panel/TypographyToolbar.test.tsx; src/panel/typography-toolbar.css
- src/paper/PaperPreview.tsx; src/paper/TagBar.tsx; src/styles/page.css
- src/issue/IssueRenderer.tsx; src/issue/snapshotIssuePages.ts;
  src/issue/IssueProof.test.tsx

Existing control metadata, grouping and caption targeting:

- src/panel/sections/ArticleImagesSection.tsx
- src/panel/sections/BackCoverSection.tsx
- src/panel/sections/BodySection.tsx
- src/panel/sections/DesignSection.tsx
- src/panel/sections/FooterSection.tsx
- src/panel/sections/FrontCoverDesignSection.tsx
- src/panel/sections/FrontMatterSection.tsx
- src/panel/sections/GallerySection.tsx
- src/panel/sections/GateDesignSection.tsx
- src/panel/sections/GateTextEditor.tsx
- src/panel/sections/HeadingTextEditor.tsx
- src/panel/sections/NewsSection.tsx
- src/panel/sections/PageMarginTextSection.tsx

Rendered targets and cover bars:

- src/paper/BackCoverPage.tsx
- src/paper/FrontMatterPages.tsx; src/paper/FrontMatterPages.test.tsx
- src/paper/MagazineFrontCover.tsx
- src/paper/NewsPages.tsx
- src/paper/PlacedImages.tsx

Also included: this guide, updated ARTICLE_PARITY.md, screenshot and rebuilt dist/.
