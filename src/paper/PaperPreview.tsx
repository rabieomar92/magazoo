import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDoc } from '../store/useDoc';
import { familyOf } from '../schema/document';
import { cssVars, grid, PAGE_W, PAGE_H } from '../lib/geometry';
import {
  paginate,
  paginateHosts,
  fitMessage,
  type FlowItem,
  type Pagination,
} from '../lib/paginate';
import {
  columnizeAllBalanced,
  columnizeAllAroundImages,
  hasClippedTextLine,
  type PageImageExclusions,
} from '../lib/columnFill';
import { wrapAll } from '../lib/textWrap';
import { applyMark, insertMath } from '../lib/activeEditor';
import { MAG2_STRIP } from '../lib/magSplit';
import { paper2Grid, paper2Fit } from '../lib/paper2';
import { defaultPlacedHighlights } from '../lib/placedHighlights';
import { populatedPhysicalPages } from '../lib/physicalFlowPages';
import type { Mark } from '../lib/richtext';
import { Page1 } from './Page1';
import { PaperTwoPage } from './PaperTwo';
import { ContPage } from './ContPage';
import { MagazineCover } from './MagazineCover';
import { MagazinePage } from './MagazinePage';
import { MagazineHead } from './MagazineHead';
import { MagSplitCover, MagPhotoPage } from './MagSplitCover';
import { MagSplitHead, MagSplitAside } from './MagSplitHead';
import { HighlightsBody } from './Sidebar';
import { HIGHLIGHTS_BLOCK_ID, MAG2_ASIDE_ID } from './Flow';
import { GalleryPage } from './GalleryPage';
import { MagGateA, MagGateB } from './MagGate';
import { MagazineFrontCover } from './MagazineFrontCover';

type PreviewPagination = Pagination & { layoutRevision: number };
const EMPTY: PreviewPagination = { pages: [], fill: 0, spill: 0, layoutRevision: 0 };

const FORMAT_BTNS: { mark: Mark; label: string; title: string }[] = [
  { mark: 'b', label: 'B', title: 'Bold (⌘/Ctrl+B)' },
  { mark: 'i', label: 'I', title: 'Italic (⌘/Ctrl+I)' },
  { mark: 'u', label: 'U', title: 'Underline (⌘/Ctrl+U)' },
];

// A4 in CSS px at the reference 96dpi (1mm = 96/25.4 px). Preview-only: used to
// size the zoom frame, never for layout/pagination (those stay in mm/pt).
const MM_PX = 96 / 25.4;
const PAGE_W_PX = PAGE_W * MM_PX;
const PAGE_H_PX = PAGE_H * MM_PX;
const PAGE_GAP_PX = 20; // .page bottom margin
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Move a rail callout into the nearest full-height gap left by images that
 * cross its column. This is visual-only: the rail is outside article flow, so
 * moving it must not trigger another pagination cycle. */
function positionImageAvoidingCallouts(pageNodes: HTMLElement[]): number {
  for (const page of pageNodes) {
    for (const clone of page.querySelectorAll(':scope > .sidebar-relocated')) clone.remove();
  }
  let requiredPageCount = 0;
  for (const page of pageNodes) {
    const callouts = Array.from(
      page.querySelectorAll<HTMLElement>('[data-image-avoiding-callout]'),
    );
    for (const callout of callouts) {
      callout.style.removeProperty('transform');
      callout.style.removeProperty('--sidebar-avoid-height');
      callout.style.removeProperty('--sidebar-avoid-mask');
      callout.style.removeProperty('--sidebar-avoid-shape');
      callout.style.removeProperty('visibility');
      callout.removeAttribute('data-image-avoidance');
    }

    const images = Array.from(page.querySelectorAll<HTMLElement>('.placed-image'));
    if (!images.length) continue;
    const pageScale = page.offsetWidth
      ? page.getBoundingClientRect().width / page.offsetWidth
      : 1;
    // Keep a deliberate editorial gap between a callout and the complete
    // image figure (the figure rectangle includes its caption). Scale this
    // with preview zoom so it remains a constant 10 CSS px / ~2.65 mm on the
    // physical page rather than collapsing when the preview is fitted down.
    const gutter = 10 * (pageScale || 1);

    for (const callout of callouts) {
      const bounds = callout.parentElement?.getBoundingClientRect();
      const natural = callout.getBoundingClientRect();
      if (!bounds || !natural.height) continue;
      const bands = images
        .map((image) => image.getBoundingClientRect())
        .filter(
          (image) =>
            Math.min(image.right, natural.right) - Math.max(image.left, natural.left) > 1 &&
            image.bottom > bounds.top &&
            image.top < bounds.bottom,
        )
        .map((image) => ({
          top: Math.max(bounds.top, image.top - gutter),
          bottom: Math.min(bounds.bottom, image.bottom + gutter),
        }))
        .sort((a, b) => a.top - b.top);
      if (!bands.length) continue;

      const merged: { top: number; bottom: number }[] = [];
      for (const band of bands) {
        const previous = merged.at(-1);
        if (previous && band.top <= previous.bottom) previous.bottom = Math.max(previous.bottom, band.bottom);
        else merged.push({ ...band });
      }
      const gaps: { top: number; bottom: number }[] = [];
      let cursor = bounds.top;
      for (const band of merged) {
        if (band.top > cursor) gaps.push({ top: cursor, bottom: band.top });
        cursor = Math.max(cursor, band.bottom);
      }
      if (cursor < bounds.bottom) gaps.push({ top: cursor, bottom: bounds.bottom });

      const candidates = gaps
        .filter((gap) => gap.bottom - gap.top >= natural.height - 0.5)
        .map((gap) => ({
          top: clamp(natural.top, gap.top, gap.bottom - natural.height),
        }))
        .sort((a, b) => Math.abs(a.top - natural.top) - Math.abs(b.top - natural.top));
      const target = candidates[0];
      if (!target) {
        const freeHeight = gaps.reduce((total, gap) => total + gap.bottom - gap.top, 0);
        if (freeHeight >= natural.height - 0.5) {
          const scale = pageScale || 1;
          const shapeStops = ['transparent 0px'];
          const maskStops = ['#000 0px'];
          for (const band of merged) {
            const top = (band.top - bounds.top) / scale;
            const bottom = (band.bottom - bounds.top) / scale;
            shapeStops.push(
              `transparent ${top}px`,
              `#000 ${top}px`,
              `#000 ${bottom}px`,
              `transparent ${bottom}px`,
            );
            maskStops.push(
              `#000 ${top}px`,
              `transparent ${top}px`,
              `transparent ${bottom}px`,
              `#000 ${bottom}px`,
            );
          }
          shapeStops.push('transparent 100%');
          maskStops.push('#000 100%');
          callout.style.setProperty('--sidebar-avoid-height', `${bounds.height / scale}px`);
          callout.style.setProperty(
            '--sidebar-avoid-shape',
            `linear-gradient(to bottom, ${shapeStops.join(', ')})`,
          );
          callout.style.setProperty(
            '--sidebar-avoid-mask',
            `linear-gradient(to bottom, ${maskStops.join(', ')})`,
          );
          callout.dataset.imageAvoidance = 'split';
        } else {
          // No layout can fit two rectangles whose combined height exceeds the
          // rail. Continue the callout on the next physical sheet and let that
          // sheet's text flow treat the cloned box as another obstacle.
          const pageIndex = pageNodes.indexOf(page);
          const nextPage = pageNodes[pageIndex + 1];
          if (nextPage) {
            const clone = callout.cloneNode(true) as HTMLElement;
            clone.classList.add('sidebar-relocated');
            clone.removeAttribute('data-image-avoiding-callout');
            clone.removeAttribute('data-image-avoidance');
            clone.querySelector('.sidebar-image-shape')?.remove();
            nextPage.appendChild(clone);
            callout.style.visibility = 'hidden';
            callout.dataset.imageAvoidance = 'relocated';
          } else {
            callout.dataset.imageAvoidance = 'unresolved';
          }
          requiredPageCount = Math.max(requiredPageCount, pageIndex + 2);
        }
        continue;
      }
      const shift = (target.top - natural.top) / (pageScale || 1);
      if (Math.abs(shift) > 0.05) {
        callout.style.transform = `translateY(${shift}px)`;
      }
      callout.dataset.imageAvoidance = 'resolved';
    }
  }
  return requiredPageCount;
}

/** Keep form controls immediate while coalescing expensive page measurement.
 * Buttons/sliders still update on the next task; continuous text entry waits
 * briefly so a burst of keystrokes causes one pagination pass, not one each. */
export function PaperPreview({ toolbarHost }: { toolbarHost: HTMLElement | null }) {
  const liveDoc = useDoc((state) => state.doc);
  const [previewDoc, setPreviewDoc] = useState(liveDoc);

  useEffect(() => {
    const active = document.activeElement;
    const typedField =
      active instanceof HTMLTextAreaElement ||
      (active instanceof HTMLInputElement &&
        ['text', 'number', 'search', 'url', 'email'].includes(active.type));
    const timer = window.setTimeout(() => setPreviewDoc(liveDoc), typedField ? 140 : 0);
    return () => window.clearTimeout(timer);
  }, [liveDoc]);

  return <PaperPreviewLayout doc={previewDoc} toolbarHost={toolbarHost} />;
}

const PaperPreviewLayout = memo(function PaperPreviewLayout({
  doc,
  toolbarHost,
}: {
  doc: ReturnType<typeof useDoc.getState>['doc'];
  toolbarHost: HTMLElement | null;
}) {

  const updateDoc = useDoc((state) => state.update);

  const baseVars = useMemo(() => cssVars(doc.design), [doc.design]);
  const items = useMemo<FlowItem[]>(
    () =>
      doc.blocks.flatMap<FlowItem>((b) => {
        if (b.type === 'paragraph')
          return [
            {
              kind: 'text',
              sourceId: b.id,
              text: b.text,
              indent: b.indent,
              cont: Boolean(b.continuationOf),
              fontSize: b.fontSize,
              color: b.color,
            },
          ];
        if (b.type === 'equation')
          return [{ kind: 'equation', id: b.id, tex: b.tex, caption: b.caption }];
        // Gallery figures fill fixed template slots. Ordinary article images
        // live in doc.images and are overlaid after pagination, so neither kind
        // belongs in the text measuring stream.
        return [];
      }),
    [doc.blocks],
  );

  const isMag = familyOf(doc.templateId) === 'magazine';
  // Gallery: a fixed photo collage, no text flow — one A4 page, no pagination.
  const isGallery = familyOf(doc.templateId) === 'gallery';
  // magazine-2 runs a different sheet plan: sheet 1 is the article + photo strip,
  // sheet 2 is that same photo continued, spill goes to sheet 3+.
  const isSplit = doc.templateId === 'magazine-2';
  // magazine-3 is a gatefold: two facing cover sheets share one photo across the
  // fold, then the article flows as plain columns (no lead hero) from sheet 3.
  const isGate = doc.templateId === 'magazine-3';
  // magazine-4 is intentionally one fixed front-cover sheet. Its Content
  // paragraphs are cover teasers, never a flow that creates later pages.
  const isFrontCover = doc.templateId === 'magazine-4';
  // paper-2 splits sheet 1 into two text regions (beside the header, then under
  // the hero) that start at different heights, so it breaks across three hosts.
  const isP2 = doc.templateId === 'paper-2';
  const p2 = useMemo(() => paper2Grid(doc.design), [doc.design]);
  // A bleeding figure can only bleed towards a free edge, so how wide it ends up
  // depends on whether a rail sits beside the box. The measuring twins must carry
  // the same flag as the real sheets or they would model the wrong width.
  const g = useMemo(() => grid(doc.design), [doc.design]);
  const railed = g.rail ? ' body-cols--railed' : '';
  const railedEvery = g.railEvery ? ' body-cols--railed' : '';

  const scrollRef = useRef<HTMLDivElement>(null);
  const host1Ref = useRef<HTMLDivElement>(null);
  const host2Ref = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLDivElement>(null);
  const hlColRef = useRef<HTMLDivElement>(null);
  const magHost1Ref = useRef<HTMLDivElement>(null);
  const magHost2Ref = useRef<HTMLDivElement>(null);
  const magHeadRef = useRef<HTMLDivElement>(null);
  const splitHost1Ref = useRef<HTMLDivElement>(null);
  const splitHeadRef = useRef<HTMLDivElement>(null);
  const splitAsideRef = useRef<HTMLDivElement>(null);
  const p2HostLRef = useRef<HTMLDivElement>(null);
  const p2HostRRef = useRef<HTMLDivElement>(null);
  // Shared, reusable probe for columnFill.ts's true-sequential-fill post-pass —
  // resized/reclassed per page inside columnizeAll(). One node covers every
  // template; see columnFill.ts for why this exists (Chromium's real
  // column-fill:auto isn't reliably sequential on a page that doesn't overflow).
  const colProbeRef = useRef<HTMLDivElement>(null);
  // The real, on-screen page stack — see the post-render overflow safety-net
  // effect below for why this is needed in addition to the hidden measuring
  // hosts above.
  const pagesRef = useRef<HTMLDivElement>(null);
  const [pagination, setPagination] = useState<PreviewPagination>(EMPTY);
  const [imageExclusions, setImageExclusions] = useState<PageImageExclusions>({});
  // Starts at zero: the glyph-rectangle fit test normally needs no extra
  // padding. If the real transformed preview still settles differently from
  // its hidden measuring twin, the post-render collision audit below adds only
  // the minimum small reserve needed to force the affected words onward.
  const [wrapSafetyBoost, setWrapSafetyBoost] = useState(0);
  const [calloutPageCount, setCalloutPageCount] = useState(0);
  const imageExclusionKey = useRef('');
  const wrapGuardTries = useRef(0);
  // A real-page wrap row can very occasionally settle differently from its
  // hidden measuring twin after several rapid edits (image load + reordering +
  // column change). Bumping this token asks the authoritative paginator to run
  // again from the document, rather than trying to surgically split an already
  // composite wrap row in the overflow safety pass below.
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  const [headerPx, setHeaderPx] = useState(0);
  const [magHeadPx, setMagHeadPx] = useState(0);
  const [splitHeadPx, setSplitHeadPx] = useState(0);
  const [p2HeadPx, setP2HeadPx] = useState(0);
  const [p2HeroPx, setP2HeroPx] = useState(0);
  const [fontEpoch, setFontEpoch] = useState(0);
  // Invalidates delayed real-page safety checks from an older document/layout
  // commit. Without this guard, a timer created while (for example) the design
  // still had two columns can overwrite freshly recomputed four-column pages
  // with its stale derived pieces.
  const layoutRevision = useRef(0);

  // Pagination must be recomputed after a web font swaps in: the same words
  // can wrap one line earlier/later at the final glyph widths. Without this,
  // a page measured against the fallback font can acquire a real overflow once
  // the bundled font finishes loading.
  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    let active = true;
    const reflow = () => active && setFontEpoch((n) => n + 1);
    void fonts.ready.then(reflow);
    fonts.addEventListener('loadingdone', reflow);
    return () => {
      active = false;
      fonts.removeEventListener('loadingdone', reflow);
    };
  }, []);

  // Highlights that ride the text flow as the last item: 'below' as a full-width
  // band, 'page1-flow' as a one-column box that lets text fill the gap above it.
  const placement = doc.design.highlightsPlacement ?? 'page1';
  const hasHl =
    doc.design.sidebar && (doc.highlights.some((h) => h.trim()) || doc.references.length > 0);
  const hlBelow = hasHl && placement === 'below';
  const hlFlow = hasHl && placement === 'page1-flow';
  const hlFree = hasHl && placement === 'free';

  // Preview zoom. 'fit' tracks the pane width (Word's "Page Width"); a number is
  // a manual zoom. Cosmetic only — the sheet scales, the pt/mm sizes do not.
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [fitScale, setFitScale] = useState(1);

  // Spread view (magazine only): lay the sheets two-up like an open magazine so
  // the cover and its facing page read together. View-only — pagination, pt/mm
  // sizes and the PDF are untouched.
  const [spread, setSpread] = useState(false);
  // Gallery is a two-page spread too — the fold image only reads right side-by-side.
  const spreadOn = ((isMag && !isFrontCover) || isGallery) && spread;
  const cols = spreadOn ? 2 : 1;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const avail = el.clientWidth - 40; // .paper-scroll padding (20px each side)
      const contentW = cols * PAGE_W_PX + (cols - 1) * PAGE_GAP_PX;
      setFitScale(clamp(avail / contentW, 0.25, 1)); // cap 1: fit only shrinks
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols]);

  // The two body boxes are sized off --header-h / --footer-h, which we only know
  // after the real header paints. Measure it, feed the measuring hosts the same
  // box, then break the text once.
  useLayoutEffect(() => {
    layoutRevision.current += 1;
    const scroll = scrollRef.current;
    if (!scroll) return;
    const commitPagination = (next: Pagination) =>
      setPagination({ ...next, layoutRevision: layoutRevision.current });

    // Gallery and the dedicated cover are fixed compositions — nothing to
    // break, so skip the article measuring rig entirely.
    if (isGallery || isFrontCover) {
      commitPagination(EMPTY);
      return;
    }

    // Two post-passes over paginate()'s already-decided pages, run in order:
    // first wrapAll() turns every partial-width figure into a real
    // text-wrap 'wrap-row' (see textWrap.ts), then columnizeAll() stamps
    // explicit column breaks so every page's columns fill sequentially (see
    // columnFill.ts — a page holding a wrap-row is no longer text-only, but
    // columnizeAll() only acts on 'text' pieces so it's harmless to still run
    // over it). Both are pure rearrangements of content paginate() already
    // committed to a page, so neither can turn a fitting page into an
    // overflowing one. `hosts` mirrors whatever list of measuring boxes this
    // branch is about to pass to paginate()/paginateHosts().
    const withColFill = (p: Pagination, hosts: (HTMLElement | null | undefined)[]): Pagination => {
      // Both passes are pure post-rearrangement of pages paginate() already
      // committed to — never load-bearing for correctness of what's on the
      // page. If either throws on some unanticipated document shape, fall
      // back to paginate()'s own untouched result rather than blanking the
      // whole preview: a page that renders without the sequential-fill /
      // text-wrap polish beats one that doesn't render at all.
      try {
        const wrapped = wrapAll(p.pages, doc, hosts, colProbeRef.current);
        const filled = Object.keys(imageExclusions).length
          ? columnizeAllAroundImages(
              wrapped,
              hosts,
              colProbeRef.current,
              imageExclusions,
              doc,
              wrapSafetyBoost,
            )
          : columnizeAllBalanced(wrapped, hosts, colProbeRef.current, doc);
        return { ...p, pages: filled };
      } catch (err) {
        console.error('withColFill: post-pass failed, falling back to unpolished pagination', err);
        return p;
      }
    };

    // Magazine: page 1 is a cover (no flow). The body flows from page 2 into a
    // 2-column box. The first spread reserves room for the pull-quote, so its
    // measuring host (mh1) is shorter than the plain host (mh2) — same two-host
    // trick paper uses for the page-1 header.
    // magazine-2: sheet 1's body box is narrower (the photo strip takes the right
    // edge) and shorter (head above, quote + highlights below), so it measures
    // against its own host. Sheet 2 is photo only — the spill resumes on sheet 3
    // in the plain full-width box, which is exactly what host2 already models.
    if (isSplit) {
      const sh1 = splitHost1Ref.current;
      const mh2 = magHost2Ref.current;
      if (!sh1 || !mh2) return;
      const head = splitHeadRef.current?.offsetHeight ?? 0;
      setSplitHeadPx(head);
      const root = sh1.closest<HTMLElement>('.measure-root');
      if (root) {
        root.style.setProperty('--footer-h', '0mm');
        root.style.setProperty('--mag2-head-h', `${head}px`);
      }
      // The quote + highlights are the flow's last atom, one column wide, so the
      // text fills column 1 and the box closes with them at the foot of column 2.
      // Measured at its real render width, exactly like the paper hl-col box.
      const aside = splitAsideRef.current;
      let flow = items;
      if (aside && (doc.meta.pullQuote || doc.highlights.some((h) => h.trim()))) {
        const w = aside.offsetWidth || 1;
        flow = [
          ...items,
          { kind: 'figure', id: MAG2_ASIDE_ID, aspect: aside.offsetHeight / w, hasCaption: false, widthBasis: 1 },
        ];
      }
      commitPagination(withColFill(paginate(sh1, mh2, flow), [sh1, mh2]));
      return;
    }

    // magazine-3 gatefold: the two cover sheets carry the photo, so the lead
    // article sheet has no hero header to reserve — same HEIGHT as every later
    // sheet (--mag-head-h: 0px cancels .mag-cols--p1's own reservation above
    // .mag-cols--p2's). But it isn't the SAME BOX: .mag-cols--p1 alone carries
    // the lead drop cap (magazine.css's `.mag-cols--p1 p:first-child::first-
    // letter`), a large floated glyph that narrows column 1's first few lines
    // — measuring page 1 against mh2 (plain .mag-cols--p2, no drop cap) skips
    // that narrowing, so the fit-check consistently under-counts how much
    // height page 1's opening lines really need and can seat one MORE
    // paragraph than actually fits — a real, visible sideways column overflow
    // (confirmed empirically). mh1 (.mag-cols--p1, sized identically once
    // --mag-head-h is 0, but carrying the same drop-cap rule the real sheet
    // renders with) is measured instead, exactly like isMag/isSplit already
    // do for their own lead sheets.
    if (isGate) {
      const mh1 = magHost1Ref.current;
      const mh2 = magHost2Ref.current;
      if (!mh1 || !mh2) return;
      setMagHeadPx(0);
      const root = mh2.closest<HTMLElement>('.measure-root');
      if (root) {
        root.style.setProperty('--footer-h', '0mm');
        root.style.setProperty('--mag-head-h', '0px');
      }
      let gateFlow = items;
      const gateHl = hlBelow ? hlRef.current : null;
      if (gateHl) {
        const w = gateHl.offsetWidth || 1;
        gateFlow = [
          ...items,
          {
            kind: 'figure',
            id: HIGHLIGHTS_BLOCK_ID,
            aspect: gateHl.offsetHeight / w,
            hasCaption: false,
            widthBasis: 'body',
          },
        ];
      }
      commitPagination(withColFill(paginate(mh1, mh2, gateFlow), [mh1, mh2]));
      return;
    }

    if (isMag) {
      const mh1 = magHost1Ref.current;
      const mh2 = magHost2Ref.current;
      if (!mh1 || !mh2) return;
      const headH = magHeadRef.current?.offsetHeight ?? 0;
      setMagHeadPx(headH);
      const root = mh1.closest<HTMLElement>('.measure-root');
      if (root) {
        root.style.setProperty('--footer-h', '0mm');
        root.style.setProperty('--mag-head-h', `${headH}px`);
      }
      // Highlights close the article as a full-width band, riding the flow's tail
      // as one atomic full-span item — same trick paper uses for 'below'.
      let magFlow = items;
      const magHl = hlBelow ? hlRef.current : null;
      if (magHl) {
        const w = magHl.offsetWidth || 1;
        magFlow = [
          ...items,
          {
            kind: 'figure',
            id: HIGHLIGHTS_BLOCK_ID,
            aspect: magHl.offsetHeight / w,
            hasCaption: false,
            widthBasis: 'body',
          },
        ];
      }
      commitPagination(withColFill(paginate(mh1, mh2, magFlow), [mh1, mh2]));
      return;
    }

    // paper-2: the header and the hero block are the two things that push the
    // regions down, and neither depends on the flow — measure them off the real
    // sheet, feed the twins, then break the text across [left, right, page 2+].
    if (isP2) {
      const hl = p2HostLRef.current;
      const hr = p2HostRRef.current;
      const h2p = host2Ref.current;
      if (!hl || !hr || !h2p) return;

      const headH = scroll.querySelector<HTMLElement>('.p2-head')?.offsetHeight ?? 0;
      const heroH = scroll.querySelector<HTMLElement>('.p2-heroblock')?.offsetHeight ?? 0;
      setP2HeadPx(headH);
      setP2HeroPx(heroH);

      const root = hl.closest<HTMLElement>('.measure-root');
      if (root) {
        root.style.setProperty('--p2-head-h', `${headH}px`);
        root.style.setProperty('--p2-heroblock-h', `${heroH}px`);
        root.style.setProperty('--footer-h', '0mm');
      }

      // The in-flow highlights box is measured at the width of whichever region
      // can hold it — the right one, which is where the article ends.
      let p2flow = items;
      const p2hl = hlFlow ? hlColRef.current : hlBelow ? hlRef.current : null;
      if (p2hl) {
        const w = p2hl.offsetWidth || 1;
        p2flow = [
          ...items,
          {
            kind: 'figure',
            id: HIGHLIGHTS_BLOCK_ID,
            aspect: p2hl.offsetHeight / w,
            hasCaption: false,
            widthBasis: hlBelow ? 'body' : 1,
          },
        ];
      }
      commitPagination(withColFill(paginateHosts([hl, hr, h2p], p2flow), [hl, hr, h2p]));
      return;
    }

    const h1 = host1Ref.current;
    const h2 = host2Ref.current;
    if (!h1 || !h2) return;

    const header = scroll.querySelector<HTMLElement>('.header');
    const headerH = header ? header.offsetHeight : 0;
    setHeaderPx(headerH);

    const root = h1.closest<HTMLElement>('.measure-root');
    if (root) {
      root.style.setProperty('--header-h', `${headerH}px`);
      root.style.setProperty('--footer-h', '0mm');
    }

    // Highlights that ride the flow are appended as one atomic item, measured at
    // its own render width so it paginates like a figure. 'below' is full-width
    // (spans all columns); 'page1-flow' is one column wide (text fills the gap).
    let flow = items;
    const hlNode = hlFlow ? hlColRef.current : hlBelow ? hlRef.current : null;
    if (hlNode) {
      const w = hlNode.offsetWidth || 1;
      flow = [
        ...items,
        {
          kind: 'figure',
          id: HIGHLIGHTS_BLOCK_ID,
          aspect: hlNode.offsetHeight / w,
          hasCaption: false,
          widthBasis: hlBelow ? 'body' : 1,
        },
      ];
    }
    commitPagination(withColFill(paginate(h1, h2, flow), [h1, h2]));
  }, [baseVars, items, doc, doc.meta, doc.design, doc.highlights, doc.references, hlBelow, hlFlow, imageExclusions, isMag, isSplit, isGate, isFrontCover, isP2, isGallery, fontEpoch, layoutEpoch, wrapSafetyBoost]);

  // Post-render column-overflow safety net — every template, not just the
  // gatefold this was first caught on.
  //
  // Every measurement above happens in the hidden `.measure-root` rig, on the
  // theory that a box with identical CSS/content there renders identically
  // once it's the real, on-screen page. That theory holds almost everywhere,
  // but a multi-column box can fail it for a reason that has nothing to do
  // with any of paginate.ts's or columnFill.ts's own logic: confirmed
  // empirically (moving the SAME already-verified-fitting DOM node,
  // byte-identical content and all, from the measure rig into the real
  // page's own slot in `.pages` made it start overflowing sideways, no data
  // change involved at all), Chromium can fragment a `column-fill: auto`
  // box's last paragraph one column later on the real page than it does on
  // the measuring twin, purely as a function of which part of the document
  // tree the box lives in — not anything this module controls or can
  // measure in advance. This was first isolated on the gatefold (magazine-3),
  // but the real page stack's own
  // `.pages` wrapper carries a `transform: scale(...)` for the zoom/preview
  // on every template alike, and that ancestor transform is the likeliest
  // trigger — so paper continuation sheets can hit the exact same sideways
  // overflow (a figure-and-text
  // column box rendering one column wider on the real page than its
  // measuring twin ever did). None of the measuring hosts' own fitsStamped()
  // checks (columnFill.ts) can catch this class of mismatch no matter how
  // they're written, because the box each one checks against is exactly the
  // one that disagrees with reality.
  //
  // So: after the real pages actually commit to the DOM, check them — not
  // the measuring twins — for genuine overflow, and if a sheet still
  // overflows, push its last text piece onto the next sheet and let the
  // effect above re-measure from there. Bounded (`overflowFixTries`) so a
  // content shape this can't resolve degrades to "still overflowing" rather
  // than looping forever.
  //
  // Mapping a DOM box back to its `pagination.pages` index: every family's
  // own page components (Page1, ContPage, PaperTwoPage, MagazinePage) render
  // exactly one `.body-cols`/`.mag-cols`
  // box per pagination page, each wrapping a single <Flow pieces={...} />,
  // in the same order `pages` itself is walked in — so DOM order among those
  // boxes lines up 1:1 with `pagination.pages` order, with one exception:
  // isSplit's cover sheet (MagSplitCover) carries pages[0] in a `.mag2-cols`
  // box that this selector deliberately doesn't match (its layout — a
  // photo strip bleeding down one edge — isn't one this fix's "just drop the
  // tail paragraph" move can safely reason about), so for isSplit the first
  // matched box is pages[1], not pages[0].
  const overflowFixTries = useRef(0);
  useEffect(() => {
    overflowFixTries.current = 0;
  }, [
    baseVars,
    items,
    doc.meta,
    doc.design,
    doc.highlights,
    doc.references,
    hlBelow,
    hlFlow,
    isMag,
    isSplit,
    isGate,
    isFrontCover,
    isP2,
    isGallery,
  ]);

  useLayoutEffect(() => {
    if (isGallery || isFrontCover) return;
    // This effect is part of the same commit as the paginator above, so its
    // closure may still hold the PREVIOUS pagination object. Never let that
    // stale object overwrite the just-computed layout.
    if (pagination.layoutRevision !== layoutRevision.current) return;
    const revision = pagination.layoutRevision;

    // The synchronous, pre-paint scrollWidth/scrollHeight read below is what
    // caught the ORIGINAL gatefold case reliably, so it still runs first —
    // fixing the common case before the bad layout ever paints. But on a
    // spanning figure that doesn't open its own band (page.css forces a
    // `column-span: all` break there), this same ancestor-context bug has
    // been observed the OTHER way round too: the synchronous read reports a
    // clean fit, the fix never fires, and Chromium only settles into the
    // wider, overflowing fragmentation a little after paint — confirmed by
    // polling scrollWidth on the real page seconds later and watching a
    // "fits" reading flip to "overflows" with no further DOM or state change
    // in between. A single synchronous check can't see that coming, so
    // `check()` below also gets scheduled again on a short delay after every
    // run — cheap (it's a no-op read when nothing's wrong) and it's what
    // actually catches this class of case.
    //
    // A box's own scrollWidth/scrollHeight can't be trusted directly, though:
    // a bleeding figure (`.flow-fig--bleed*`) is DELIBERATELY given negative
    // margins so it reaches past the box's own edge to the sheet edge —
    // paginate.ts's own paint() has to work around exactly this ("its
    // negative margins would hang past el's own edge and register as
    // sideways spill on every single measurement, so the box would look
    // permanently overflowing"). Checking the box as a whole reintroduces
    // that same false positive on the real page: a page holding nothing but
    // a lone bleeding figure would read as "overflowing" forever. So overflow
    // is judged per CHILD instead, and a bleeding child gets a generous fixed
    // pixel allowance (BLEED_ALLOWANCE_PX) rather than the 1px rounding
    // slack every other child gets: page.css's own bleed rules only ever
    // push a figure out by one `--margin` (12mm in the shipped presets,
    // scaled down further by the `.pages` zoom transform above), so a real
    // bleed reads nowhere near this allowance — while the shrink/grow moves
    // below now DO relocate figures/equations, so a figure that's genuinely
    // too big for the page it lands on still has to be caught, not
    // exempted forever. Plain paragraphs and non-bleeding figures never
    // intentionally escape the box, so any of THEM past the edge (1px
    // slack, no allowance) is the real signal.
    const BLEED_ALLOWANCE_PX = 200;
    const isBoxOverflowing = (box: HTMLElement): boolean => {
      const boxRect = box.getBoundingClientRect();
      return Array.from(box.children).some((child) => {
        const r = child.getBoundingClientRect();
        const isHorizontalBleed =
          child instanceof HTMLElement && /\bflow-fig--bleed\b/.test(child.className);
        // A vertical allowance is legitimate only after Flow's geometry pass
        // has recorded an actual edge extension. Merely having the requested
        // class must not hide a naturally-too-tall figure; that figure needs
        // to move whole to the next page before it can bleed there.
        const isAppliedVerticalBleed =
          child instanceof HTMLElement &&
          (child.style.getPropertyValue('--edge-top') !== '' ||
            child.style.getPropertyValue('--edge-bottom') !== '');
        const rightAllowance = isHorizontalBleed ? BLEED_ALLOWANCE_PX : 0;
        const bottomAllowance = isAppliedVerticalBleed ? BLEED_ALLOWANCE_PX : 0;
        return (
          r.right > boxRect.right + 1 + rightAllowance ||
          r.bottom > boxRect.bottom + 1 + bottomAllowance
        );
      });
    };

    // Which column (0-based) a box's last child actually landed in, by
    // comparing its left edge to the box's own column tracks. `column-fill:
    // auto` fills column 0 to the box's full height before column 1 opens,
    // and so on — so on a page that still has more content waiting on a
    // later page, the last child landing in anything short of the final
    // column means real content is missing further down. A `column-span:
    // all` figure always measures as column 0 (it starts at the box's own
    // left edge regardless of row), which is exactly right here too: a
    // spanner sitting with a lot of the box's height still unused below it
    // is the same "content that should be here isn't" shape as text
    // stopping short, so it's meant to be caught the same way.
    const lastFilledColumn = (box: HTMLElement): number => {
      const count = parseInt(getComputedStyle(box).columnCount, 10) || 1;
      if (count < 2 || !box.lastElementChild) return 0;
      const boxRect = box.getBoundingClientRect();
      const lastRect = box.lastElementChild.getBoundingClientRect();
      const colStep = boxRect.width / count;
      const idx = Math.round((lastRect.left - boxRect.left) / colStep);
      return Math.min(Math.max(idx, 0), count - 1);
    };

    const check = () => {
      if (revision !== layoutRevision.current) return;
      if (overflowFixTries.current >= 8) return;
      const root = pagesRef.current;
      if (!root || !pagination.pages.length) return;

      const boxes = Array.from(root.querySelectorAll<HTMLElement>('.body-cols, .mag-cols'));
      // See the comment above the ref: isSplit's cover sheet owns pages[0]
      // in a box this selector doesn't match, so every matched box is
      // offset by one.
      const pageOffset = isSplit ? 1 : 0;
      const src = pagination.pages;

      const overflowIdx = boxes.findIndex(isBoxOverflowing);
      if (overflowIdx !== -1) {
        const pageIdx = overflowIdx + pageOffset;
        const bad = src[pageIdx];
        if (!bad || !bad.length) return;

        // Relocate the trailing piece — text, or a whole figure/equation.
        // A 'wrap-row' is a composite (a figure plus the text flowing beside
        // it, already column-split by textWrap.ts for ITS current position)
        // and isn't safe to move as one unit here, so it stays excluded.
        // Moving a figure/equation whole mirrors what fillOne() itself does
        // when one straddles a page break — paginate.ts: "Atomic: a figure/
        // equation can't split, so it starts the next page" — just applied
        // after the fact, for the case where the hidden measuring rig's
        // estimate didn't match how the real box actually fragmented.
        // Earlier text or a figure elsewhere on the same page is fine to
        // leave in place: this only shrinks the page by whatever the last
        // piece needed, the same safe, content-preserving move fillOne()
        // itself makes when a paragraph straddles a page break.
        const tailIdx = bad.length - 1;
        const tail = bad[tailIdx];
        if (tail.kind === 'wrap-row') {
          overflowFixTries.current += 1;
          setLayoutEpoch((n) => n + 1);
          return;
        }
        if (tail.kind !== 'text' && tail.kind !== 'figure' && tail.kind !== 'equation') return;

        overflowFixTries.current += 1;
        const nextPages = src.map((p) => p.slice());
        nextPages[pageIdx] = bad.slice(0, tailIdx);
        // Strip any colBreak stamp and cont/indent styling that only made
        // sense at its old position — it's about to become some other
        // page's opening paragraph (or continuation), same convention
        // fillOne() itself uses. Figures/equations never carry colBreak in
        // the first place, so there's nothing to strip for them.
        const relocated = tail.kind === 'text' ? { ...tail, colBreak: undefined } : tail;
        if (nextPages[pageIdx + 1]) {
          nextPages[pageIdx + 1] = [relocated, ...nextPages[pageIdx + 1]];
        } else {
          nextPages.push([relocated]);
        }
        setPagination((p) => ({ ...p, pages: nextPages }));
        return;
      }

      // No box is overflowing — check the opposite failure instead: a page
      // that stopped filling early and left real height unused while a
      // later page still has content that could sit here. Same root cause
      // as the overflow case (the hidden measuring rig's estimate for this
      // page's content doesn't match how the real, on-screen box actually
      // fragments its columns), just missing content instead of spilling
      // it. Confirmed on the user's own document: a spanning figure that
      // doesn't open its own column band left two of four columns
      // completely empty on the page that held it, then landed on a
      // sheet almost entirely by itself.
      const UNFILLED_PX = 40; // ignore sub-line rounding gaps, not real slack
      for (let boxIdx = 0; boxIdx < boxes.length; boxIdx++) {
        const box = boxes[boxIdx];
        const pageIdx = boxIdx + pageOffset;
        const next = src[pageIdx + 1];
        // Nothing later to pull forward — including the genuinely-last page
        // of the whole document, which is expected to end early (the app's
        // own "last page nearly empty" notice already covers that case).
        if (!next || !next.length) continue;
        // Pull a leading text, figure, or equation piece — a 'wrap-row' is a
        // composite (see the shrink branch's comment above) and stays put.
        if (next[0].kind !== 'text' && next[0].kind !== 'figure' && next[0].kind !== 'equation') continue;

        const count = parseInt(getComputedStyle(box).columnCount, 10) || 1;
        if (count < 2 || !box.lastElementChild) continue;
        const boxRect = box.getBoundingClientRect();
        const lastRect = box.lastElementChild.getBoundingClientRect();
        const shortfall = boxRect.bottom - lastRect.bottom;
        if (shortfall <= UNFILLED_PX) continue;
        if (lastFilledColumn(box) >= count - 1) continue; // last column IS in use — genuinely full

        const bad = src[pageIdx];
        if (!bad) continue;

        // A page-ending emphasized figure is deliberately the final atom: Flow
        // stretches it to the bottom trim. Pulling the next paragraph forward
        // here would make the figure interior again, remove its bottom-bleed
        // class, and recreate both the blank edge and the unsafe wrap that this
        // safety net is supposed to prevent. The apparent unused body height is
        // consumed visually by the figure's edge extension, so it is not a
        // missing-content condition.
        const last = bad[bad.length - 1];
        const lastFigureId =
          last?.kind === 'figure' ? last.id : last?.kind === 'wrap-row' ? last.figureId : null;
        const lastBlock = lastFigureId
          ? doc.blocks.find((block) => block.id === lastFigureId && block.type === 'figure')
          : null;
        if (
          lastBlock?.type === 'figure' &&
          (lastBlock.bleed === true || lastBlock.span === 'bleed')
        ) {
          continue;
        }

        overflowFixTries.current += 1;
        const nextPages = src.map((p) => p.slice());
        const [moved, ...rest] = next;
        const relocated = moved.kind === 'text' ? { ...moved, colBreak: undefined } : moved;
        nextPages[pageIdx] = [...bad, relocated];
        nextPages[pageIdx + 1] = rest;
        setPagination((p) => ({
          ...p,
          pages: nextPages[pageIdx + 1].length ? nextPages : nextPages.filter((_, i) => i !== pageIdx + 1),
        }));
        return;
      }
    };

    check();
    // Re-verify a few times after paint, in case the browser's own idle
    // layout pass disagrees with the pre-paint reading above — how long that
    // takes to show up hasn't been pinned down to one reliable delay, so
    // this staggers a few checks rather than betting on a single number.
    const settleTimers = [150, 500, 1200].map((ms) => window.setTimeout(check, ms));
    return () => settleTimers.forEach((t) => window.clearTimeout(t));
  }, [isGallery, isFrontCover, isSplit, pagination, doc.blocks]);

  const vars = {
    ...baseVars,
    '--page-bg-image': doc.design.pageBackgroundAssetId && doc.assets[doc.design.pageBackgroundAssetId]
      ? `url("${doc.assets[doc.design.pageBackgroundAssetId].src}")`
      : 'none',
    '--header-h': `${headerPx}px`,
    '--footer-h': '0mm',
    '--mag-head-h': `${magHeadPx}px`,
    '--mag2-head-h': `${splitHeadPx}px`,
    '--mag2-strip': `${MAG2_STRIP}mm`,
    '--bar-h': '6mm',
    // Vertical top-bleed's own clip allowance (see page.css's .pages
    // .body-cols) — has to be a plain length, not calc(var(--margin) +
    // var(--bar-h) + var(--gutter)): Chromium silently computes any calc()
    // inside overflow-clip-margin to 0px (tested directly — a single var()
    // or literal length works, a calc() of any kind, even var()-wrapped,
    // does not), so the three lengths are summed here in JS instead. 6 must
    // track --bar-h above by hand since both are literals for the same
    // reason.
    '--topbleed-clip': `${Math.max(
      doc.design.margin,
      (doc.design.topBarOffset ?? 0) + 6 + doc.design.gutter,
    )}mm`,
    '--p2-head-h': `${p2HeadPx}px`,
    '--p2-heroblock-h': `${p2HeroPx}px`,
    '--p2-left-w': `${p2.leftW}mm`,
    '--p2-hero-w': `${p2.heroW}mm`,
    '--p2-right-w': `${p2.rightW}mm`,
    '--p2-cols-left': String(p2.headCols),
    '--p2-cols-right': String(p2.rightCols),
    // Absent = the wireframe's black rule with a grey tag block. Gallery files
    // created before they adopted TagBar keep their authored accent as the rule.
    '--bar-color': doc.design.barColor ?? (isGallery ? doc.design.colors.accent : '#111418'),
    '--bar-tag': doc.design.barTagColor ?? '#bfbfbf',
    '--bar-ink': doc.design.barTagInk ?? '#111418',
    // Read by the running-text selectors only (see page.css's comment by
    // `.body-cols` and `.header`) — not by the top bar, hero or sidebar
    // placement, which stay put regardless of this setting.
    '--text-dir': doc.design.textDirection === 'rtl' ? 'rtl' : 'ltr',
  } as React.CSSProperties;

  // paper-2 spends two of paginateHosts' regions on sheet 1, so the fit badge
  // has to count sheets, not regions.
  const fit = isGallery
    ? ({ level: 'ok', text: '2 pages · spread' } as const)
    : isFrontCover
      ? ({ level: 'ok', text: '1 page · cover' } as const)
    : fitMessage(isP2 ? paper2Fit(pagination) : pagination);
  const pages = pagination.pages;

  // Free highlights are page obstacles just like images. A stale page number
  // from an older project must not manufacture blank sheets solely to reach
  // the callout: keep intentional placements on populated sheets, otherwise
  // move the box to the nearest earlier sheet containing article flow.
  const populatedPages = useMemo(
    () => populatedPhysicalPages(pages, doc.templateId),
    [pages, doc.templateId],
  );
  useEffect(() => {
    if (!hlFree || !populatedPages.length) return;
    const requested = (doc.highlightBox ?? defaultPlacedHighlights(doc.design)).anchor.page;
    if (populatedPages.includes(requested)) return;
    const earlier = populatedPages.filter((page) => page < requested);
    const target = earlier.at(-1) ?? populatedPages[0];
    if (!target || target === requested) return;
    updateDoc((current) => {
      if (current.design.highlightsPlacement !== 'free') return;
      current.highlightBox ??= defaultPlacedHighlights(current.design);
      if (current.highlightBox.anchor.page === requested) {
        current.highlightBox.anchor.page = target;
      }
    });
  }, [doc.design, doc.highlightBox, hlFree, populatedPages, updateDoc]);

  const scale = zoom === 'fit' ? fitScale : zoom;
  const pct = Math.round(scale * 100);
  // Magazine adds the cover sheet on top of the flowed content pages. magazine-2
  // instead puts the flow's first page ON sheet 1 and spends sheet 2 on the photo.
  const flowPageCount = isFrontCover
    ? 1
    : isGallery
      ? 2
    : isSplit
      ? 2 + Math.max(0, pages.length - 1)
      : isGate
        ? 2 + pages.length
        : isMag
          ? 1 + pages.length
          : isP2
          ? 1 + Math.max(0, pages.length - 2)
          : Math.max(1, pages.length);
  const lastPlacedImagePage = isGallery || isFrontCover
    ? 0
    : (doc.images ?? []).reduce((last, image) => Math.max(last, image.anchor.page), 0);
  const highlightPage =
    !isGallery && !isFrontCover && hlFree
      ? (doc.highlightBox ?? defaultPlacedHighlights(doc.design)).anchor.page
      : 0;
  const nPages = Math.max(flowPageCount, lastPlacedImagePage, highlightPage, calloutPageCount);

  // Measure the real page after its header/template geometry has settled.
  // Every image/flow-column overlap becomes an alpha-based CSS Shape in that
  // column. Measurements are converted back through preview zoom so the same
  // exclusion values work at Fit, 100%, and in print.
  useLayoutEffect(() => {
    const root = pagesRef.current;
    const hasPlacedObstacles =
      !isGallery && !isFrontCover && ((doc.images ?? []).length > 0 || hlFree);
    if (!root) return;
    const pageNodes = Array.from(root.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains('page'),
    );
    if (!hasPlacedObstacles) {
      setCalloutPageCount(positionImageAvoidingCallouts(pageNodes));
      if (imageExclusionKey.current !== '{}') {
        imageExclusionKey.current = '{}';
        setImageExclusions({});
      }
      return;
    }

    setCalloutPageCount(positionImageAvoidingCallouts(pageNodes));
    const flowNodes = Array.from(root.querySelectorAll<HTMLElement>('[data-flow-host]'));
    const next: PageImageExclusions = {};

    flowNodes.forEach((flow, flowIndex) => {
      const page = flow.closest<HTMLElement>('.page');
      if (!page || !pageNodes.includes(page) || !page.offsetWidth) return;
      const imageNodes = Array.from(
        page.querySelectorAll<HTMLElement>(
          '.placed-image, .placed-highlights, .sidebar-relocated, [data-image-avoiding-callout][data-image-avoidance="resolved"]',
        ),
      );
      if (!imageNodes.length) return;

      const pageRect = page.getBoundingClientRect();
      const flowRect = flow.getBoundingClientRect();
      const renderedScale = pageRect.width / page.offsetWidth || 1;
      const computed = getComputedStyle(flow);
      const columnCount = parseInt(computed.columnCount, 10) || 1;
      const columnGap = parseFloat(computed.columnGap) || 0;
      // Roughly 70% of one body-text em reads as a deliberate caption-to-copy
      // gap without wasting a whole line. Clamp it so very small/large custom
      // typography remains sensible across every paper and magazine family.
      const imageWrapGap = clamp((parseFloat(computed.fontSize) || 12) * 0.7, 6, 12);
      const flowWidth = flow.offsetWidth;
      const flowHeight = flow.offsetHeight;
      const columnWidth =
        columnCount > 1
          ? (flowWidth - (columnCount - 1) * columnGap) / columnCount
          : flowWidth;
      const rtl = computed.direction === 'rtl';
      const columns = Array.from({ length: columnCount }, () => [] as { top: number; bottom: number }[]);

      for (const imageNode of imageNodes) {
        const imageRect = imageNode.getBoundingClientRect();
        // Reserve the same editorial breathing room above the artwork and,
        // importantly, below its caption (imageRect includes a normal caption;
        // bottom-bleed captions are overlaid inside the same rectangle).
        const top = Math.max(
          0,
          (imageRect.top - flowRect.top) / renderedScale - imageWrapGap,
        );
        const bottom = Math.min(
          flowHeight,
          (imageRect.bottom - flowRect.top) / renderedScale + imageWrapGap,
        );
        if (bottom <= 0 || top >= flowHeight || bottom <= top) continue;

        for (let physicalColumn = 0; physicalColumn < columnCount; physicalColumn += 1) {
          const left = flowRect.left + physicalColumn * (columnWidth + columnGap) * renderedScale;
          const right = left + columnWidth * renderedScale;
          const horizontalOverlap = Math.min(right, imageRect.right) - Math.max(left, imageRect.left);
          if (horizontalOverlap <= 1) continue;
          const readingColumn = rtl ? columnCount - 1 - physicalColumn : physicalColumn;
          columns[readingColumn].push({
            top: Math.round(top * 10) / 10,
            bottom: Math.round(bottom * 10) / 10,
          });
        }
      }
      if (columns.some((column) => column.length)) next[flowIndex] = columns;
    });

    const key = JSON.stringify(next);
    if (key !== imageExclusionKey.current) {
      imageExclusionKey.current = key;
      setImageExclusions(next);
    }
  }, [
    doc.images,
    doc.assets,
    doc.design,
    doc.highlightBox,
    doc.highlights,
    doc.references,
    hlFree,
    isGallery,
    isFrontCover,
    nPages,
    pagination.layoutRevision,
    zoom,
  ]);

  // The hidden probe now rejects any candidate whose actual glyph rectangles
  // cross a segment boundary. Keep one final real-page guard as well: browser
  // font settling and the preview's transform can still make the committed DOM
  // differ fractionally from that probe. A detected clipped line increases the
  // probe reserve and immediately re-paginates, so an image can never remain on
  // top of text even under rapid image moves or font edits.
  useEffect(() => {
    wrapGuardTries.current = 0;
    setWrapSafetyBoost(0);
  }, [items, doc.images, doc.design, fontEpoch]);

  useLayoutEffect(() => {
    if (isGallery || isFrontCover || !Object.keys(imageExclusions).length) return;
    const revision = pagination.layoutRevision;
    if (revision !== layoutRevision.current) return;

    const check = () => {
      if (revision !== layoutRevision.current || wrapGuardTries.current >= 24) return;
      const root = pagesRef.current;
      if (!root) return;
      const clipped = Array.from(
        root.querySelectorAll<HTMLElement>('.flow-image-segment'),
      ).some(hasClippedTextLine);
      if (!clipped) return;

      wrapGuardTries.current += 1;
      // Preserve the established collision guarantee: a line that settles
      // differently in the transformed preview is pushed fully into the next
      // writable rectangle rather than being left underneath an image.
      setWrapSafetyBoost((current) => Math.min(48, current + 2));
    };

    check();
    const settleTimers = [120, 400, 900].map((ms) => window.setTimeout(check, ms));
    return () => settleTimers.forEach((timer) => window.clearTimeout(timer));
  }, [imageExclusions, isGallery, isFrontCover, pagination.layoutRevision, wrapSafetyBoost]);

  const fitShort = fit.text.split(' ·', 1)[0];
  const rows = Math.ceil(nPages / cols);
  const frame = {
    width: (cols * PAGE_W_PX + (cols - 1) * PAGE_GAP_PX) * scale,
    height: rows * (PAGE_H_PX + PAGE_GAP_PX) * scale,
  };
  const step = (d: number) => setZoom(clamp(Math.round((scale + d) * 100) / 100, 0.25, 2));

  const previewControls = (
    <div className="preview-bar preview-bar--toolbar">
      {/* Word-style formatting bar. onMouseDown+preventDefault keeps the
          focused paragraph textarea's selection alive while we apply the mark. */}
      <div className="format-bar">
        {FORMAT_BTNS.map((f) => (
          <button
            key={f.mark}
            type="button"
            className={`format-btn format-btn--${f.mark}`}
            title={f.title}
            onMouseDown={(e) => {
              e.preventDefault();
              applyMark(f.mark);
            }}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          className="format-btn format-btn--math"
          title="Inline formula — wraps the selection in $…$ (LaTeX/KaTeX)"
          onMouseDown={(e) => {
            e.preventDefault();
            insertMath();
          }}
        >
          ∑
        </button>
      </div>
      <span className={`fit-badge fit-${fit.level}`} title={fit.text}>
        <span className="fit-badge-long">{fit.text}</span>
        <span className="fit-badge-short">{fitShort}</span>
      </span>
      {((isMag && !isFrontCover) || isGallery) && (
        <div className="view-bar">
          <button
            type="button"
            className={`view-btn${spread ? ' is-active' : ''}`}
            onClick={() => setSpread((s) => !s)}
            title="Show as a side-by-side page spread"
            aria-pressed={spread}
          >
            <span className="view-btn-ico" aria-hidden="true">▭▭</span>
            Spread
          </button>
        </div>
      )}
      <div className="zoom-bar">
        <button
          type="button"
          className={`zoom-btn${zoom === 'fit' ? ' is-active' : ''}`}
          onClick={() => setZoom('fit')}
        >
          Fit
        </button>
        <button type="button" className="zoom-btn" onClick={() => step(-0.1)} title="Zoom out">
          −
        </button>
        <span className="zoom-val">{pct}%</span>
        <button type="button" className="zoom-btn" onClick={() => step(0.1)} title="Zoom in">
          +
        </button>
        <button
          type="button"
          className={`zoom-btn${zoom === 1 ? ' is-active' : ''}`}
          onClick={() => setZoom(1)}
        >
          100%
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`paper-scroll${doc.design.textDirection === 'rtl' ? ' paper-scroll--rtl' : ''}`}
      ref={scrollRef}
    >
      {/* Escape hatch — raw CSS from the design panel, scoped by author intent. */}
      {doc.design.customCss && <style>{doc.design.customCss}</style>}

      {toolbarHost ? createPortal(previewControls, toolbarHost) : previewControls}

      <div className="pages-frame" style={frame}>
        <div
          ref={pagesRef}
          className={`pages${spreadOn ? ' pages--spread' : ''}`}
          style={{ transform: `scale(${scale})` }}
        >
          {isGallery ? (
            <GalleryPage doc={doc} vars={vars} />
          ) : isFrontCover ? (
            <MagazineFrontCover doc={doc} vars={vars} />
          ) : isSplit ? (
            <>
              <MagSplitCover
                doc={doc}
                vars={vars}
                pieces={pages[0] ?? []}
                allowShortLastColumn={pages.length <= 1}
              />
              <MagPhotoPage doc={doc} vars={vars} pageIndex={1} />
              {Array.from({ length: Math.max(0, nPages - 2) }, (_, i) => (
                <MagazinePage
                  key={i}
                  doc={doc}
                  vars={vars}
                  pieces={pages[i + 1] ?? []}
                  lead={false}
                  pageIndex={i + 2}
                  allowShortLastColumn={i === pages.length - 2}
                />
              ))}
            </>
          ) : isGate ? (
            <>
              <MagGateA doc={doc} vars={vars} />
              <MagGateB doc={doc} vars={vars} />
              {Array.from({ length: Math.max(0, nPages - 2) }, (_, i) => (
                <MagazinePage
                  key={i}
                  doc={doc}
                  vars={vars}
                  pieces={pages[i] ?? []}
                  lead={i === 0}
                  head={false}
                  pageIndex={i + 2}
                  allowShortLastColumn={i === pages.length - 1}
                />
              ))}
            </>
          ) : isMag ? (
            <>
              <MagazineCover doc={doc} vars={vars} />
              {Array.from({ length: Math.max(0, nPages - 1) }, (_, i) => (
                <MagazinePage
                  key={i}
                  doc={doc}
                  vars={vars}
                  pieces={pages[i] ?? []}
                  lead={i === 0}
                  pageIndex={i + 1}
                  allowShortLastColumn={i === pages.length - 1}
                />
              ))}
            </>
          ) : isP2 ? (
            <>
              <PaperTwoPage
                doc={doc}
                vars={vars}
                left={pages[0] ?? []}
                right={pages[1] ?? []}
                leftIsFinal={pages.length <= 1}
                rightIsFinal={pages.length <= 2}
              />
              {Array.from({ length: Math.max(0, nPages - 1) }, (_, i) => (
                <ContPage
                  key={i}
                  doc={doc}
                  vars={vars}
                  pieces={pages[i + 2] ?? []}
                  pageIndex={i + 1}
                  allowShortLastColumn={i === pages.length - 3}
                />
              ))}
            </>
          ) : (
            <>
              <Page1
                doc={doc}
                vars={vars}
                pieces={pages[0] ?? []}
                allowShortLastColumn={pages.length <= 1}
              />
              {Array.from({ length: Math.max(0, nPages - 1) }, (_, i) => (
                <ContPage
                  key={i}
                  doc={doc}
                  vars={vars}
                  pieces={pages[i + 1] ?? []}
                  pageIndex={i + 1}
                  allowShortLastColumn={i === pages.length - 2}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Hidden measuring rig — same box as the real body columns. */}
      <div className="measure-root" style={vars} aria-hidden>
        {isSplit ? (
          <>
            {/* Head + foot aside sized first (they set --mag2-head-h/--mag2-aside-h),
                then sheet 1's narrow host and the full-width sheet-3+ host. Both
                measure inside a .mag2-inner so they get the real article width. */}
            <div className="mag2-page">
              <div className="mag2-inner" style={{ height: 'auto' }}>
                <div ref={splitHeadRef}>
                  <MagSplitHead doc={doc} />
                </div>
                <div className="mag2-cols mag2-cols--p1" ref={splitHost1Ref} />
                {/* Measured at one column's width — the width it renders at
                    inside the flow, so its atom's height is the real one. */}
                <div style={{ width: 'var(--mag2-col)' }}>
                  <div ref={splitAsideRef}>
                    <MagSplitAside doc={doc} />
                  </div>
                </div>
              </div>
            </div>
            <div className="mag-cols mag-cols--p2" ref={magHost2Ref} />
          </>
        ) : isMag && !isFrontCover ? (
          <>
            {/* Header sized first (sets --mag-head-h), then the two 2-col hosts. */}
            <div
              className="mag-head-measure"
              ref={magHeadRef}
              style={{ width: 'calc(var(--page-w) - 2 * var(--margin))' }}
            >
              <MagazineHead doc={doc} />
            </div>
            <div className="mag-cols mag-cols--p1" ref={magHost1Ref} />
            <div className="mag-cols mag-cols--p2" ref={magHost2Ref} />
          </>
        ) : null}
        {/* paper-2's two sheet-1 regions. Heights come from --p2-head-h /
            --p2-heroblock-h, set from the real sheet just before the break. */}
        {isP2 && (
          <>
            <div className="body-cols p2-host-l" ref={p2HostLRef} />
            <div className={`body-cols p2-host-r${railed}`} ref={p2HostRRef} />
          </>
        )}
        <div className="page">
          <div className={`body-cols body-cols--p1${railed}`} ref={host1Ref} />
        </div>
        <div className="page">
          <div className={`body-cols body-cols--p2${railedEvery}`} ref={host2Ref} />
        </div>
        {/* Below-article highlights: measured at body width to size its atom.
            Magazine's band spans its own content width, not the paper --body-1. */}
        {hlBelow && (
          <div style={{ width: isMag ? 'calc(var(--page-w) - 2 * var(--margin))' : 'var(--body-1)' }}>
            <aside className="hl-below" ref={hlRef}>
              <HighlightsBody doc={doc} hideRefs={doc.templateId === 'magazine-1'} />
            </aside>
          </div>
        )}
        {/* In-flow highlights: measured at one column's width. */}
        {hlFlow && (
          <div style={{ width: 'var(--col)' }}>
            <aside className="hl-col" ref={hlColRef}>
              <HighlightsBody doc={doc} />
            </aside>
          </div>
        )}
        {/* columnFill.ts's shared probe — className/width/height/column-count
            are all set imperatively per call, right before it's measured. */}
        <div ref={colProbeRef} />
      </div>
    </div>
  );
});
