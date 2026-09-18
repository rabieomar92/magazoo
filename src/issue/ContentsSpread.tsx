import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { contentsDeck, DEFAULT_CONTENTS_DESIGN, type ContentsDensity, type ContentsDesign, type ContentsEntry } from './model';
import { choosePictures, columnGap, mosaicSeed, packColumns, pictureRatios } from './mosaic';
import { FramedImage } from '../components/FramedImage';
import { Wordmark } from '../components/Wordmark';
import './contents.css';

export interface ContentsSpreadProps {
  entries: readonly ContentsEntry[]; title?: string; subtitle?: string; direction?: 'ltr' | 'rtl';
  startNumber?: number; magazineName?: string; design?: ContentsDesign; onOverflow?: (overflow: boolean) => void;
}

/**
 * Roomiest first. A contents sheet cannot grow, so a page on automatic density
 * takes the largest treatment its own entries fit into and steps down only when
 * the measurement says it must — rather than guessing from the entry count,
 * which left a six-entry page in small type with a third of the sheet empty
 * while a page of long titles overflowed at the same count. An editor who wants
 * one fixed treatment across the spread can pin it instead.
 *
 * That decides how dense the TEXT reads. The pictures don't get force-grown to
 * fill whatever's left over — a photo keeps its own aspect ratio (see Shot
 * below), so a portrait shot reads tall and narrow next to a landscape one
 * reading short and wide, the way an actual magazine page varies, instead of
 * every picture being stretched into the same flat wide bar. What "fills the
 * space" instead is the density tier itself: a lightly-loaded page settles on
 * a roomier tier with a wider picture rail and bigger type; a busy one steps
 * down. Two sections on the same page still end up looking different from
 * each other, just for a truer reason than one flexing harder than the other.
 */
const TIERS = ['issue-contents-airy', '', 'issue-contents-dense', 'issue-contents-dense issue-contents-packed'];
const PINNED: Record<Exclude<ContentsDensity, 'auto'>, number> = { airy: 0, normal: 1, dense: 2, packed: 3 };

/** One colour per section — a sectioned contents page reads section by
 * section (Editorial, People, Research…), each in its own colour, rather
 * than the whole spread sharing one accent. Picked by a stable hash of the
 * section's own name rather than its position, so "Research highlights"
 * reads the same colour wherever it lands — including when a long section
 * spills from page one onto page two and is regrouped there as its own
 * block, which would otherwise recolour it by coincidence of position. */
const SECTION_PALETTE = ['#c1652b', '#c23b52', '#1f6f8b', '#3f8f52', '#7a4fb0', '#0e8f86'];
function sectionColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return SECTION_PALETTE[Math.abs(hash) % SECTION_PALETTE.length];
}

function overflows(page: HTMLElement) {
  const content = page.querySelector<HTMLElement>('.issue-contents-body');
  if (!content) return true;
  if (content.scrollHeight > content.clientHeight + 2 || content.scrollWidth > content.clientWidth + 2) return true;
  const bounds = content.getBoundingClientRect();
  // The compiled preview shows these sheets scaled down to fit the pane, and
  // getBoundingClientRect reports that scale. A fixed pixel tolerance would
  // therefore mean something stricter at 40% than at 100% and report an
  // overflow the printed page does not have, so the slack is scaled too.
  const zoom = content.offsetWidth > 0 ? bounds.width / content.offsetWidth : 1;
  const slack = Math.max(0.5, zoom);
  return Array.from(content.querySelectorAll<HTMLElement>('h2,h3,p,.issue-contents-shot')).some(element => {
    const box = element.getBoundingClientRect();
    return box.bottom > bounds.bottom + slack || box.right > bounds.right + slack || box.left < bounds.left - slack;
  });
}

const number = (value: number, padded: boolean) => (padded ? String(value).padStart(2, '0') : String(value));

/**
 * Does this line carry a picture? The spread-wide switch sets the habit; a
 * single entry can depart from it either way. Some photographs simply do not
 * survive a thumbnail — a wide group shot, a portrait that has to be cropped
 * past the chin — and a contents page reads better when those lines are text
 * beside the ones that are carrying a real picture, rather than every line
 * being illustrated on principle.
 */
export function showsHero(entry: ContentsEntry, design: ContentsDesign) {
  return (entry.showHero ?? design.showHeroes) && !!entry.hero;
}

/** A framed picture that keeps its own shape: `aspect-ratio` comes straight
 * from the source photo, so a tall shot and a wide one end up genuinely
 * different sizes on the page instead of both being stretched to the same
 * flat rectangle. `kind` only picks the size ceiling for where it sits
 * (a full-width feature vs. a picture in a narrow rail beside a list). */
function Shot({ entry, design, kind }: { entry: ContentsEntry; design: ContentsDesign; kind: 'feature' | 'thumb' | 'rail' }) {
  const hero = entry.hero;
  if (!hero || !showsHero(entry, design)) return null;
  const label = entry.pageLabel ?? design.pageLabels;
  const { naturalWidth, naturalHeight } = hero;
  const ratio = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 4 / 3;
  // Tagged so the studio's crop control can measure the slot this picture
  // actually lands in — a rail slot and a feature slot cut the same photo
  // very differently, and guessing that shape is how heads get cropped off.
  return <div className={`issue-contents-shot is-${kind}`} data-contents-shot={entry.id} style={{ aspectRatio: ratio }}>
    <FramedImage asset={hero} frame={entry.frame} fit="cover" />
    {label && <span className="issue-contents-plabel">p.{entry.page}</span>}
  </div>;
}

/** A "COVER STORY"-style flag, read as a small chip under the headline. */
function Badge({ entry }: { entry: ContentsEntry }) {
  return entry.badge ? <span className="issue-contents-badge">{entry.badge}</span> : null;
}

/** Consecutive entries carrying the same section name read as one block. */
function grouped(entries: readonly ContentsEntry[]) {
  const blocks: { section: string; entries: ContentsEntry[] }[] = [];
  for (const entry of entries) {
    const section = entry.section ?? '';
    const last = blocks[blocks.length - 1];
    if (last && last.section === section) last.entries.push(entry);
    else blocks.push({ section, entries: [entry] });
  }
  return blocks;
}

/**
 * One card on the contents page.
 *
 * The card is as tall as its own content makes it — that is the whole idea.
 * A picture, a headline and a standfirst make a tall card; a bare one-line
 * brief makes a short one; and a column of them therefore has a rhythm rather
 * than a beat. Nothing here fixes a height, so nothing here can be clipped
 * or leave a hole: the column is packed from measured heights afterwards.
 *
 * The picture is the one thing given a height rather than taking one, because
 * a photograph has no natural size on a page. It keeps its own proportions,
 * nudged by a seeded amount so a column does not come out as a stack of
 * identical bands, and capped so a single picture can never take a column.
 */
function MosaicCard({ entry, design, ratio, photo }: {
  entry: ContentsEntry; design: ContentsDesign; ratio: number; photo: boolean;
}) {
  const hero = entry.hero;
  const withPhoto = photo && !!hero;
  const deck = entry.subtitle ? contentsDeck(entry.subtitle) : '';
  return <article className={`issue-mosaic-card${withPhoto ? ' has-photo' : ''}`} data-contents-id={entry.id}>
    {withPhoto && hero && <div className="issue-mosaic-photo" data-contents-shot={entry.id} style={{ aspectRatio: `1 / ${ratio.toFixed(3)}` }}>
      <FramedImage asset={hero} frame={entry.frame} fit="cover" />
      {(entry.pageLabel ?? design.pageLabels) && <span className="issue-contents-plabel">p.{entry.page}</span>}
    </div>}
    <div className="issue-mosaic-head">
      <span className="issue-mosaic-number">{number(entry.page, design.paddedNumbers)}</span>
      {entry.section && <span className="issue-mosaic-section" dir="auto">{entry.section}</span>}
    </div>
    <h2 dir="auto">{entry.title}</h2>
    <Badge entry={entry} />
    {deck && <p dir="auto">{deck}</p>}
  </article>;
}

/** Air between cards, and the most of a column's slack that may be spread
 * between them before the rest is simply left at the foot. */
const CARD_GAP_MM = 7;
const MAX_EXTRA_GAP_MM = 11;
/** A contents sheet is A4. Used only to recover the pane's zoom exactly. */
const PAGE_WIDTH_PX = (210 * 96) / 25.4;

/**
 * Which entries most deserve a picture when there is not room for all of them.
 *
 * A flagged cover story first, then whatever has something to say for itself —
 * a real standfirst, a headline with some weight — and a small stable wobble
 * so two equally-plain entries do not always resolve the same way, and so the
 * shuffle control has something to change here too.
 */
function pictureScore(entry: ContentsEntry, salt: number) {
  const deck = entry.subtitle?.trim() ?? '';
  return (entry.badge ? 2 : 0)
    + Math.min(1.5, deck.length / 110)
    + Math.min(0.6, entry.title.length / 110)
    + (mosaicSeed([entry.id], salt) % 1000) / 1000 * 0.7;
}

/**
 * The contents spread, laid as two columns of cards per sheet.
 *
 * Card heights are not knowable in advance — they depend on how a headline
 * breaks at this column width, in this typeface, at this density — so the
 * cards are laid out once in a hidden column of exactly the real width, their
 * heights are read off the page, and only then are they dealt into the real
 * columns. That measure-then-place order is the same one the article
 * pagination engine uses, and it is what lets a column be filled to the last
 * millimetre without ever being overfilled.
 *
 * If the entries cannot be made to fit on two sheets even at the tightest
 * density, the surplus is reported rather than drawn off the page, and the
 * studio shows the editor which way to go.
 */
function MosaicSpread({ entries, title, direction, startNumber, magazineName, design, onOverflow }: {
  entries: readonly ContentsEntry[]; title: string; direction: 'ltr' | 'rtl';
  startNumber: number; magazineName: string; design: ContentsDesign;
  onOverflow?: (overflow: boolean) => void;
}) {
  const probe = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pinned = design.density === 'auto' ? null : PINNED[design.density];
  const [tier, setTier] = useState(pinned ?? 0);
  const seed = mosaicSeed(entries.map(entry => entry.id), design.mosaicSalt);
  const ratios = pictureRatios(
    entries.map(entry => (entry.hero && entry.hero.naturalWidth > 0 && entry.hero.naturalHeight > 0
      ? entry.hero.naturalWidth / entry.hero.naturalHeight : undefined)),
    seed,
  );
  // Which entries the spread is allowed to decide for, and in what order it
  // should offer them a picture.
  const eligible = entries.map(entry => !!entry.hero);
  const forced = entries.map(entry => (
    design.pictures === 'all' ? entry.showHero ?? true
      : design.pictures === 'none' ? entry.showHero ?? false
      : entry.showHero));
  const order = entries
    .map((entry, index) => ({ index, score: pictureScore(entry, design.mosaicSalt) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(item => item.index);

  const signature = `${entries.map((entry, i) => `${entry.id}:${entry.title}:${entry.subtitle}:${entry.hero?.src ?? ''}:${entry.badge ?? ''}:${entry.section ?? ''}:${entry.showHero ?? ''}:${ratios[i].toFixed(3)}`).join('|')}|${title}|${direction}|${JSON.stringify(design)}`;
  const [plan, setPlan] = useState<{ signature: string; tier: number; pages: number[][][]; gaps: number[][]; centred: boolean[][]; photos: boolean[] } | null>(null);
  const settled = useRef(signature);
  if (settled.current !== signature) { settled.current = signature; const next = pinned ?? 0; if (tier !== next) setTier(next); }
  const first = useRef(true);

  useLayoutEffect(() => {
    const host = probe.current;
    const body = bodyRef.current;
    if (!host || !body) return;
    const measure = () => {
      // Every measurement has to be in the same units. The pane carries a
      // zoom, so a bounding rect is scaled while clientHeight is not — mixing
      // the two packs a column against the wrong ceiling and pushes its last
      // card past the foot of the page.
      const columnHeight = body.getBoundingClientRect().height;
      const withPhoto = Array.from(host.querySelectorAll<HTMLElement>('[data-variant=photo]'));
      const asText = Array.from(host.querySelectorAll<HTMLElement>('[data-variant=text]'));
      if (!columnHeight || withPhoto.length !== entries.length || asText.length !== entries.length) return;
      // The sheet is exactly A4 wide, so that known width is what the pane's
      // zoom is measured against — deriving it from a rounded `offsetHeight`
      // is off by a fraction of a percent, which is enough to over-space a
      // column and push its last card past the foot of the page.
      const sheet = body.closest<HTMLElement>('.page');
      const scale = sheet ? sheet.getBoundingClientRect().width / PAGE_WIDTH_PX : 1;
      if (!Number.isFinite(scale) || scale <= 0) return;
      const picture = withPhoto.map(card => card.getBoundingClientRect().height);
      const text = asText.map(card => card.getBoundingClientRect().height);
      const gap = (CARD_GAP_MM * 96) / 25.4 * scale * (design.gapScale || 1);
      const maxExtra = (MAX_EXTRA_GAP_MM * 96) / 25.4 * scale * (design.gapScale || 1);
      // A hair of headroom, so sub-pixel rounding can never be what decides
      // whether a card fits.
      const pack = { columnHeight: columnHeight - scale, gap };
      const photos = choosePictures({ text, picture, eligible, forced, order, pack });
      const heights = photos.map((on, index) => (on ? picture[index] : text[index]));
      const packed = packColumns(heights, pack);
      const gaps = packed.pages.map(page => page.map(column =>
        columnGap(column.map(index => heights[index]), pack.columnHeight, gap, maxExtra) / scale));
      // A column holding one or two short cards cannot be spread to the foot
      // of the page — there are not enough gaps to put the slack into — and a
      // card marooned at the top of an empty column is the thing that reads as
      // a hole. Centring the little that is there makes the same white space
      // read as margin instead.
      const centred = packed.pages.map((page, pageIndex) => page.map((column, columnIndex) => {
        if (!column.length) return false;
        const content = column.reduce((sum, index) => sum + heights[index], 0)
          + gaps[pageIndex][columnIndex] * scale * (column.length - 1);
        return content / pack.columnHeight < 0.62;
      }));
      const over = packed.placed < entries.length;
      if (over && pinned === null && tier < TIERS.length - 1) { setTier(tier + 1); return; }
      onOverflow?.(over);
      setPlan(current => (current && current.signature === signature && current.tier === tier
        && JSON.stringify(current.pages) === JSON.stringify(packed.pages)
        && JSON.stringify(current.photos) === JSON.stringify(photos) ? current
        : { signature, tier, pages: packed.pages, gaps, centred, photos }));
    };
    // The first paint of a spread measures straight away, so it is never seen
    // unplaced. After that the work is deferred a beat: an editor typing into
    // a contents field sees their words land instantly either way, and
    // re-dealing the columns on every keystroke would be the one thing that
    // made it feel heavy.
    let timer = 0;
    if (first.current) { first.current = false; measure(); }
    else timer = window.setTimeout(measure, 70);
    const settle = window.setTimeout(measure, 260);
    void document.fonts?.ready.then(measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    observer?.observe(body);
    return () => { window.clearTimeout(timer); window.clearTimeout(settle); observer?.disconnect(); };
    // `eligible`, `forced` and `order` are all derived from `entries` and
    // `design`, which the signature already covers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, tier, pinned, entries, design.gapScale, onOverflow]);

  const style = {
    '--contents-accent': design.accent,
    '--contents-heading': design.headingColor,
    '--contents-cols': design.columns,
    '--contents-headline-font': design.titleFont === 'sans' ? "'Avenir Next LT Pro','Helvetica',Arial,sans-serif" : "'Playfair Display',Georgia,serif",
    '--contents-scale': design.textScale,
    '--contents-tracking': `${design.tracking}em`,
    '--contents-gap-scale': design.gapScale,
    '--text-dir': direction,
  } as CSSProperties;
  const className = (index: number) => ['page issue-contents-page issue-contents-mosaic', index === 1 && 'issue-contents-second',
    TIERS[tier], !design.rules && 'issue-contents-ruleless'].filter(Boolean).join(' ');
  // Keep showing the placement we already have while a new one is worked out.
  // The cards themselves are drawn from `entries`, so an editor's words land
  // on the sheet the instant they type them; only which column a card sits in
  // waits for the next measurement. Blanking the spread for those few
  // milliseconds — which is what insisting on a matching signature did — made
  // the page flash empty on every keystroke.
  const usable = plan && plan.pages.every(page => page.every(column => column.every(index => index < entries.length)))
    && plan.photos.length === entries.length;
  const current = usable ? plan : null;
  const columnsFor = (page: number) => current ? current.pages[page] : [[], []];
  const gapFor = (page: number, column: number) => current?.gaps[page]?.[column];
  const photoFor = (index: number) => current ? current.photos[index] : eligible[index] && forced[index] !== false;

  return <>{[0, 1].map(index => (
    <section key={index} className={className(index)} dir={direction} lang={direction === 'rtl' ? 'ar' : 'en'} style={style}
      aria-label={`${title || 'Contents'} · ${index + 1} of 2`}>
      <div className="issue-contents-masthead">
        <span className="issue-contents-kicker">{title || 'Contents'}</span>
        <span dir="auto">{magazineName} &middot; {startNumber + index}</span>
      </div>
      <div className="issue-contents-body" ref={index === 0 ? bodyRef : undefined}>
        <div className="issue-mosaic-columns">
          {columnsFor(index).map((column, position) => (
            <div key={position} className={`issue-mosaic-col${current?.centred[index]?.[position] ? ' is-settled' : ''}`} style={{ rowGap: gapFor(index, position) }}>
              {column.map(entryIndex => (
                <MosaicCard key={entries[entryIndex].id} entry={entries[entryIndex]} design={design}
                  ratio={ratios[entryIndex]} photo={photoFor(entryIndex)} />
              ))}
            </div>
          ))}
        </div>
        {/* Both versions of every card, laid out at exactly one column's width
            and off the page. Measuring each entry with and without its picture
            is what lets the spread work out how many pictures it can afford
            rather than guessing at a threshold. */}
        {index === 0 && <div className="issue-mosaic-probe" ref={probe} aria-hidden="true">
          {entries.map((entry, entryIndex) => (
            <div key={`photo-${entry.id}`} data-variant="photo">
              <MosaicCard entry={entry} design={design} ratio={ratios[entryIndex]} photo />
            </div>
          ))}
          {entries.map((entry, entryIndex) => (
            <div key={`text-${entry.id}`} data-variant="text">
              <MosaicCard entry={entry} design={design} ratio={ratios[entryIndex]} photo={false} />
            </div>
          ))}
        </div>}
      </div>
    </section>
  ))}</>;
}

function ContentsPage({ group, index, title, subtitle, direction, startNumber, magazineName, design, onOverflow }: {
  group: readonly ContentsEntry[]; index: number; title: string; subtitle: string; direction: 'ltr' | 'rtl';
  startNumber: number; magazineName: string; design: ContentsDesign; onOverflow: (overflow: boolean) => void;
}) {
  const page = useRef<HTMLElement>(null);
  const pinned = design.density === 'auto' ? null : PINNED[design.density];
  const [tier, setTier] = useState(pinned ?? 0);
  const signature = `${group.map(entry => `${entry.id}:${entry.title}:${entry.subtitle}:${entry.hero?.src ?? ''}:${entry.badge ?? ''}:${entry.section ?? ''}:${entry.showHero ?? ''}:${JSON.stringify(entry.frame ?? null)}`).join('|')}|${title}|${subtitle}|${direction}|${JSON.stringify(design)}`;
  const settled = useRef(signature);
  if (settled.current !== signature) { settled.current = signature; const next = pinned ?? 0; if (tier !== next) setTier(next); }

  useLayoutEffect(() => {
    const host = page.current;
    if (!host) return;
    let live = true;
    const check = () => {
      if (!live || !page.current) return;
      const over = overflows(page.current);
      if (over && pinned === null && tier < TIERS.length - 1) setTier(tier + 1);
      else onOverflow(over);
    };
    check();
    const timer = window.setTimeout(check, 100);
    void document.fonts?.ready.then(check);
    const observer = new ResizeObserver(check);
    observer.observe(host);
    return () => { live = false; window.clearTimeout(timer); observer.disconnect(); };
  }, [tier, pinned, signature, onOverflow]);

  const style = {
    '--contents-accent': design.accent,
    '--contents-heading': design.headingColor,
    '--contents-feature-h': `${design.featureHeight}mm`,
    '--contents-thumb-h': `${design.thumbHeight}mm`,
    '--contents-cols': design.columns,
    '--contents-headline-font': design.titleFont === 'sans' ? "'Avenir Next LT Pro','Helvetica',Arial,sans-serif" : "'Playfair Display',Georgia,serif",
    '--contents-scale': design.textScale,
    '--contents-tracking': `${design.tracking}em`,
    '--contents-gap-scale': design.gapScale,
    '--text-dir': direction,
  } as CSSProperties;
  const className = ['page issue-contents-page', index === 1 && 'issue-contents-second', TIERS[tier],
    `issue-contents-${design.layout}`, !design.rules && 'issue-contents-ruleless'].filter(Boolean).join(' ');

  const head = <header className="issue-contents-header">
    <div className="issue-contents-masthead"><span className="issue-contents-kicker">Table of contents</span><span dir="auto">{magazineName} &middot; {index === 0 ? '01 / 02' : '02 / 02'}</span></div>
    <h1>{title || 'Contents'}{index === 1 && <span aria-hidden="true"> / 2</span>}</h1>
    {subtitle && <p>{subtitle}</p>}
  </header>;
  const foot = <footer className="issue-contents-footer"><span>{startNumber + index}</span><span dir="auto">{magazineName}</span></footer>;

  if (design.layout === 'sections') {
    return <section ref={page} className={className} dir={direction} lang={direction === 'rtl' ? 'ar' : 'en'} style={style} aria-label={`${title || 'Contents'} · ${index + 1} of 2`}>
      {head}
      <div className="issue-contents-body">
        {group.length ? <div className="issue-contents-sections">{grouped(group).map((block, position) => {
          const [lead] = block.entries;
          const color = sectionColor(block.section || lead.title);
          const sectionStyle = { '--contents-heading': color, '--contents-accent': color } as CSSProperties;
          // The block heading is the section the articles announce on their
          // own pages. Where an article carries no top bar there is no
          // section to print, so a run of them reads under one neutral
          // heading rather than borrowing the first article's headline —
          // which used to print that headline twice, once as the heading
          // and again as the entry underneath it.
          const solo = block.entries.length === 1;
          const heading = block.section || (solo ? '' : 'In this issue');
          // A section that names only one article reads like its own small
          // feature — one picture, at its own shape, above the headline. A
          // section with several reads as a numbered list with a narrow rail
          // of pictures beside it, one per entry that actually has a photo
          // (not every row) — which is why one section can carry two
          // differently-shaped pictures and another carries none at all.
          const rail = block.entries.filter(entry => showsHero(entry, design));
          return <section key={`${block.section}-${position}`} className="issue-contents-block" style={sectionStyle}>
            <div className="issue-contents-block-head">
              <span className="issue-contents-number">{number(lead.page, design.paddedNumbers)}</span>
              {heading && <h3 dir="auto">{heading}</h3>}
              {solo && <Badge entry={lead} />}
            </div>
            {solo ? <article className="issue-contents-block-solo-wrap" data-contents-id={lead.id}>
              <Shot entry={lead} design={design} kind="feature" />
              <div className="issue-contents-block-solo">
                <h2 dir="auto">{lead.title}</h2>
                {lead.subtitle && <p dir="auto">{contentsDeck(lead.subtitle)}</p>}
              </div>
            </article> : <div className="issue-contents-block-body">
              <ol className="issue-contents-rows">
                {block.entries.map(entry => <li key={entry.id} data-contents-id={entry.id}>
                  <span className="issue-contents-rownum">{number(entry.page, design.paddedNumbers)}</span>
                  <div>
                    <h2 dir="auto">{entry.title}</h2>
                    <Badge entry={entry} />
                    {entry.subtitle && <p dir="auto">{entry.subtitle}</p>}
                  </div>
                </li>)}
              </ol>
              {!!rail.length && <div className="issue-contents-block-rail">
                {rail.map(entry => <Shot key={entry.id} entry={entry} design={design} kind="rail" />)}
              </div>}
            </div>}
          </section>;
        })}</div> : <div className="issue-contents-empty"><Wordmark name={magazineName} /></div>}
      </div>
      {foot}
    </section>;
  }

  const [feature, ...rest] = group;
  const featureDeck = feature ? contentsDeck(feature.subtitle) : '';
  return <section ref={page} className={className} dir={direction} lang={direction === 'rtl' ? 'ar' : 'en'} style={style} aria-label={`${title || 'Contents'} · ${index + 1} of 2`}>
    {head}
    <div className="issue-contents-body">
      {feature ? <article className="issue-contents-feature" data-contents-id={feature.id}>
        {showsHero(feature, design)
          ? <Shot entry={feature} design={design} kind="feature" />
          : <div className="issue-contents-art" aria-hidden="true"><i /><i /><Wordmark name={magazineName} /></div>}
        <div className="issue-contents-feature-copy">
          <span className="issue-contents-number">{number(feature.page, design.paddedNumbers)}</span>
          <div><h2 dir="auto">{feature.title}</h2><Badge entry={feature} />{featureDeck && <p dir="auto">{featureDeck}</p>}</div>
        </div>
      </article> : <div className="issue-contents-empty"><Wordmark name={magazineName} /></div>}
      {!!rest.length && <div className="issue-contents-list">{grouped(rest).map((block, position) => <div key={`${block.section}-${position}`} className="issue-contents-group">
        {block.section && <h3 className="issue-contents-section" dir="auto">{block.section}</h3>}
        {block.entries.map(entry => <article key={entry.id} className="issue-contents-entry" data-contents-id={entry.id}>
          <Shot entry={entry} design={design} kind="thumb" />
          <div className="issue-contents-entry-copy">
            <span className="issue-contents-number">{number(entry.page, design.paddedNumbers)}</span>
            <div><h2 dir="auto">{entry.title}</h2><Badge entry={entry} />{entry.subtitle && <p dir="auto">{entry.subtitle}</p>}</div>
          </div>
        </article>)}
      </div>)}</div>}
    </div>
    {foot}
  </section>;
}

export function ContentsSpread({ entries, title = 'Contents', subtitle = '', direction = 'ltr', startNumber = 1, magazineName = 'Magazoo!', design = DEFAULT_CONTENTS_DESIGN, onOverflow }: ContentsSpreadProps) {
  // Hooks first, branch second: the two layouts are different components and
  // the rules of hooks do not care that only one of them ever renders.
  const [spill, setSpill] = useState<[boolean, boolean]>([false, false]);
  const mosaic = design.layout === 'mosaic';
  useEffect(() => { if (!mosaic) onOverflow?.(spill[0] || spill[1]); }, [mosaic, spill, onOverflow]);
  if (mosaic) return <MosaicSpread
    entries={entries} title={title} direction={direction} startNumber={startNumber}
    magazineName={magazineName} design={design} onOverflow={onOverflow}
  />;
  const split = Math.ceil(entries.length / 2);
  const groups = [entries.slice(0, split), entries.slice(split)];
  const report = (index: number) => (over: boolean) =>
    setSpill(current => (current[index] === over ? current : index === 0 ? [over, current[1]] : [current[0], over]));
  return <>{groups.map((group, index) => (
    <ContentsPage
      key={index} group={group} index={index} title={title} subtitle={subtitle} direction={direction}
      startNumber={startNumber} magazineName={magazineName} design={design} onOverflow={report(index)}
    />
  ))}</>;
}
