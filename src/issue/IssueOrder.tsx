import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { CONTENTS_ID, reorderIssue, type IssueAssignment, type IssueItem, type IssuePlan } from './model';

export function IssueOrder({ plan, items, assignments, disabled, onChange }: {
  plan: IssuePlan; items: IssueItem[]; assignments: IssueAssignment[]; disabled: boolean; onChange: (plan: IssuePlan) => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  const latest = useRef(plan); latest.current = plan;
  const cleanup = useRef<() => void>(() => {});
  const [drag, setDrag] = useState<{ id: string; over: string } | null>(null);
  const [keyboard, setKeyboard] = useState<{ id: string; original: string[] } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => () => cleanup.current(), []);
  const byId = new Map(items.map(item => [item.id, item]));
  const move = (id: string, delta: number) => {
    const order = latest.current.order;
    const position = order.indexOf(id), target = position + delta;
    if (target < 0 || target >= order.length) return;
    onChange({ ...latest.current, order: reorderIssue(order, id, order[target]) });
    setAnnouncement(`Moved to position ${target + 1} of ${order.length}.`);
  };
  const pointerStart = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (disabled || event.button !== 0 || keyboard) return;
    event.preventDefault();
    cleanup.current();
    const button = event.currentTarget;
    button.setPointerCapture(event.pointerId);
    let over = id, y = event.clientY, frame = 0;
    const hit = (x: number, nextY: number) => {
      y = nextY;
      const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-issue-order-id]');
      const target = row?.dataset.issueOrderId;
      if (target && list.current?.contains(row!)) { over = target; setDrag({ id, over }); }
    };
    const scroll = () => {
      const host = list.current;
      if (host) {
        const rect = host.getBoundingClientRect();
        if (y < rect.top + 55) host.scrollTop -= 11;
        else if (y > rect.bottom - 55) host.scrollTop += 11;
        const row = document.elementFromPoint(rect.left + rect.width / 2, Math.min(rect.bottom - 2, Math.max(rect.top + 2, y)))?.closest<HTMLElement>('[data-issue-order-id]');
        if (row && host.contains(row) && row.dataset.issueOrderId) { over = row.dataset.issueOrderId; setDrag(previous => previous?.over === over ? previous : { id, over }); }
      }
      frame = requestAnimationFrame(scroll);
    };
    const update = (e: globalThis.PointerEvent) => hit(e.clientX, e.clientY);
    const stop = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', update);
      window.removeEventListener('pointerup', drop);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', escape);
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      setDrag(null);
    };
    const drop = () => {
      stop();
      if (over !== id) {
        const next = reorderIssue(latest.current.order, id, over);
        onChange({ ...latest.current, order: next });
        setAnnouncement(`Moved to position ${next.indexOf(id) + 1} of ${next.length}.`);
      }
    };
    const cancel = () => { stop(); setAnnouncement('Move cancelled.'); };
    const escape = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') cancel(); };
    cleanup.current = stop;
    setDrag({ id, over });
    window.addEventListener('pointermove', update);
    window.addEventListener('pointerup', drop, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
    window.addEventListener('keydown', escape);
    frame = requestAnimationFrame(scroll);
  };
  const keyMove = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setKeyboard(previous => previous ? null : { id, original: [...plan.order] });
      setAnnouncement(keyboard ? 'Position confirmed.' : 'Picked up. Use arrow keys to move, Space to place, Escape to cancel.');
    } else if (keyboard?.id === id && ['ArrowUp', 'ArrowDown', 'Escape'].includes(e.key)) {
      e.preventDefault();
      if (e.key === 'Escape') { onChange({ ...plan, order: keyboard.original }); setKeyboard(null); setAnnouncement('Move cancelled.'); }
      else move(id, e.key === 'ArrowUp' ? -1 : 1);
    }
  };
  return <>
    <p id="issue-drag-help" className="issue-help">Drag the grip to arrange. Each article’s pages stay together. Keyboard: Space, arrow keys, then Space to place.</p>
    <div className="issue-sr-only" aria-live="polite">{announcement}</div>
    <ol className="issue-order" ref={list} aria-label="Issue reading order">
      {plan.order.map((id, index) => {
        const item = byId.get(id), contents = id === CONTENTS_ID;
        const row = assignments.find(assignment => assignment.id === id);
        const title = contents ? plan.contentsTitle || 'Contents' : item?.doc.meta.title || item?.name || 'Untitled';
        const pages = row ? row.counted ? (row.pageCount === 1 ? `${row.startNumber}` : `${row.startNumber}–${row.startNumber + row.pageCount - 1}`) : 'Cover' : '…';
        const selected = !plan.contentsExcluded.includes(id);
        return <li key={id} data-issue-order-id={id} className={`${contents ? 'issue-order-contents' : ''}${drag?.id === id || keyboard?.id === id ? ' is-grabbed' : ''}${drag?.over === id && drag.id !== id ? ' is-drop-target' : ''}`}>
          <button type="button" className="issue-grip" aria-label={`Move ${contents ? 'contents spread' : item?.name}`} aria-describedby="issue-drag-help" aria-pressed={drag?.id === id || keyboard?.id === id} disabled={disabled} onPointerDown={e => pointerStart(e, id)} onKeyDown={e => keyMove(e, id)}><svg width="16" height="24" viewBox="0 0 16 24" aria-hidden="true">{[5, 12, 19].flatMap(y => [5, 11].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="currentColor" />))}</svg></button>
          <div className="issue-order-copy"><span className="issue-order-type">{contents ? 'Generated · 2-page contents' : `${index + 1} · ${item?.name}`}</span><strong dir="auto">{title}</strong><small>{contents ? 'Titles, subtitles & photographs update from your articles' : row ? `${row.pageCount} physical ${row.pageCount === 1 ? 'page' : 'pages'}` : 'Measuring pages…'}</small>
            {!contents && <label className="issue-toc-check"><input type="checkbox" checked={selected} disabled={disabled} onChange={() => onChange({ ...plan, contentsExcluded: selected ? [...plan.contentsExcluded, id] : plan.contentsExcluded.filter(excluded => excluded !== id) })} />List in contents</label>}
          </div>
          <div className="issue-order-end"><span className="issue-page-range" aria-label={`Pages ${pages}`}>{pages}</span><div><button type="button" aria-label={`Move ${contents ? 'contents spread' : item?.name} up`} disabled={disabled || index === 0} onClick={() => move(id, -1)}>↑</button><button type="button" aria-label={`Move ${contents ? 'contents spread' : item?.name} down`} disabled={disabled || index === plan.order.length - 1} onClick={() => move(id, 1)}>↓</button></div></div>
        </li>;
      })}
    </ol>
  </>;
}
