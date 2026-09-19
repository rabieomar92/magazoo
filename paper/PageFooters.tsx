import { useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { Doc } from '../schema/document';
import { pageFooter, footerInk, footerBottomOffset } from '../lib/pageFooter';
import { requestEditorTargetFocus } from '../lib/editorNavigation';
import { fontStack } from '../lib/fonts';

/** Attach to physical sheets only, never hidden measuring pages. This keeps
 * photo-only spreads, galleries and all article engines on the same folio. */
export function PageFooters({ doc, root }: { doc: Doc; root: RefObject<HTMLDivElement | null> }) {
  const [pages, setPages] = useState<Element[]>([]);
  useLayoutEffect(() => {
    const host = root.current;
    if (!host) return;
    const collect = () => {
      const next = [...host.children].filter(el => el.classList.contains('page'));
      setPages(prev => prev.length === next.length && prev.every((el, i) => el === next[i]) ? prev : next);
    };
    collect();
    const observer = new MutationObserver(collect);
    observer.observe(host, { childList: true });
    return () => observer.disconnect();
  }, [root]);
  return pages.map((page, i) => {
    const footer = pageFooter(doc, i);
    return footer.enabled ? createPortal(
      <footer className={`page-folio${footer.right ? ' page-folio--right' : ''}`} style={{ color: footerInk(doc.design.paperBg), fontFamily: fontStack(footer.fontFamily), fontSize: `${footer.fontSize}pt`, paddingBottom: `${footerBottomOffset(doc)}mm`, height: `calc(${footerBottomOffset(doc)}mm + ${footer.fontSize}pt + 2mm)` }} aria-label={`Page ${footer.number}`}>
        <b className="page-folio-number" data-editor-tab="content" data-editor-target="footer-number" onClick={() => requestEditorTargetFocus('content', 'footer-number')}>{footer.number}</b>
        <span className="page-folio-text" dir="auto" data-editor-tab="content" data-editor-target="footer-text" onClick={() => requestEditorTargetFocus('content', 'footer-text')}>{footer.text}</span>
      </footer>, page, `folio-${i}`) : null;
  });
}
