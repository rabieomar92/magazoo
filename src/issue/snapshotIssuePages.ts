import { clonePages } from '../lib/pdfExport';
import type { Design, TextStyle } from '../schema/document';
import { textStyleSelector,captionBackgroundSelector } from '../lib/textStyles';

const STYLE_PROPERTIES: Record<Exclude<keyof TextStyle,'backgroundOpacity'|'captionPadding'>, string> = {
  fontFamily: 'font-family', fontSize: 'font-size', fontWeight: 'font-weight',
  italic: 'font-style', underline: 'text-decoration-line', color: 'color',
  align: 'text-align', lineHeight: 'line-height',
};

/** Preserve each article's inherited design in a mixed-template publication. */
export function snapshotIssuePages(source: HTMLElement, textStyles?: Design['textStyles']): HTMLElement[] {
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
    // Tracking rules are scoped to the live article and may disappear when
    // the compiler advances. Preserve their used values before detaching IDs.
    const originalText = original.querySelectorAll<HTMLElement>('*');
    const copiedText = copy.querySelectorAll<HTMLElement>('*');
    copiedText.forEach((element, i) => {
      const spacing = getComputedStyle(originalText[i]).letterSpacing;
      if (spacing && spacing !== 'normal') element.style.setProperty('letter-spacing', spacing);
    });
    // Component rules are scoped to a live preview that is unmounted between
    // articles. Freeze only explicitly overridden properties on matching nodes,
    // before removing editor targets. Existing inherited styling stays intact.
    const copiesByNode = new Map(Array.from(originalText, (node, i) => [node, copiedText[i]]));
    for (const [key, style] of Object.entries(textStyles ?? {})) {
      const backgroundSelector=captionBackgroundSelector(key);
      if(backgroundSelector&&style?.captionPadding!==undefined)for(const node of original.querySelectorAll<HTMLElement>(backgroundSelector)){
        const target=copiesByNode.get(node);if(target){const used=getComputedStyle(node);target.style.setProperty('padding',used.padding,'important');for(const property of ['--caption-padding-block','--caption-padding-inline'])target.style.setProperty(property,used.getPropertyValue(property));}
      }
      if(backgroundSelector&&style?.backgroundOpacity!==undefined)for(const node of original.querySelectorAll<HTMLElement>(backgroundSelector)){
        const target=copiesByNode.get(node);if(target){target.style.setProperty('background',getComputedStyle(node).background,'important');target.style.setProperty('backdrop-filter','none','important');}
      }
      const selector = textStyleSelector(key);
      if (!selector || !style || typeof style !== 'object') continue;
      for (const node of original.querySelectorAll<HTMLElement>(selector)) {
        const target = copiesByNode.get(node);
        if (!target) continue;
        const used = getComputedStyle(node);
        for (const [property, css] of Object.entries(STYLE_PROPERTIES)) {
          if (style[property as keyof TextStyle] === undefined) continue;
          let value = used.getPropertyValue(css);
          if (property === 'lineHeight') {
            const ratio = parseFloat(value) / parseFloat(used.fontSize);
            if (Number.isFinite(ratio) && ratio > 0) value = String(ratio);
          }
          if (value) target.style.setProperty(css, value, 'important');
        }
      }
    }
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
      // Keep an inert print marker after stripping editor hooks. Otherwise
      // issue export silently skips the line-break protection used by an
      // individual article export, letting print reflow shaped paragraphs.
      if(element.matches('p[data-source-block-id]'))element.setAttribute('data-pdf-text-paragraph','true');
      element.removeAttribute('data-editor-target');
      element.removeAttribute('data-source-block-id');
      element.removeAttribute('contenteditable');
      element.removeAttribute('tabindex');
    });
    copy.remove();
  });
  return copies;
}
