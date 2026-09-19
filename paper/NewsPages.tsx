import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Doc } from '../schema/document';
import {
  newsCopyHtml,
  newsCopySpan,
  newsPhotoPosition,
  newsPhotoSpan,
  newsRowAlign,
  newsStoryWidth,
  newsTextColumns,
  packNews,
  type NewsPiece,
} from '../lib/newsLayout';
import { dropCapEnabled } from '../lib/textDirection';
import { NewsPhoto } from '../components/NewsPhoto';
import { useNewsProof, type NewsProofIssue } from '../store/newsProof';
import { TagBar } from './TagBar';
import type { FrontMatterStatus } from './FrontMatterPages';

const target = (name: string, tab = 'content') => ({ 'data-editor-tab': tab, 'data-editor-target': name });

/** Only the opening story of the issue takes a drop capital, and never where a
 * page break has already cut into it. */
const opensWithDropCap = (piece: NewsPiece, doc: Doc) =>
  dropCapEnabled(doc.design, doc.templateId) && piece.id === doc.news?.stories[0]?.id && !piece.continued;

type NewsStyle = CSSProperties & {
  '--news-span': number;
  '--news-text-cols': number;
  '--news-copy-span': number;
  '--news-photo-span': number;
};

/** One source of truth for visible rendering and the hidden measuring pass. */
function presentation(piece: NewsPiece, doc: Doc) {
  const pageColumns = doc.design.bodyCols;
  const width = piece.gridSpan ?? newsStoryWidth(piece, pageColumns);
  const photo = newsPhotoPosition(piece, width);
  const asset = piece.assetId ? doc.assets[piece.assetId] : undefined;
  const hasPhoto = !!asset && photo !== 'none' && !piece.continued;
  const textColumns = newsTextColumns(piece, width, hasPhoto ? photo : 'none');
  const copySpan = newsCopySpan(piece, width, photo);
  const photoSpan = newsPhotoSpan(piece, width, photo);
  const className = [
    'news-story',
    `news-story--${piece.layout}`,
    `news-story--span-${width}`,
    hasPhoto ? 'news-story--photo' : '',
    hasPhoto ? `news-story--photo-${photo}` : '',
    piece.pair === 'main' ? 'news-story--paired' : '',
    piece.continued ? 'news-story--continued' : '',
  ].filter(Boolean).join(' ');
  return {
    asset,
    hasPhoto,
    align: newsRowAlign(piece),
    className,
    style: {
      '--news-span': width,
      '--news-text-cols': textColumns,
      '--news-copy-span': copySpan,
      '--news-photo-span': photoSpan,
      gridColumnStart: piece.gridStart,
      '--news-headline-size': piece.headlineSize ? `${piece.headlineSize}pt` : undefined,
      '--news-body-size': piece.bodySize ? `${piece.bodySize}pt` : undefined,
      '--news-line-height': piece.lineHeight,
    } as NewsStyle,
  };
}

export function NewsItem({ piece, doc }: { piece: NewsPiece; doc: Doc }) {
  const view = presentation(piece, doc);
  return <article className={view.className} style={view.style} data-news-id={piece.id}
    data-news-align={view.align} data-paragraph-style={piece.paragraphStyle ?? 'indent'} {...target(`news-${piece.id}`)}>
    {!piece.continued && piece.kicker && <p className="news-story-kicker" {...target(`news-kicker-${piece.id}`)}>{piece.kicker}</p>}
    <h2 {...target(`news-title-${piece.id}`)}>{piece.title}<small className="news-continued" hidden={!piece.continued}>{doc.design.textDirection === 'rtl' ? ' — تابع' : ' — continued'}</small></h2>
    {!piece.continued && piece.deck && <p className="news-story-deck" {...target(`news-deck-${piece.id}`)}>{piece.deck}</p>}
    {!piece.continued && piece.byline && <p className="news-story-byline" {...target(`news-byline-${piece.id}`)}>{piece.byline}</p>}
    <div className="news-story-grid">
      <div className="news-copy" {...target(`news-text-${piece.id}`)}>
        <div data-news-text dangerouslySetInnerHTML={{ __html: newsCopyHtml(piece, opensWithDropCap(piece, doc)) }} />
        {piece.source && !piece.continues && <p className="news-source" dir="auto" {...target(`news-source-${piece.id}`)}>{piece.source}</p>}
      </div>
      {view.hasPhoto && view.asset && <figure {...target(`news-photo-${piece.id}`, 'images')}>
        <NewsPhoto story={piece} asset={view.asset} />
        {(piece.caption || piece.photoCredit) && <figcaption>{piece.caption}{piece.photoCredit && <span className="news-photo-credit">{piece.photoCredit}</span>}</figcaption>}
      </figure>}
    </div>
  </article>;
}

/** Group the flattened packed page back into its printed rows. */
function bands(pieces: NewsPiece[]): NewsPiece[][] {
  const rows: NewsPiece[][] = [];
  for (const piece of pieces) {
    const previous = rows.at(-1);
    if (piece.row !== undefined && previous?.[0].row === piece.row) previous.push(piece);
    else if (piece.pair === 'aside' && previous?.length === 1 && previous[0].pair === 'main') previous.push(piece);
    else rows.push([piece]);
  }
  return rows;
}

function newsRowStart(columns: number, pageColumns: number, align: ReturnType<typeof newsRowAlign>) {
  const free = Math.max(0, pageColumns - columns);
  if (align === 'end') return free + 1;
  if (align === 'center') return Math.floor(free / 2) + 1;
  return 1;
}

export function NewsPages({ doc, vars, onStatus }: { doc: Doc; vars: CSSProperties; onStatus: (status: FrontMatterStatus) => void }) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<ReturnType<typeof packNews> & { overflowPages: number[] }>({ pages: [[]], overflow: false, overflowPages: [] });
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

    // The packer asks about candidates it may then discard. Cache by every
    // property that can change width, wrapping or fixed-height content.
    const measured = new Map<string, { height: number; wide: boolean }>();
    const evaluate = (piece: NewsPiece, firstRow = false) => {
      const key = [piece.id, piece.pair ?? '', piece.gridSpan ?? '', piece.gridStart ?? '', piece.layout,
        piece.widthCols ?? '', piece.textCols ?? '', piece.photoPosition ?? '', piece.photoCols ?? '',
        piece.photoHeight ?? '', piece.photoFit ?? '', piece.frame?.scale ?? '', piece.frame?.offsetX ?? '',
        piece.frame?.offsetY ?? '', piece.kicker ?? '', piece.deck ?? '', piece.byline ?? '',
        piece.headlineSize ?? '', piece.bodySize ?? '', piece.lineHeight ?? '', piece.paragraphStyle ?? '',
        piece.continued ? 1 : 0, piece.continues ? 1 : 0, piece.paragraphCut ? 1 : 0,
        firstRow ? 1 : 0, (piece.paragraphTops ?? []).join(','), piece.text].join('\u0000');
      const cached = measured.get(key);
      if (cached) return cached;
      const original = originals.get(piece.id);
      if (!original) return { height: 0, wide: false };
      const copy = original.cloneNode(true) as HTMLElement;
      const view = presentation(piece, doc);
      copy.className = `${view.className}${firstRow ? ' news-story--first-row' : ''}`;
      copy.dataset.newsAlign = view.align;
      copy.style.setProperty('--news-span', String(view.style['--news-span']));
      copy.style.setProperty('--news-text-cols', String(view.style['--news-text-cols']));
      copy.style.setProperty('--news-copy-span', String(view.style['--news-copy-span']));
      copy.style.setProperty('--news-photo-span', String(view.style['--news-photo-span']));
      copy.style.gridColumnStart = piece.gridStart ? String(piece.gridStart) : '';
      copy.querySelector('[data-news-text]')!.innerHTML = newsCopyHtml(piece, opensWithDropCap(piece, doc));
      if (piece.continued) {
        copy.querySelector('figure')?.remove();
        copy.querySelectorAll('.news-story-kicker,.news-story-deck,.news-story-byline').forEach(node => node.remove());
        (copy.querySelector('.news-continued') as HTMLElement).hidden = false;
      }
      if (piece.continues) copy.querySelector('.news-source')?.remove();
      const measuringRow = document.createElement('div');
      measuringRow.className = 'news-row';
      measuringRow.style.setProperty('--news-row-start', String(
        newsRowStart(view.style['--news-span'], doc.design.bodyCols, view.align),
      ));
      measuringRow.append(copy);
      host.append(measuringRow);
      const entry = {
        height: copy.offsetHeight,
        wide: [...copy.querySelectorAll<HTMLElement>('.news-copy,h2,figcaption,.news-story-deck,.news-story-byline')]
          .some(node => node.scrollWidth > node.clientWidth + 1),
      };
      measuringRow.remove();
      measured.set(key, entry);
      return entry;
    };

    const result = packNews(
      doc.news?.stories ?? [],
      Math.max(1, host.clientHeight - 2),
      parseFloat(getComputedStyle(host).rowGap) || 0,
      (piece, firstRow) => evaluate(piece, firstRow).height,
      doc.design.bodyCols,
    );
    const issues: NewsProofIssue[] = [];
    const capacity = Math.max(1, host.clientHeight - 2);
    const overflowPages = new Set<number>();
    result.pages.forEach((page, pageIndex) => {
      page.forEach(piece => {
        const firstRow = piece.row === page[0]?.row;
        const measured = evaluate(piece, firstRow);
        if (measured.wide || measured.height > capacity + 1) {
          overflowPages.add(pageIndex);
          issues.push({ storyId: piece.id, blocking: true,
            message: 'Content exceeds the printable frame. Reduce the image height, heading size or paragraph spacing.' });
        }
      });
    });
    for (const story of doc.news?.stories ?? []) {
      if (!story.title.trim()) issues.push({ storyId: story.id, blocking: false, message: 'Add a headline before publication.' });
      const width = newsStoryWidth(story, doc.design.bodyCols);
      const photo = newsPhotoPosition(story, width);
      if (story.assetId && !doc.assets[story.assetId]) issues.push({ storyId: story.id, blocking: true, message: 'The linked image is missing. Upload it again.' });
      if (photo !== 'none' && !story.assetId) issues.push({ storyId: story.id, blocking: false, message: 'This layout calls for an image. Add one in Images or set Photo position to None.' });
      if (photo !== 'none' && story.assetId && !story.caption.trim()) issues.push({ storyId: story.id, blocking: false, message: 'This image has no caption.' });
      const copyWidth = photo !== 'none' && story.assetId && (photo === 'left' || photo === 'right')
        ? newsCopySpan(story, width, photo) : width;
      const columnMm = (210 - 2 * doc.design.margin - (doc.design.bodyCols - 1) * doc.design.gutter) / doc.design.bodyCols;
      const columns = newsTextColumns(story, width, story.assetId ? photo : 'none');
      const textMm = (columnMm * copyWidth + doc.design.gutter * (copyWidth - columns)) / columns;
      if (textMm < 28) issues.push({ storyId: story.id, blocking: false, message: 'Copy columns are narrower than 28 mm. Widen this story, reduce text columns or give the image fewer columns.' });
    }
    result.overflow ||= issues.some(issue => issue.blocking) || host.clientHeight < 40;
    const placements = result.pages.flatMap((page, index) => page.map(piece => ({ storyId: piece.id, page: index + 1, continued: !!piece.continued })));
    for (const issue of issues.filter(candidate => candidate.blocking)) {
      for (const placement of placements) {
        if (placement.storyId === issue.storyId) overflowPages.add(placement.page - 1);
      }
    }
    if (result.overflow && !overflowPages.size) result.pages.forEach((_, index) => overflowPages.add(index));
    setLayout({ ...result, overflowPages: [...overflowPages] });
    useNewsProof.setState({ proof: { doc, pages: result.pages.length, issues,
      placements,
    } });
    onStatus({ pages: result.pages.length, overflow: result.overflow });
  }, [doc, fonts, onStatus]);

  const pageVars = { ...vars, '--news-page-cols': doc.design.bodyCols } as CSSProperties;
  const sheet = (index: number, content: ReactNode) => <div className="page news-page" style={pageVars} dir={doc.design.textDirection ?? 'ltr'} key={index}
    data-layout-overflow={index >= 0 && layout.overflowPages.includes(index) ? 'true' : undefined}>
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
    {layout.pages.map((page, index) => sheet(index, bands(page).map((band, rowIndex) => {
      const columns = band.reduce(
        (sum, piece) => sum + (piece.gridSpan ?? newsStoryWidth(piece, doc.design.bodyCols)),
        0,
      );
      const align = newsRowAlign(band[0]);
      const rowStyle = {
        '--news-row-cols': Math.min(doc.design.bodyCols, columns),
        '--news-row-start': newsRowStart(columns, doc.design.bodyCols, align),
      } as CSSProperties;
      return <div className="news-row" data-news-align={align}
        style={rowStyle} key={`${band[0].id}-${rowIndex}`}>
        {band.map((piece, pieceIndex) => <NewsItem key={`${piece.id}-${pieceIndex}`} piece={piece} doc={doc} />)}
      </div>;
    })))}
    <div className="news-measure" ref={measureRef} aria-hidden="true">{sheet(-1,
      (doc.news?.stories ?? []).map(piece => <NewsItem key={piece.id} piece={piece} doc={doc} />))}</div>
  </>;
}
