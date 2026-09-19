import { useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent } from 'react';
import { PAGE_W } from '../lib/geometry';

/** How far the pointer travels before a press becomes a drag. Below this a
 *  press is still a click, so tapping a cover block keeps opening its
 *  settings. */
const DRAG_START_PX = 4;

interface VerticalDragOptions {
  /** The millimetre value the block is positioned by, read as the drag starts.
   *  A block that is still centred automatically reports where it currently
   *  sits, so grabbing it takes over from that exact position. */
  start: (element: HTMLElement, pxPerMm: number) => number;
  clamp: (value: number) => number;
  /** The element is handed back so a first placement can also record the box
   *  the copy is already using, instead of re-flowing it. */
  commit: (value: number, element: HTMLElement) => void;
}

/** Where a drag lands: the value it began from plus the pointer's travel,
 *  converted from screen pixels to page millimetres and settled to 0.1mm so a
 *  stored position stays legible in the panel's number fields. */
export function draggedValue(
  startValue: number,
  travelPx: number,
  pxPerMm: number,
  clamp: (value: number) => number,
) {
  if (!(pxPerMm > 0)) return Math.round(clamp(startValue) * 10) / 10;
  return Math.round(clamp(startValue + travelPx / pxPerMm) * 10) / 10;
}

interface DragState {
  pointerId: number;
  startY: number;
  startValue: number;
  pxPerMm: number;
  dragging: boolean;
  value: number;
}

/**
 * Drag a cover block up and down. Sideways movement is deliberately not
 * offered — the side inset and the block width stay numeric controls, so a
 * cover keeps its vertical rhythm instead of drifting off its column. The move
 * is painted with a transform while the pointer is down and the document is
 * written once on release, so a drag is a single undo step.
 */
export function useVerticalDrag({ start, clamp, commit }: VerticalDragOptions) {
  const state = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);

  const paint = (element: HTMLElement, millimetres: number) => {
    const from = state.current?.startValue ?? millimetres;
    element.style.transform = `translateY(${(millimetres - from).toFixed(2)}mm)`;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const element = event.currentTarget;
    const page = element.closest<HTMLElement>('.page');
    const pxPerMm = page ? page.getBoundingClientRect().width / PAGE_W : 0;
    if (!pxPerMm) return;
    event.stopPropagation();
    state.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startValue: start(element, pxPerMm),
      pxPerMm,
      dragging: false,
      value: 0,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const current = state.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const travel = event.clientY - current.startY;
    if (!current.dragging) {
      if (Math.abs(travel) < DRAG_START_PX) return;
      current.dragging = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    current.value = draggedValue(current.startValue, travel, current.pxPerMm, clamp);
    paint(event.currentTarget, current.value);
  };

  const finish = (event: ReactPointerEvent<HTMLElement>) => {
    const current = state.current;
    if (!current || current.pointerId !== event.pointerId) return;
    state.current = null;
    if (!current.dragging) return;
    // The block is about to be re-rendered from its stored position; drop the
    // temporary paint so the two cannot both apply.
    event.currentTarget.style.transform = '';
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDragging(false);
    suppressClick.current = true;
    event.currentTarget.dataset.dragMoved = 'true';
    const element = event.currentTarget;
    setTimeout(() => { delete element.dataset.dragMoved; }, 200);
    commit(current.value, event.currentTarget);
  };

  /** A drag ends in a click. Swallow that one click so releasing the pointer
   *  does not also re-open a panel section. */
  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return {
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => {
        state.current = null;
        event.currentTarget.style.transform = '';
        setDragging(false);
      },
      onClickCapture,
    },
  };
}
