import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { CONTENTS_ID, type IssueAssignment, type IssueItem, type IssuePlan } from './model';

interface Props {
  plan: IssuePlan;
  items: readonly IssueItem[];
  assignments: readonly IssueAssignment[];
  disabled: boolean;
  onOrder: (order: string[]) => void;
  onContents: (id: string, included: boolean) => void;
}

/** A pointer handle works with mouse, touch and pen. Keyboard pickup and
 * explicit move buttons offer the same operation without drag precision. */
export function IssueOrderList({ plan, items, assignments, disabled, onOrder, onContents }: Props) {
  const list = useRef<HTMLOListElement>(null);
  const order = useRef(plan.order);
  order.current = plan.order;
  const callback = useRef(onOrder);
  callback.current = onOrder;
  const [active, setActive] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const gesture = useRef<{ id: string; original: string[]; pointer: boolean; y: number } | null>(null);
  const frame = useRef(0);
  const itemsById = new Map(items.map(item => [item.id, item]));
  const pagesById = new Map(assignments.map(item => [item.id, item]));
  const label = (id: string) => id === CONTENTS_ID ? 'Contents spread' : itemsById.get(id)?.name ?? 'Document';
  const moveTo = (id: string, index: number) => {
    const before = order.current;
    const from = before.indexOf(id);
    const nextIndex = Math.max(0, Math.min(before.length - 1, index));
    if (from < 0 || from === nextIndex) return;
    const next = before.filter(value => value !== id);
    next.splice(nextIndex, 0, id);
    order.current = next;
    callback.current(next);
    setAnnouncement(`${label(id)} moved to position ${nextIndex + 1} of ${next.length}.`);
  };
  const finish = (cancel = false) => {
    const current = gesture.current;
    if (cancel && current) { order.current = current.original; callback.current(current.original); }
    if (current) setAnnouncement(`${label(current.id)} ${cancel ? 'move cancelled' : 'placed'}.`);
    gesture.current = null;
    setActive(null);
    cancelAnimationFrame(frame.current);
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const followPointer = () => {
    const drag = gesture.current;
    const container = list.current?.closest<HTMLElement>('.issue-sequence-scroll');
    if (!drag?.pointer || !container || !list.current) return;
    const bounds = container.getBoundingClientRect();
    const distance = drag.y < bounds.top + 55 ? -Math.min(18, (bounds.top + 55 - drag.y) / 3)
      : drag.y > bounds.bottom - 55 ? Math.min(18, (drag.y - bounds.bottom + 55) / 3) : 0;
    if (distance) container.scrollTop += distance;
    const rows = Array.from(list.current.children) as HTMLElement[];
    const nearest = rows.reduce<{ index: number; distance: number }>((best, row, index) => {
      const box = row.getBoundingClientRect();
      const distance = Math.abs(drag.y - (box.top + box.bottom) / 2);
      return distance < best.distance ? { index, distance } : best;
    }, { index: 0, distance: Infinity });
    moveTo(drag.id, nearest.index);
    frame.current = requestAnimationFrame(followPointer);
  };
  const startPointer = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { id, original: [...order.current], pointer: true, y: event.clientY };
    setActive(id);
    setAnnouncement(`Moving ${label(id)}.`);
    frame.current = requestAnimationFrame(followPointer);
  };
  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (disabled) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (active === id) finish();
      else { gesture.current = { id, original: [...order.current], pointer: false, y: 0 }; setActive(id); setAnnouncement(`Picked up ${label(id)}. Use arrow keys, then Space to place.`); }
    } else if (event.key === 'Escape' && active) { event.preventDefault(); finish(true); }
    else if (active === id && ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const from = order.current.indexOf(id);
      moveTo(id, event.key === 'Home' ? 0 : event.key === 'End' ? order.current.length - 1 : from + (event.key === 'ArrowUp' ? -1 : 1));
    }
  };
  return <>
    <p className="issue-reorder-hint" id="issue-drag-help">Drag the grip to arrange. With a keyboard, press Space, use ↑ or ↓, then Space to place. Escape cancels.</p>
    <div className="issue-sr-only" aria-live="polite">{announcement}</div>
    <ol className="issue-order-list" ref={list} aria-label="Issue reading order">
      {plan.order.map((id, index) => {
        const item = itemsById.get(id);
        const assignment = pagesById.get(id);
        const contents = id === CONTENTS_ID;
        const count = contents ? 2 : assignment?.pageCount;
        const range = assignment ? !assignment.counted ? 'Unnumbered cover' : assignment.pageCount === 1 ? `p. ${assignment.startNumber}` : `pp. ${assignment.startNumber}–${assignment.startNumber + assignment.pageCount - 1}` : 'Measuring…';
        return <li key={id} data-issue-id={id} className={`${contents ? 'issue-order-contents' : ''}${active === id ? ' is-dragging' : ''}`}>
          <button type="button" className="issue-drag-handle" aria-label={`Move ${label(id)}`} aria-describedby="issue-drag-help" aria-pressed={active === id} disabled={disabled}
            onPointerDown={event => startPointer(event, id)}
            onPointerMove={event => { if (gesture.current?.pointer) gesture.current.y = event.clientY; }}
            onPointerUp={() => { if (gesture.current?.pointer) finish(); }}
            onPointerCancel={() => finish(true)} onLostPointerCapture={() => { if (gesture.current?.pointer) finish(); }}
            onKeyDown={event => keyboard(event, id)} onBlur={() => { if (active === id && !gesture.current?.pointer) finish(); }}>
            <svg width="16" height="22" viewBox="0 0 16 22" aria-hidden="true">{[5, 11, 17].flatMap(y => [5, 11].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="currentColor" />))}</svg>
          </button>
          <div className="issue-order-copy"><div className="issue-order-meta"><span>{String(index + 1).padStart(2, '0')}</span><b>{range}</b></div>
            <strong>{contents ? plan.contentsTitle || 'Contents' : item?.doc.meta.title || item?.name}</strong>
            <small>{contents ? 'Generated from your articles · 2 pages' : `${item?.name} · ${count ? `${count} ${count === 1 ? 'page' : 'pages'}` : 'Preparing'}`}</small>
            {!contents && <label className="issue-checkbox"><input type="checkbox" checked={!plan.contentsExcluded.includes(id)} disabled={disabled} onChange={event => onContents(id, event.target.checked)} />List in contents</label>}
          </div>
          <div className="issue-order-moves"><button type="button" aria-label={`Move ${label(id)} up`} disabled={disabled || index === 0 || !!active} onClick={() => moveTo(id, index - 1)}>↑</button><button type="button" aria-label={`Move ${label(id)} down`} disabled={disabled || index === plan.order.length - 1 || !!active} onClick={() => moveTo(id, index + 1)}>↓</button></div>
        </li>;
      })}
    </ol>
  </>;
}
