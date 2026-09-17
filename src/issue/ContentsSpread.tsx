import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { contentsDeck, type ContentsEntry } from './model';
import { Wordmark } from '../components/Wordmark';
import './contents.css';

export interface ContentsSpreadProps {
  entries: readonly ContentsEntry[]; title?: string; subtitle?: string; direction?: 'ltr' | 'rtl';
  startNumber?: number; magazineName?: string; accent?: string; onOverflow?: (overflow: boolean) => void;
}

/**
 * Roomiest first. A contents sheet cannot grow, so the page picks the largest
 * treatment its own entries actually fit into and steps down only when the
 * measurement says it must — rather than guessing from the entry count, which
 * left a six-entry page in small type with a third of the sheet empty while a
 * page of long titles overflowed at the same count.
 */
const TIERS = ['issue-contents-airy', '', 'issue-contents-dense', 'issue-contents-dense issue-contents-packed'];

function overflows(page: HTMLElement) {
  const content = page.querySelector<HTMLElement>('.issue-contents-body');
  if (!content) return true;
  const bounds = content.getBoundingClientRect();
  if (content.scrollHeight > content.clientHeight + 2 || content.scrollWidth > content.clientWidth + 2) return true;
  return Array.from(content.querySelectorAll<HTMLElement>('h2,p,img')).some(element => {
    const box = element.getBoundingClientRect();
    return box.bottom > bounds.bottom + 1 || box.right > bounds.right + 1 || box.left < bounds.left - 1;
  });
}

function ContentsPage({ group, index, title, subtitle, direction, startNumber, magazineName, accent, onOverflow }: {
  group: readonly ContentsEntry[]; index: number; title: string; subtitle: string; direction: 'ltr' | 'rtl';
  startNumber: number; magazineName: string; accent: string; onOverflow: (overflow: boolean) => void;
}) {
  const page = useRef<HTMLElement>(null);
  const [tier, setTier] = useState(0);
  const signature = `${group.map(entry => `${entry.id}:${entry.title}:${entry.subtitle}:${entry.hero ?? ''}`).join('|')}|${title}|${subtitle}|${direction}`;
  const settled = useRef(signature);
  if (settled.current !== signature) { settled.current = signature; if (tier !== 0) setTier(0); }

  useLayoutEffect(() => {
    const host = page.current;
    if (!host) return;
    let live = true;
    const check = () => {
      if (!live || !page.current) return;
      const over = overflows(page.current);
      // Step down one treatment per pass; each step re-runs this effect, so the
      // page settles on the first tier that holds its entries.
      if (over && tier < TIERS.length - 1) setTier(tier + 1);
      else onOverflow(over);
    };
    check();
    const timer = window.setTimeout(check, 100);
    void document.fonts?.ready.then(check);
    const observer = new ResizeObserver(check);
    observer.observe(host);
    return () => { live = false; window.clearTimeout(timer); observer.disconnect(); };
  }, [tier, signature, onOverflow]);

  const [feature, ...rest] = group;
  const featureDeck = feature ? contentsDeck(feature.subtitle) : '';
  return <section
    ref={page}
    className={`page issue-contents-page${index === 1 ? ' issue-contents-second' : ''}${TIERS[tier] ? ` ${TIERS[tier]}` : ''}`}
    dir={direction} lang={direction === 'rtl' ? 'ar' : 'en'}
    style={{ '--contents-accent': accent, '--text-dir': direction } as CSSProperties}
    aria-label={`${title || 'Contents'} · ${index + 1} of 2`}
  >
    <header className="issue-contents-header"><div className="issue-contents-masthead"><span dir="auto">{magazineName}</span><span>{index === 0 ? '01 / 02' : '02 / 02'}</span></div><h1>{title || 'Contents'}{index === 1 && <span aria-hidden="true"> / 2</span>}</h1>{subtitle && <p>{subtitle}</p>}</header>
    <div className="issue-contents-body">
      {feature ? <article className="issue-contents-feature" data-contents-id={feature.id}>
        {feature.hero ? <img src={feature.hero} alt="" /> : <div className="issue-contents-art" aria-hidden="true"><i /><i /><Wordmark name={magazineName} /></div>}
        <div className="issue-contents-feature-copy"><span className="issue-contents-number">{String(feature.page).padStart(2, '0')}</span><div><h2 dir="auto">{feature.title}</h2>{featureDeck && <p dir="auto">{featureDeck}</p>}</div></div>
      </article> : <div className="issue-contents-empty"><Wordmark name={magazineName} /></div>}
      {!!rest.length && <div className="issue-contents-list">{rest.map(entry => <article key={entry.id} className="issue-contents-entry" data-contents-id={entry.id}>
        {entry.hero && <img src={entry.hero} alt="" />}
        <div className="issue-contents-entry-copy"><span className="issue-contents-number">{String(entry.page).padStart(2, '0')}</span><div><h2 dir="auto">{entry.title}</h2>{entry.subtitle && <p dir="auto">{entry.subtitle}</p>}</div></div>
      </article>)}</div>}
    </div>
    <footer className="issue-contents-footer"><span>{startNumber + index}</span><span dir="auto">{magazineName}</span></footer>
  </section>;
}

export function ContentsSpread({ entries, title = 'Contents', subtitle = '', direction = 'ltr', startNumber = 1, magazineName = 'Magazoo!', accent = '#9a603c', onOverflow }: ContentsSpreadProps) {
  const split = Math.ceil(entries.length / 2);
  const groups = [entries.slice(0, split), entries.slice(split)];
  const [spill, setSpill] = useState<[boolean, boolean]>([false, false]);
  useEffect(() => { onOverflow?.(spill[0] || spill[1]); }, [spill, onOverflow]);
  const report = (index: number) => (over: boolean) =>
    setSpill(current => (current[index] === over ? current : index === 0 ? [over, current[1]] : [current[0], over]));
  return <>{groups.map((group, index) => (
    <ContentsPage
      key={index} group={group} index={index} title={title} subtitle={subtitle} direction={direction}
      startNumber={startNumber} magazineName={magazineName} accent={accent} onOverflow={report(index)}
    />
  ))}</>;
}
