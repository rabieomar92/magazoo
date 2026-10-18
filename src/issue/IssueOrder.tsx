import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { CONTENTS_ID, issueDocumentLabel, issueHero, reorderIssue, type IssueAssignment, type IssueItem, type IssuePlan } from './model';
import { IssueBindingCheck } from './IssueBindingCheck';

export function IssueOrder({ plan, items, assignments, disabled, onChange, visual = false, onRemovePdf }: {
  plan: IssuePlan; items: IssueItem[]; assignments: IssueAssignment[]; disabled: boolean; onChange: (plan: IssuePlan) => void; visual?: boolean; onRemovePdf?: (id:string)=>void;
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
    // The canvas/inspector owns scrolling; the card list must not create a
    // second scroll pane. Keep edge-drag autoscroll on that outer viewport.
    const scrollHost = button.closest<HTMLElement>('.stage-scroll, .inspector') ?? list.current!;
    const original = button.closest('li')!;
    const bounds = original.getBoundingClientRect();
    const offsetX = event.clientX - bounds.left, offsetY = event.clientY - bounds.top;
    // Lift the complete card, keeping the exact point grabbed under the cursor.
    // A body-level overlay avoids clipping inside the scrolling seat map.
    const lifted = document.createElement('div');
    lifted.className = 'studio issue-drag-preview';
    lifted.setAttribute('aria-hidden', 'true');
    lifted.inert = true;
    lifted.style.width = `${bounds.width}px`;
    const shell = document.createElement('ol');
    shell.className = `issue-order${visual ? ' issue-order-visual' : ''}`;
    const copy = original.cloneNode(true) as HTMLElement;
    copy.removeAttribute('data-issue-order-id');
    copy.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
    copy.style.height = `${bounds.height}px`;
    shell.append(copy);lifted.append(shell);document.body.append(lifted);
    const position = (left:number,top:number) => { lifted.style.transform = `translate3d(${left}px, ${top}px, 0) rotate(.7deg) scale(1.025)`; };
    position(bounds.left,bounds.top);
    button.setPointerCapture(event.pointerId);
    const hostBounds = list.current!.getBoundingClientRect();
    const initialScroll = list.current!.scrollTop;
    const slots = [...list.current!.children].map(node=>({node:node as HTMLElement, rect:node.getBoundingClientRect()}));
    const previewOrder = (target:string) => {
      const order=reorderIssue(latest.current.order,id,target);
      const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      for(const slot of slots){
        const index=order.indexOf(slot.node.dataset.issueOrderId!);
        const destination=slots[index]?.rect;
        if(!destination)continue;
        slot.node.style.transition=reduced?'none':'transform 180ms cubic-bezier(.2,.8,.2,1)';
        slot.node.style.transform=`translate(${destination.left-slot.rect.left}px,${destination.top-slot.rect.top}px)`;
      }
    };
    let over = id, y = event.clientY, x = event.clientX, frame = 0;
    const hit = (x: number, nextY: number) => {
      y = nextY;
      const host=list.current;if(!host)return;
      const rect=host.getBoundingClientRect();
      const dx=rect.left-hostBounds.left,dy=rect.top-hostBounds.top-(host.scrollTop-initialScroll);
      // Hit-test stationary slots, not moving cards, to avoid hover oscillation.
      const slot=slots.find(({rect:r})=>x>=r.left+dx&&x<=r.right+dx&&y>=r.top+dy&&y<=r.bottom+dy);
      const target=slot?.node.dataset.issueOrderId;
      if(target&&target!==over){over=target;previewOrder(over);setDrag({id,over});}
    };
    const scroll = () => {
      position(x - offsetX, y - offsetY);
      const host = scrollHost;
      if (host) {
        const rect = host.getBoundingClientRect();
        if (y < rect.top + 55) host.scrollTop -= 11;
        else if (y > rect.bottom - 55) host.scrollTop += 11;
        const cursorY=y;
        hit(visual ? x : rect.left+rect.width/2,Math.min(rect.bottom-2,Math.max(rect.top+2,y)));
        y=cursorY;
      }
      frame = requestAnimationFrame(scroll);
    };
    const update = (e: globalThis.PointerEvent) => { x = e.clientX; hit(e.clientX, e.clientY); };
    const stop = (settle = false) => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', update);
      window.removeEventListener('pointerup', drop);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', escape);
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      setDrag(null);
      for(const {node} of slots){node.style.transition='';node.style.transform='';}
      if (!settle) lifted.remove();
    };
    const drop = () => {
      const positions = new Map([...(list.current?.children ?? [])].map(node=>[node,(node as HTMLElement).getBoundingClientRect()]));
      stop(true);
      if (over !== id) {
        const next = reorderIssue(latest.current.order, id, over);
        onChange({ ...latest.current, order: next });
        setAnnouncement(`Moved to position ${next.indexOf(id) + 1} of ${next.length}.`);
      }
      requestAnimationFrame(()=>{
        const destination = [...(list.current?.children ?? [])].find(node=>(node as HTMLElement).dataset.issueOrderId===id)?.getBoundingClientRect() ?? bounds;
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (reduced || !lifted.animate) { lifted.remove(); return; }
        for (const [node,before] of positions) {
          const after=node.getBoundingClientRect();
          if ((node as HTMLElement).dataset.issueOrderId!==id && node.animate && (before.left!==after.left || before.top!==after.top)) node.animate([{transform:`translate(${before.left-after.left}px,${before.top-after.top}px)`},{transform:'translate(0,0)'}],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)'});
        }
        const animation = lifted.animate([{transform:lifted.style.transform},{transform:`translate3d(${destination.left}px, ${destination.top}px, 0) rotate(0deg) scale(1)`}],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});
        animation.onfinish=()=>lifted.remove();animation.oncancel=()=>lifted.remove();
      });
    };
    const cancel = () => { stop(); setAnnouncement('Move cancelled.'); };
    const escape = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') cancel(); };
    cleanup.current = () => stop();
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
    {visual && <IssueBindingCheck items={items} assignments={assignments} ready={assignments.length === plan.order.length && plan.order.every(id => assignments.some(row => row.id === id))} settings={plan.printSettings} disabled={disabled} onChange={printSettings=>onChange({...plan,printSettings})} />}
    {visual && <div className="issue-map-direction">START · READ ACROSS, THEN DOWN ↓</div>}
    <p id={visual ? 'canvas-drag-help' : 'issue-drag-help'} className="issue-help">{visual ? 'Drag a picture onto another tile to insert it there. Each tile is one article; its pages stay together.' : 'Drag the grip to arrange. Each article’s pages stay together.'} Keyboard: Space, arrow keys, then Space to place.</p>
    <div className="issue-sr-only" aria-live="polite">{announcement}</div>
    <ol className={`issue-order${visual ? ' issue-order-visual' : ''}`} ref={list} aria-label={visual ? 'Canvas reading order' : 'Issue reading order'}>
      {plan.order.map((id, index) => {
        const item = byId.get(id), contents = id === CONTENTS_ID;
        const row = assignments.find(assignment => assignment.id === id);
        const title = contents ? plan.contentsTitle || 'Contents' : item?.doc.meta.title || item?.name || 'Untitled';
        const pages = row ? row.counted ? (row.pageCount === 1 ? `${row.startNumber}` : `${row.startNumber}–${row.startNumber + row.pageCount - 1}`) : 'Cover' : '…';
        const selected = !plan.contentsExcluded.includes(id);
        const thumbnail = item ? issueHero(item.doc) : undefined;
        const kind = contents ? 'Contents' : item?.externalPdf ? 'Imported PDF' : item ? issueDocumentLabel(item.doc) : 'Document';
        return <li key={id} data-issue-order-id={id} className={`${contents ? 'issue-order-contents' : ''}${drag?.id === id || keyboard?.id === id ? ' is-grabbed' : ''}${drag?.over === id && drag.id !== id ? ' is-drop-target' : ''}`}>
          <button type="button" className="issue-grip" aria-label={`Move ${contents ? 'contents spread' : item?.name}`} aria-describedby={visual ? 'canvas-drag-help' : 'issue-drag-help'} aria-pressed={drag?.id === id || keyboard?.id === id} disabled={disabled} onPointerDown={e => pointerStart(e, id)} onKeyDown={e => keyMove(e, id)}>{visual ? <><span className="issue-seat-number">{String(index + 1).padStart(2, '0')}</span><span className="issue-order-thumb">{thumbnail?.src ? <img src={thumbnail.src} alt="" draggable={false} loading="lazy" decoding="async" /> : <span>{kind}</span>}</span></> : <svg width="16" height="24" viewBox="0 0 16 24" aria-hidden="true">{[5, 12, 19].flatMap(y => [5, 11].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="currentColor" />))}</svg>}</button>
          <div className="issue-order-copy">{visual && <span className="issue-order-kind">{kind}</span>}<span className="issue-order-type">{contents ? 'Generated · 2-page contents' : `${index + 1} · ${item?.name}`}</span><strong dir="auto">{title}</strong><small>{contents ? 'Titles, subtitles & photographs update from your articles' : row ? `${row.pageCount} physical ${row.pageCount === 1 ? 'page' : 'pages'}` : 'Measuring pages…'}</small>
            {!contents && <label className="issue-toc-check"><input type="checkbox" checked={selected} disabled={disabled} onChange={() => onChange({ ...plan, contentsExcluded: selected ? [...plan.contentsExcluded, id] : plan.contentsExcluded.filter(excluded => excluded !== id) })} />List in contents</label>}
          </div>
          {item?.externalPdf && <div className="issue-pdf-card-actions"><a href={item.externalPdf.src} download={item.name}>Original PDF ↗</a>{onRemovePdf&&<button type="button" className="ghost" disabled={disabled} aria-label={`Remove ${item.name} from issue`} onClick={()=>onRemovePdf(id)}>Remove</button>}</div>}
          <div className="issue-order-end"><span className="issue-page-range" aria-label={`Pages ${pages}`}>{pages}</span><div><button type="button" aria-label={`Move ${contents ? 'contents spread' : item?.name} up`} disabled={disabled || index === 0} onClick={() => move(id, -1)}>↑</button><button type="button" aria-label={`Move ${contents ? 'contents spread' : item?.name} down`} disabled={disabled || index === plan.order.length - 1} onClick={() => move(id, 1)}>↓</button></div></div>
        </li>;
      })}
    </ol>
  </>;
}
