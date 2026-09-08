import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Doc } from '../schema/document';
import { isTextOnly, newsCopyHtml, packNews, type NewsPiece } from '../lib/newsLayout';
import { dropCapEnabled } from '../lib/textDirection';
import { FramedImage } from '../components/FramedImage';
import { TagBar } from './TagBar';
import type { FrontMatterStatus } from './FrontMatterPages';

const target = (name: string, tab = 'content') => ({ 'data-editor-tab': tab, 'data-editor-target': name });

/** Only the opening story of the issue takes a drop capital, and never where a
 * page break has already cut into it. */
const opensWithDropCap = (piece: NewsPiece, doc: Doc) =>
  dropCapEnabled(doc.design, doc.templateId) && piece.id === doc.news?.stories[0]?.id && !piece.continued;

export function NewsItem({ piece, doc }: { piece: NewsPiece; doc: Doc }) {
  const asset = piece.assetId ? doc.assets[piece.assetId] : undefined;
  const hasPhoto = !!asset && !isTextOnly(piece.layout) && !piece.continued;
  return <article className={`news-story news-story--${piece.layout}${hasPhoto ? ' news-story--photo' : ''}${piece.pair === 'main' ? ' news-story--paired' : ''}${piece.continued ? ' news-story--continued' : ''}`}
    data-news-id={piece.id} {...target(`news-${piece.id}`)}>
    <h2>{piece.title}<small className="news-continued" hidden={!piece.continued}>{doc.design.textDirection === 'rtl' ? ' — تابع' : ' — continued'}</small></h2>
    <div className="news-story-grid">
      <div className="news-copy">
        <div data-news-text dangerouslySetInnerHTML={{ __html: newsCopyHtml(piece, opensWithDropCap(piece, doc)) }} />
        {piece.source && <p className="news-source" dir="auto">{piece.source}</p>}
      </div>
      {hasPhoto && <figure {...target(`news-photo-${piece.id}`, 'images')}>
        <div className="news-photo"><FramedImage asset={asset} frame={piece.frame} /></div>
        {piece.caption && <figcaption>{piece.caption}</figcaption>}
      </figure>}
    </div>
  </article>;
}

/** Group a packed page into printed bands: a side column joins the story it
 * was paired with, everything else stands on its own row. */
function bands(pieces: NewsPiece[]): NewsPiece[][] {
  const rows: NewsPiece[][] = [];
  for (const piece of pieces) {
    const previous = rows.at(-1);
    if (piece.pair === 'aside' && previous?.length === 1 && previous[0].pair === 'main') previous.push(piece);
    else rows.push([piece]);
  }
  return rows;
}

export function NewsPages({ doc, vars, onStatus }: { doc: Doc; vars: CSSProperties; onStatus: (status: FrontMatterStatus) => void }) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<ReturnType<typeof packNews>>({ pages: [[]], overflow: false });
  const [fonts, setFonts] = useState(0);
  useLayoutEffect(() => {
    let alive = true;
    const refresh = () => { if (alive) setFonts(n => n + 1); };
    void document.fonts.ready.then(refresh);
    document.fonts.addEventListener('loadingdone', refresh);
    return () => { alive = false; document.fonts.removeEventListener('loadingdone', refresh); };
  }, []);
  useLayoutEffect(() => {
    const root = measureRef.current;
    const host = root?.querySelector<HTMLElement>('.news-stories');
    if (!root || !host) return;
    const originals = new Map([...host.querySelectorAll<HTMLElement>('.news-story')].map(node => [node.dataset.newsId, node]));

    // The packer asks about candidates it may then discard — a band that turns
    // out too tall is measured and abandoned. Results are cached per candidate
    // so a discarded trial costs nothing, and so the width check below can be
    // asked about the pieces that were actually placed.
    const measured = new Map<string, { height: number; wide: boolean }>();
    const evaluate = (piece: NewsPiece) => {
      const key = [piece.id, piece.pair ?? '', piece.continued ? 1 : 0, piece.paragraphTops ?? '', piece.text].join('\u0000');
      const cached = measured.get(key);
      if (cached) return cached;
      const original = originals.get(piece.id);
      if (!original) return { height: 0, wide: false };
      const copy = original.cloneNode(true) as HTMLElement;
      // A story sharing its band with a side column is printed narrower, so it
      // is measured that way too.
      copy.classList.toggle('news-story--paired', piece.pair === 'main');
      copy.querySelector('[data-news-text]')!.innerHTML = newsCopyHtml(piece, opensWithDropCap(piece, doc));
      if (piece.continued) {
        copy.classList.add('news-story--continued');
        copy.classList.remove('news-story--photo');
        copy.querySelector('figure')?.remove();
        (copy.querySelector('.news-continued') as HTMLElement).hidden = false;
      }
      host.append(copy);
      const entry = {
        height: copy.offsetHeight,
        wide: [...copy.querySelectorAll<HTMLElement>('.news-copy,h2,figcaption')].some(n => n.scrollWidth > n.clientWidth + 1),
      };
      copy.remove();
      measured.set(key, entry);
      return entry;
    };

    const result = packNews(doc.news?.stories ?? [], Math.max(1, host.clientHeight - 2),
      parseFloat(getComputedStyle(host).rowGap) || 0, piece => evaluate(piece).height);
    result.overflow ||= result.pages.flat().some(piece => evaluate(piece).wide) || host.clientHeight < 40;
    setLayout(result);
    onStatus({ pages: result.pages.length, overflow: result.overflow });
  }, [doc, fonts, onStatus]);

  const sheet = (index: number, content: ReactNode) => <div className="page news-page" style={vars} dir={doc.design.textDirection ?? 'ltr'} key={index}>
    <TagBar doc={doc} pageIndex={index} detail={doc.meta.volume} />
    <div className="news-shell">
      {(doc.meta.categoryLabel || doc.meta.title || doc.meta.subtitle) && <header className="news-header">
        {doc.meta.categoryLabel && <p className="news-kicker" {...target('meta-category')}>{doc.meta.categoryLabel}</p>}
        {doc.meta.title && <h1 {...target('meta-title')}>{doc.meta.title}</h1>}
        {doc.meta.subtitle && <p {...target('meta-subtitle')}>{doc.meta.subtitle}</p>}
      </header>}
      <div className="news-stories">{content}</div>
    </div>
  </div>;
  return <>
    {layout.pages.map((page, index) => sheet(index, bands(page).map((band, i) => band.length > 1
      ? <div className="news-row" key={`${band[0].id}-${i}`}>{band.map((piece, j) => <NewsItem key={`${piece.id}-${j}`} piece={piece} doc={doc} />)}</div>
      : <NewsItem key={`${band[0].id}-${i}`} piece={band[0]} doc={doc} />)))}
    <div className="news-measure" ref={measureRef} aria-hidden="true">{sheet(-1, (doc.news?.stories ?? []).map(piece => <NewsItem key={piece.id} piece={piece} doc={doc} />))}</div>
  </>;
}
