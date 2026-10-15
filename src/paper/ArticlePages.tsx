import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Doc, PlacedHighlights } from '../schema/document';
import { articleGeometry, articleGridDesign, articleRegions, type ArticleRegion, type ArticleObstacle, type ReferenceArticleId } from '../lib/articleLayouts';
import { defaultPlacedHighlights, highlightAvoidingTop, placedHighlightsGeometry } from '../lib/placedHighlights';
import { paginateHosts, overflows, type FlowItem, type Piece } from '../lib/paginate';
import { quoteFlowText } from '../lib/decorativeQuote';
import { hasClippedTextLine } from '../lib/columnFill';
import { footerBottomMargin } from '../lib/pageFooter';
import { fontStack } from '../lib/fonts';
import { placedImageContour } from '../lib/placedImage';
import { FramedImage } from '../components/FramedImage';
import { PageArtwork } from '../components/PageArtwork';
import { Flow, HIGHLIGHTS_BLOCK_ID } from './Flow';
import { HighlightsBody } from './Sidebar';
import { TagBar } from './TagBar';
import { PlacedImages } from './PlacedImages';
import '../styles/article-layouts.css';

const MM = 96 / 25.4;
type RegionContent = { region: ArticleRegion; pieces: Piece[] };
type Layout = { regions: RegionContent[]; pages: number; header: number; caption: number; overflow: boolean; callouts: ArticleObstacle[]; free?: PlacedHighlights };

function ArticleHeader({ doc }: { doc: Doc }) {
  return <header className="header article-header">
    <p className="eyebrow" data-editor-tab="content" data-editor-target="meta-category">{doc.meta.categoryLabel}</p>
    <h1 className="title" data-editor-tab="content" data-editor-target="meta-title">{doc.meta.title}</h1>
    {doc.meta.subtitle && <p className="subtitle" data-editor-tab="content" data-editor-target="meta-subtitle">{doc.meta.subtitle}</p>}
    {(doc.meta.author || doc.meta.affiliation) && <p className="byline"><span data-editor-tab="content" data-editor-target="meta-author">{doc.meta.author}</span>
      {doc.meta.affiliation && <span className="affiliation" data-editor-tab="content" data-editor-target="meta-affiliation">{doc.meta.author ? ' · ' : ''}{doc.meta.affiliation}</span>}</p>}
  </header>;
}

/** Five measured editorial compositions. Only these new templates use this
 * engine; the established article and gallery engines remain unchanged. */
export function ArticlePages({ doc, vars, onStatus, readOnly = false }: { doc: Doc; vars: CSSProperties; readOnly?: boolean; onStatus: (status: { pages: number; overflow: boolean }) => void }) {
  const id = doc.templateId as ReferenceArticleId;
  const measure = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const callout = useRef<HTMLDivElement>(null);
  const probes = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>({ regions: [], pages: 1, header: 0, caption: 0, overflow: false, callouts: [] });
  const placement = doc.design.highlightsPlacement ?? 'page1';
  const hasCallout = doc.design.sidebar && (doc.highlights.some(h => h.trim()) || doc.references.length > 0);
  const gridDesign = useMemo(() => articleGridDesign(doc.design), [doc.design]);
  const renderDoc = layout.free && placement === 'free' ? { ...doc, highlightBox: layout.free } : doc;
  const g = articleGeometry(id, doc.design, layout.header, layout.caption, footerBottomMargin(doc));
  const styles = { ...vars, '--page-w': `${g.width}mm`, '--page-h': `${g.height}mm`, '--article-col': `${g.col}mm`, '--article-leading': String(doc.design.articleLeading ?? 1.28),
    '--margin':`${g.margin}mm`, '--gutter':`${g.gutter}mm`, '--col':`${g.col}mm`,
    '--article-caption-font': fontStack(doc.design.articleCaptionFont ?? 'Avenir Next LT Pro'),
    '--article-caption-size': `${doc.design.articleCaptionSize ?? 7}pt`,
    '--article-caption-color': doc.design.articleCaptionColor,
    '--article-caption-align': doc.design.articleCaptionAlign ?? 'left',
  } as CSSProperties;
  const calloutWidth = placement === 'free' ? placedHighlightsGeometry(doc.highlightBox ?? defaultPlacedHighlights(gridDesign, g.height), gridDesign, 0, g.height).width
    : placement === 'below' ? g.span(g.columns) : g.col;
  const lastImagePage = Math.max(1, ...(doc.images ?? []).filter(i => doc.assets[i.assetId]).map(i => i.anchor.page));

  useLayoutEffect(() => {
    let disposed = false;
    const calculate = () => {
      if (disposed || !measure.current || !header.current || !probes.current) return;
      const headerHeight = header.current.offsetHeight / MM;
      const captionHeight = (caption.current?.offsetHeight ?? 0) / MM;
      const geometry = articleGeometry(id, doc.design, headerHeight, captionHeight, footerBottomMargin(doc));
      const obstacles: ArticleObstacle[] = [];
      const imageBounds: ArticleObstacle[] = [];
      measure.current.querySelectorAll<HTMLElement>('[data-article-image-page]').forEach(page => {
        page.querySelectorAll<HTMLElement>('.placed-image').forEach(image => {
          const box = { page: Number(page.dataset.articleImagePage), left: image.offsetLeft / MM,
            top: image.offsetTop / MM, width: image.offsetWidth / MM, height: image.offsetHeight / MM };
          imageBounds.push(box);
          const source = doc.images?.find(i => i.id === image.dataset.imageId);
          if (source?.wrapShape === 'contour') {
            const frameHeight = (image.querySelector<HTMLElement>('.placed-image-frame')?.offsetHeight ?? image.offsetHeight) / MM;
            const slices = placedImageContour(source);
            slices.forEach((slice, i) => obstacles.push({ ...box, left: box.left + box.width * i / slices.length,
              width: box.width / slices.length, top: box.top + frameHeight * slice.top / 100,
              height: frameHeight * (1 - (slice.top + slice.bottom) / 100) }));
            if (box.height > frameHeight) obstacles.push({ ...box, top: box.top + frameHeight, height: box.height - frameHeight });
          } else obstacles.push(box);
        });
      });
      const items: FlowItem[] = doc.blocks.flatMap<FlowItem>(block => block.type === 'paragraph'
        ? [{ kind: 'text', sourceId: block.id, text: quoteFlowText(block.text, block.decorativeQuote), decorativeQuote: block.decorativeQuote,
          indent: block.indent, fontSize: block.fontSize, color: block.color, topPadding: block.topPadding, cont: !!block.continuationOf }]
        : block.type === 'equation' ? [{ kind: 'equation', id: block.id, tex: block.tex, caption: block.caption }] : []);
      if (hasCallout && placement === 'page1-flow') {
        items.push({ kind: 'figure', id: HIGHLIGHTS_BLOCK_ID, aspect: (callout.current?.offsetHeight ?? 0) / (geometry.col * MM), hasCaption: false, widthBasis: 1 });
      }
      const root = probes.current;
      const calloutHeight = (callout.current?.offsetHeight ?? 0) / MM;
      const rail = hasCallout && (placement === 'page1' || placement === 'all');
      const railObstacle = (page: number): ArticleObstacle => ({ page, left: geometry.margin + (geometry.columns-1)*(geometry.col+geometry.gutter),
        top: page === 0 ? geometry.starts.at(-1)! : geometry.contentTop, width: geometry.col, height: geometry.height });
      const paginate = (extra: ArticleObstacle[] = [], through = lastImagePage - 1) => {
        const rails = rail ? Array.from({length: placement === 'all' ? through+2 : 1}, (_,page) => railObstacle(page)) : [];
        const regions = articleRegions(geometry, through, [...obstacles,...extra,...rails], doc.design.textDirection === 'rtl');
        // A clean continuation prototype supplies identical columns thereafter.
        const continuation = articleRegions(geometry, through+1, rails, doc.design.textDirection === 'rtl').filter(r => r.page === through+1);
        const all = [...regions,...continuation];
        root.replaceChildren();
        const hosts = all.map((region, index) => {
        const host = document.createElement('div');
        host.className = `body-cols article-column${index === 0 ? ' body-cols--p1' : ''}`;
        host.style.cssText = `position:relative;width:${region.width}mm;height:${Math.max(0, region.height * MM - 2)}px`;
        root.appendChild(host);
        return host;
        });
        if (!hosts.length || !continuation.length) return [];
        const result = paginateHosts(hosts, items, el => overflows(el) || hasClippedTextLine(el), { deferUnfit: true });
        return result.pages.map((pieces, index): RegionContent => {
        const repeated = index - regions.length;
        const region = index < regions.length ? regions[index] : {
          ...continuation[repeated % continuation.length], page: through+1 + Math.floor(repeated / continuation.length),
        };
        return { region, pieces };
        });
      };
      let filled = paginate();
      const pageCount = () => Math.max(lastImagePage,1,...filled.map(r=>r.region.page+1));
      const callouts: ArticleObstacle[] = [];
      let free: PlacedHighlights | undefined;
      const leadObstacles: ArticleObstacle[] = [
        ...(geometry.image.height > 0 ? [{page:0,left:geometry.image.x,top:geometry.image.y,width:geometry.image.width,height:geometry.image.height+(id==='paper-8'?captionHeight+1:0)}] : []),
        {page:0,left:geometry.margin,top:geometry.titleTop,width:geometry.span(geometry.titleCols),height:headerHeight},
      ];
      if (hasCallout && placement === 'free') {
        const stored = doc.highlightBox ?? defaultPlacedHighlights(gridDesign, geometry.height);
        const page = Math.max(0, Math.min(stored.anchor.page-1, pageCount()-1));
        const box = placedHighlightsGeometry(stored, gridDesign, calloutHeight, geometry.height);
        // Headings, lead images, masthead and footer are also protected regions.
        const protectedAreas: ArticleObstacle[] = [
          ...imageBounds.filter(o=>o.page===page),
          {page,left:0,top:0,width:geometry.width,height:geometry.contentTop},
          {page,left:0,top:geometry.bottom,width:geometry.width,height:geometry.height-geometry.bottom},
          ...leadObstacles.filter(o=>o.page===page),
        ];
        const gap = Math.max(3, geometry.gutter*.6);
        const top = highlightAvoidingTop(box.top,calloutHeight,geometry.height,protectedAreas.filter(o=>o.left<box.left+box.width&&o.left+o.width>box.left)
          .map(o=>({top:o.top-gap,bottom:o.top+o.height+gap})));
        free = {...stored, anchor:{page:page+1,column:box.column,y:Math.round(top*10)/10}};
        const obstacle = {page,left:box.left,top:free.anchor.y,width:box.width,height:calloutHeight};
        callouts.push(obstacle);
        filled = paginate([obstacle],Math.max(lastImagePage-1,page));
      } else if (hasCallout && placement === 'below') {
        // Reserve a full-width band on the final sheet, then reflow above it.
        let page = pageCount()-1;
        for (let pass=0; pass<3; pass++) {
          const band = {page,left:geometry.margin,top:geometry.bottom-calloutHeight,width:geometry.span(geometry.columns),height:calloutHeight};
          const reserved = [...leadObstacles,...imageBounds].filter(o=>o.page===page);
          // If the final band would cover a photo or heading, use a new sheet.
          if (band.top < geometry.contentTop || reserved.some(o=>o.top+o.height+2>band.top&&o.top<band.top+band.height)) {
            page++; continue;
          }
          filled = paginate([band],Math.max(lastImagePage-1,page));
          const last = pageCount()-1;
          if (last <= page) {callouts.push(band);break;}
          page = last;
        }
        if (!callouts.length) {
          filled=paginate();
          callouts.push({page:pageCount(),left:geometry.margin,top:geometry.contentTop,width:geometry.span(geometry.columns),height:calloutHeight});
        }
      }
      const pages = Math.max(pageCount(),...callouts.map(c=>c.page+1));
      if (rail) for(let page=0;page<(placement==='all'?pages:1);page++) {
        const slot = railObstacle(page);
        const top = highlightAvoidingTop(slot.top,calloutHeight,geometry.bottom,
          [{top:0,bottom:slot.top},...[...imageBounds,...leadObstacles].filter(o=>o.page===page&&o.left<slot.left+slot.width&&o.left+o.width>slot.left).map(o=>({top:o.top-3,bottom:o.top+o.height+3}))]);
        callouts.push({...slot,top,height:calloutHeight});
      }
      // Detect unbreakable content and inaccessible title/image geometry instead
      // of silently clipping it into an apparently successful PDF.
      const overlap = (a: ArticleObstacle,b: ArticleObstacle) => a.page===b.page&&Math.min(a.left+a.width,b.left+b.width)>Math.max(a.left,b.left)+.5&&Math.min(a.top+a.height,b.top+b.height)>Math.max(a.top,b.top)+.5;
      const overflow = geometry.bodyTop > geometry.bottom - 8 || geometry.starts.some(y => y > geometry.bottom - 8)
        || (geometry.bottomHero && leadObstacles.length>1 && overlap(leadObstacles[0],leadObstacles[1]))
        || imageBounds.some(o => o.top + o.height > geometry.height + .5 || o.left + o.width > geometry.width + .5)
        || callouts.some(c=>c.top<0||c.top+c.height>geometry.bottom+.5||[...imageBounds,...leadObstacles].some(image=>overlap(c,image)));
      setLayout({ regions: filled, pages, header: headerHeight, caption: captionHeight, overflow, callouts, free });
      onStatus({ pages, overflow });
    };
    calculate();
    document.fonts?.addEventListener('loadingdone', calculate);
    void document.fonts?.ready.then(calculate);
    measure.current?.addEventListener('load', calculate, true);
    const element = measure.current;
    return () => { disposed = true; document.fonts?.removeEventListener('loadingdone', calculate); element?.removeEventListener('load', calculate, true); };
  }, [doc, id, lastImagePage, onStatus, hasCallout, placement, gridDesign]);

  useLayoutEffect(() => {
    if (layout.overflow || !layout.regions.length) return;
    const pageRoot = measure.current?.parentElement;
    const clipped = Array.from(pageRoot?.querySelectorAll<HTMLElement>('.article-page [data-flow-host]') ?? [])
      .some(column => overflows(column) || hasClippedTextLine(column)) ||
      Array.from(pageRoot?.querySelectorAll<HTMLElement>('.article-page .placed-highlights,.article-page .article-callout,.article-page .hl-col') ?? [])
        .some(box=>box.scrollHeight>box.clientHeight+2||box.scrollWidth>box.clientWidth+2) ||
      Array.from(pageRoot?.querySelectorAll<HTMLElement>('.article-page .article-hero > figcaption') ?? []).some(cap => {
        const rect = cap.getBoundingClientRect(), frame = cap.parentElement!.getBoundingClientRect();
        return rect.bottom > frame.bottom + 1 || rect.right > frame.right + 1 || rect.top < frame.top - 1;
      });
    if (clipped) {
      setLayout(previous => ({ ...previous, overflow: true }));
      onStatus({ pages: layout.pages, overflow: true });
    }
  }, [layout, onStatus]);

  const asset = doc.hero.assetId ? doc.assets[doc.hero.assetId] : undefined;
  const hasImage = doc.design.showHero !== false && g.image.height > 0;
  const captionText = doc.meta.heroCaption ?? '';
  const measureStyles = { ...styles, width: `${g.width}mm` };
  return <>
    {Array.from({ length: layout.pages }, (_, page) => <div key={page}
      className={`page article-page article-page--${id}${g.layout.dark ? ' article-page--dark' : ''}`}
      data-page-width-mm={g.width} data-page-height-mm={g.height} data-layout-overflow={layout.overflow ? 'true' : undefined}
      style={{ ...styles, width: `${g.width}mm`, height: `${g.height}mm` }}>
      {page === 0 && <PageArtwork doc={doc}/>}
      {page === 0 && <>
        {hasImage && <figure data-callout-obstacle className={`article-hero${g.layout.fade ? ' article-hero--fade' : ''}${g.bottomHero ? ' article-hero--bottom' : ''}`} data-editor-tab="images" data-editor-target="image-hero"
          style={{ left: `${g.image.x}mm`, top: `${g.image.y}mm`, width: `${g.image.width}mm`, height: `${g.image.height}mm` }}>
          {asset ? <FramedImage asset={asset} frame={doc.hero}/> : <div className="article-image-placeholder">Add a hero photograph</div>}
          {id !== 'paper-8' && captionText && <figcaption className="article-hero-caption" data-editor-tab="content" data-editor-target="meta-hero-caption">{captionText}</figcaption>}
        </figure>}
        {id === 'paper-8' && hasImage && captionText && <div data-callout-obstacle className="article-inset-caption article-hero-caption" data-editor-tab="content" data-editor-target="meta-hero-caption"
          style={{ left: `${g.image.x}mm`, top: `${g.image.y + g.image.height + 1}mm`, width: `${g.image.width}mm` }}>{captionText}</div>}
        <div data-callout-obstacle className="article-header-position" style={{ left: `${g.margin}mm`, top: `${g.titleTop}mm`, width: `${g.span(g.titleCols)}mm` }}><ArticleHeader doc={doc}/></div>
      </>}
      <TagBar doc={doc} pageIndex={page}/>
      {layout.regions.filter(r => r.region.page === page).map(({ region, pieces }, index) => <div
        key={`${region.column}-${region.y}`} data-flow-host className={`body-cols article-column${page === 0 && index === 0 ? ' body-cols--p1' : ''}`}
        style={{ left: `${region.x}mm`, top: `${region.y}mm`, width: `${region.width}mm`, height: `${region.height}mm` }}>
        <Flow doc={renderDoc} pieces={pieces} singleColumn/>
      </div>)}
      {placement !== 'free' && layout.callouts.filter(c=>c.page===page).map((c,i)=><aside key={i} className="article-callout hl-col" data-editor-tab="highlights" data-editor-target="highlights"
        style={{position:'absolute',left:`${c.left}mm`,top:`${c.top}mm`,width:`${c.width}mm`}}><HighlightsBody doc={doc}/></aside>)}
      <PlacedImages doc={renderDoc} pageIndex={page} pageHeight={g.height} readOnly={readOnly}/>
    </div>)}
    <div className={`article-measure${g.layout.dark ? ' article-page--dark' : ''}`} ref={measure} aria-hidden="true" style={measureStyles}>
      <div ref={header} style={{ width: `${g.span(g.titleCols)}mm` }}><ArticleHeader doc={doc}/></div>
      <div ref={caption} className="article-inset-caption article-hero-caption" style={{ position: 'static', width: `${g.image.width}mm` }}>{captionText}</div>
      <div ref={callout} className="article-callout hl-col" style={{ width: `${calloutWidth}mm` }}><HighlightsBody doc={doc}/></div>
      <div ref={probes}/>
      {Array.from({ length: lastImagePage }, (_, page) => <div key={page} data-article-image-page={page} style={{ position: 'relative', width: `${g.width}mm`, height: `${g.height}mm` }}><PlacedImages doc={doc} pageIndex={page} pageHeight={g.height} readOnly includeHighlights={false}/></div>)}
    </div>
  </>;
}
