import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { ContentsEntry } from './model';
import './contents.css';

export interface ContentsSpreadProps {
  entries: readonly ContentsEntry[]; title?: string; subtitle?: string; direction?: 'ltr' | 'rtl';
  startNumber?: number; magazineName?: string; accent?: string; onOverflow?: (overflow: boolean) => void;
}

export function ContentsSpread({ entries, title = 'Contents', subtitle = '', direction = 'ltr', startNumber = 1, magazineName = 'Magazoo!', accent = '#9a603c', onOverflow }: ContentsSpreadProps) {
  const left = useRef<HTMLElement>(null), right = useRef<HTMLElement>(null);
  const split = Math.ceil(entries.length / 2);
  const groups = [entries.slice(0, split), entries.slice(split)];
  useLayoutEffect(() => {
    let live = true;
    const check = () => {
      if (!live) return;
      const pages = [left.current, right.current].filter((page): page is HTMLElement => !!page);
      const overflow = pages.some(page => {
        const content = page.querySelector<HTMLElement>('.issue-contents-body');
        if (!content) return true;
        const bounds = content.getBoundingClientRect();
        if (content.scrollHeight > content.clientHeight + 2 || content.scrollWidth > content.clientWidth + 2) return true;
        return Array.from(content.querySelectorAll<HTMLElement>('h2,p,img')).some(element => {
          const box = element.getBoundingClientRect();
          return box.bottom > bounds.bottom + 1 || box.right > bounds.right + 1 || box.left < bounds.left - 1;
        });
      });
      onOverflow?.(overflow);
    };
    check();
    const timer = window.setTimeout(check, 100);
    void document.fonts?.ready.then(check);
    const observer = new ResizeObserver(check);
    for (const page of [left.current, right.current]) if (page) observer.observe(page);
    return () => { live = false; window.clearTimeout(timer); observer.disconnect(); };
  }, [entries, title, subtitle, direction, onOverflow]);
  return <>{groups.map((group, index) => {
    const [feature, ...rest] = group;
    const dense = group.length > 7;
    return <section key={index} ref={index === 0 ? left : right} className={`page issue-contents-page${index === 1 ? ' issue-contents-second' : ''}${dense ? ' issue-contents-dense' : ''}${group.length <= 3 ? ' issue-contents-airy' : ''}`} dir={direction} lang={direction === 'rtl' ? 'ar' : 'en'} style={{ '--contents-accent': accent, '--text-dir': direction } as CSSProperties} aria-label={`${title || 'Contents'} · ${index + 1} of 2`}>
      <header className="issue-contents-header"><div className="issue-contents-masthead"><span dir="auto">{magazineName}</span><span>{index === 0 ? '01 / 02' : '02 / 02'}</span></div><h1>{title || 'Contents'}{index === 1 && <span aria-hidden="true"> / 2</span>}</h1>{subtitle && <p>{subtitle}</p>}</header>
      <div className="issue-contents-body">
        {feature ? <article className="issue-contents-feature" data-contents-id={feature.id}>
          {feature.hero ? <img src={feature.hero} alt="" /> : <div className="issue-contents-art" aria-hidden="true"><i /><i /><span>Magazoo!</span></div>}
          <div className="issue-contents-feature-copy"><span className="issue-contents-number">{String(feature.page).padStart(2, '0')}</span><div><h2 dir="auto">{feature.title}</h2>{feature.subtitle && <p dir="auto">{feature.subtitle}</p>}</div></div>
        </article> : <div className="issue-contents-empty"><span>Magazoo!</span><p dir="auto">{magazineName}</p></div>}
        {!!rest.length && <div className="issue-contents-list">{rest.map(entry => <article key={entry.id} className="issue-contents-entry" data-contents-id={entry.id}>
          {!dense && entry.hero && <img src={entry.hero} alt="" />}
          <div className="issue-contents-entry-copy"><span className="issue-contents-number">{String(entry.page).padStart(2, '0')}</span><div><h2 dir="auto">{entry.title}</h2>{entry.subtitle && <p dir="auto">{entry.subtitle}</p>}</div></div>
        </article>)}</div>}
      </div>
      <footer className="issue-contents-footer"><span>{startNumber + index}</span><span dir="auto">{magazineName}</span></footer>
    </section>;
  })}</>;
}
