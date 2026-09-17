import { clonePages } from '../lib/pdfExport';

/** Preserve each article's inherited design in a mixed-template publication. */
export function snapshotIssuePages(source: HTMLElement): HTMLElement[] {
  const staging = document.implementation.createHTMLDocument('Issue pages');
  // These snapshots are shown on screen beside — and measured against — the
  // editor's own preview, so they keep the preview's live column geometry.
  // The export path clones again from the assembled issue and freezes there,
  // which is where print actually needs it.
  clonePages(source, staging, { freezeColumns: false });
  const originals = Array.from(source.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains('page'),
  );
  const copies = Array.from(staging.querySelectorAll<HTMLElement>('.pdf-export-pages > .page'));
  copies.forEach((copy, index) => {
    const original = originals[index];
    const computed = getComputedStyle(original);
    // Capture inherited variables before the source article is unmounted.
    for (let i = 0; i < computed.length; i++) {
      const property = computed.item(i);
      if (property.startsWith('--')) copy.style.setProperty(property, computed.getPropertyValue(property));
    }
    for (const property of ['font-family', 'font-size', 'font-weight', 'font-style', 'color', 'direction', 'text-align']) {
      copy.style.setProperty(property, computed.getPropertyValue(property));
    }
    // line-height cannot be pinned the way the others can. getComputedStyle
    // resolves it to an absolute length, and an absolute line-height inherits
    // as that same length — so every descendant at a smaller size (a side
    // column, a caption, a standfirst) would get the page's line box instead
    // of one scaled to its own font-size. The editor inherits a unitless
    // factor, so the snapshot has to carry a factor too: same used value on
    // the page itself, same relative behaviour all the way down.
    const fontSize = Number.parseFloat(computed.fontSize);
    const lineHeight = Number.parseFloat(computed.lineHeight);
    copy.style.setProperty(
      'line-height',
      Number.isFinite(lineHeight) && Number.isFinite(fontSize) && fontSize > 0
        ? String(lineHeight / fontSize)
        : computed.lineHeight,
    );
    for (const className of ['pages--rtl', 'drop-caps-off']) {
      copy.classList.toggle(className, source.classList.contains(className));
    }
    copy.classList.add('issue-snapshot');
    copy.classList.remove('pdf-export-page');
    copy.lang = original.lang || source.lang || 'en';
    copy.querySelectorAll('[data-editor-target], [data-source-block-id], [contenteditable]').forEach(element => {
      element.removeAttribute('data-editor-target');
      element.removeAttribute('data-source-block-id');
      element.removeAttribute('contenteditable');
      element.removeAttribute('tabindex');
    });
    copy.remove();
  });
  return copies;
}
