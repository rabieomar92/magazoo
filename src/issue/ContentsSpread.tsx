import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { contentsDeck, DEFAULT_CONTENTS_DESIGN, type ContentsDensity, type ContentsDesign, type ContentsEntry } from './model';
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
  const bounds = content.getBoundingClientRect();
  if (content.scrollHeight > content.clientHeight + 2 || content.scrollWidth > content.clientWidth + 2) return true;
  return Array.from(content.querySelectorAll<HTMLElement>('h2,h3,p,.issue-contents-shot')).some(element => {
    const box = element.getBoundingClientRect();
    return box.bottom > bounds.bottom + 1 || box.right > bounds.right + 1 || box.left < bounds.left - 1;
  });
}

const number = (value: number, padded: boolean) => (padded ? String(value).padStart(2, '0') : String(value));

/** A framed picture that keeps its own shape: `aspect-ratio` comes straight
 * from the source photo, so a tall shot and a wide one end up genuinely
 * different sizes on the page instead of both being stretched to the same
 * flat rectangle. `kind` only picks the size ceiling for where it sits
 * (a full-width feature vs. a picture in a narrow rail beside a list). */
function Shot({ entry, design, kind }: { entry: ContentsEntry; design: ContentsDesign; kind: 'feature' | 'thumb' | 'rail' }) {
  if (!design.showHeroes || !entry.hero) return null;
  const label = entry.pageLabel ?? design.pageLabels;
  const { naturalWidth, naturalHeight } = entry.hero;
  const ratio = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 4 / 3;
  return <div className={`issue-contents-shot is-${kind}`} style={{ aspectRatio: ratio }}>
    <FramedImage asset={entry.hero} frame={entry.frame} fit="cover" />
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

function ContentsPage({ group, index, title, subtitle, direction, startNumber, magazineName, design, onOverflow }: {
  group: readonly ContentsEntry[]; index: number; title: string; subtitle: string; direction: 'ltr' | 'rtl';
  startNumber: number; magazineName: string; design: ContentsDesign; onOverflow: (overflow: boolean) => void;
}) {
  const page = useRef<HTMLElement>(null);
  const pinned = design.density === 'auto' ? null : PINNED[design.density];
  const [tier, setTier] = useState(pinned ?? 0);
  const signature = `${group.map(entry => `${entry.id}:${entry.title}:${entry.subtitle}:${entry.hero?.src ?? ''}:${entry.badge ?? ''}:${entry.section ?? ''}`).join('|')}|${title}|${subtitle}|${direction}|${JSON.stringify(design)}`;
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
          // A section that names only one article reads like its own small
          // feature — one picture, at its own shape, above the headline. A
          // section with several reads as a numbered list with a narrow rail
          // of pictures beside it, one per entry that actually has a photo
          // (not every row) — which is why one section can carry two
          // differently-shaped pictures and another carries none at all.
          const solo = block.entries.length === 1;
          const rail = block.entries.filter(entry => design.showHeroes && entry.hero);
          return <section key={`${block.section}-${position}`} className="issue-contents-block" style={sectionStyle}>
            <div className="issue-contents-block-head">
              <span className="issue-contents-number">{number(lead.page, design.paddedNumbers)}</span>
              <h3 dir="auto">{block.section || lead.title}</h3>
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
        {design.showHeroes && feature.hero
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
  const split = Math.ceil(entries.length / 2);
  const groups = [entries.slice(0, split), entries.slice(split)];
  const [spill, setSpill] = useState<[boolean, boolean]>([false, false]);
  useEffect(() => { onOverflow?.(spill[0] || spill[1]); }, [spill, onOverflow]);
  const report = (index: number) => (over: boolean) =>
    setSpill(current => (current[index] === over ? current : index === 0 ? [over, current[1]] : [current[0], over]));
  return <>{groups.map((group, index) => (
    <ContentsPage
      key={index} group={group} index={index} title={title} subtitle={subtitle} direction={direction}
      startNumber={startNumber} magazineName={magazineName} design={design} onOverflow={report(index)}
    />
  ))}</>;
}
