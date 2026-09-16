import { useEffect, useRef, useState } from 'react';
import type { Doc } from '../schema/document';
import { PaperPreviewLayout } from '../paper/PaperPreview';
import { waitForPreviewResources } from '../lib/pdfExport';
import { snapshotIssuePages } from './snapshotIssuePages';
import '../styles/fonts.css';
import '../styles/page.css';
import '../styles/paper2.css';
import '../styles/magazine.css';
import '../styles/gallery.css';
import '../styles/overflow.css';
import '../styles/front-matter.css';
import '../styles/paper3-footer.css';
import '../styles/back-cover.css';
import '../styles/news.css';
import '../styles/rtl.css';
import 'katex/dist/katex.min.css';
import './contents.css';

export interface IssueSourceDocument { id: string; name: string; doc: Doc }
export interface RenderedIssueDocument {
  id: string;
  name: string;
  /** Detached source snapshots. Clone a node before attaching or numbering it. */
  pages: HTMLElement[];
  pageCount: number;
}
export interface IssueRendererProps {
  documents: readonly IssueSourceDocument[];
  onComplete: (documents: RenderedIssueDocument[]) => void;
  onError: (error: Error) => void;
  onProgress?: (completed: number, total: number, name: string) => void;
}

/** Runs the existing pagination engine one article at a time, without opening
 * a document in the editor, triggering autosave, or retaining all React trees. */
export function IssueRenderer({ documents, onComplete, onError, onProgress }: IssueRendererProps) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onComplete, onError, onProgress });
  const completed = useRef<RenderedIssueDocument[]>([]);
  const [index, setIndex] = useState(0);
  const [stopped, setStopped] = useState(false);
  const current = documents[index];

  useEffect(() => { callbacks.current = { onComplete, onError, onProgress }; }, [onComplete, onError, onProgress]);
  useEffect(() => {
    completed.current = [];
    setIndex(0);
    setStopped(false);
  }, [documents]);

  useEffect(() => {
    if (stopped) return;
    let cancelled = false;
    const run = async () => {
      if (!current) {
        callbacks.current.onComplete([...completed.current]);
        return;
      }
      callbacks.current.onProgress?.(index, documents.length, current.name);
      if (current.doc.design.customCss?.trim()) {
        throw new Error(`${current.name} uses custom CSS. Remove its custom CSS before compiling this issue, or export that document separately.`);
      }
      const source = host.current?.querySelector<HTMLElement>('.pages');
      if (!source) throw new Error(`Could not prepare ${current.name}. Please try compiling again.`);
      await waitForPreviewResources(source);
      if (cancelled) return;
      const preview = source.closest<HTMLElement>('.paper-scroll');
      if (preview?.dataset.previewOverflow === 'true' || source.querySelector('[data-image-avoidance="unresolved"]')) {
        throw new Error(`${current.name}: ${preview?.dataset.previewFitMessage || 'Some content does not fit on its page.'} Open this document and adjust the layout before compiling.`);
      }
      const pages = snapshotIssuePages(source);
      if (!pages.length) throw new Error(`${current.name} did not produce any pages. Please open it and check its layout.`);
      completed.current[index] = { id: current.id, name: current.name, pages, pageCount: pages.length };
      callbacks.current.onProgress?.(index + 1, documents.length, current.name);
      if (index + 1 >= documents.length) {
        setStopped(true);
        callbacks.current.onComplete([...completed.current]);
      } else setIndex(index + 1);
    };
    void run().catch(error => {
      if (cancelled) return;
      setStopped(true);
      callbacks.current.onError(error instanceof Error ? error : new Error('Could not compile the issue.'));
    });
    return () => { cancelled = true; };
  }, [current, documents, index, stopped]);

  return <div className="issue-renderer" ref={host} aria-hidden="true">
    {current && !stopped && <PaperPreviewLayout key={current.id} doc={current.doc} toolbarHost={null} pending={false} readOnly />}
  </div>;
}
