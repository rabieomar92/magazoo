/** @jsxImportSource ../lib/mathJsx */
import { Fragment, useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { Doc } from '../schema/document';
import { pageFooter, footerInk, footerBottomOffset } from '../lib/pageFooter';
import { requestEditorTargetFocus } from '../lib/editorNavigation';
import { fontStack } from '../lib/fonts';
import { isReferenceArticle } from '../lib/articleLayouts';
import { PageMarginText } from './PageMarginText';
import '../styles/footer-guide.css';

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
    const photoOverlay = i === 0 && (doc.templateId === 'paper-3' || isReferenceArticle(doc.templateId)) &&
      doc.design.heroAtBottom === true && doc.design.heroBottomBleed === true && doc.design.showHero !== false &&
      doc.design.heroHeight > 0;
    return createPortal(<Fragment>
      {footer.enabled&&<span className="footer-boundary-guide" data-editor-only="true" aria-hidden="true" style={{bottom:`calc(${footerBottomOffset(doc)}mm + ${footer.fontSize}pt + 2mm)`}}/>}
      {footer.enabled && <footer className={`page-folio${footer.right ? ' page-folio--right' : ''}${photoOverlay ? ' page-folio--photo-overlay' : ''}`} style={{ color: photoOverlay ? '#ffffff' : footerInk(doc.design.paperBg), fontFamily: fontStack(footer.fontFamily), fontSize: `${footer.fontSize}pt`, paddingBottom: `${footerBottomOffset(doc)}mm`, height: `calc(${footerBottomOffset(doc)}mm + ${footer.fontSize}pt + 2mm)` }} aria-label={`Page ${footer.number}`}>
        <b className="page-folio-number" data-editor-tab="content" data-editor-target="footer-number" onClick={() => requestEditorTargetFocus('content', 'footer-number')}>{footer.number}</b>
        <span className="page-folio-text" dir="auto" data-editor-tab="content" data-editor-target="footer-text" onClick={() => requestEditorTargetFocus('content', 'footer-text')}>{footer.text}</span>
      </footer>}
      <PageMarginText doc={doc} index={i} />
    </Fragment>, page, `folio-${i}`);
  });
}
