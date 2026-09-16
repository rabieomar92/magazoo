import { clonePages } from '../lib/pdfExport';

/** Preserve each article's inherited design in a mixed-template publication. */
export function snapshotIssuePages(source: HTMLElement): HTMLElement[] {
  const staging = document.implementation.createHTMLDocument('Issue pages');
  clonePages(source, staging);
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
    for (const property of ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'color', 'direction', 'text-align']) {
      copy.style.setProperty(property, computed.getPropertyValue(property));
    }
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
