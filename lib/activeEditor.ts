import { wrapSelection, TOKEN, type Mark } from './richtext';

/**
 * The paragraph textarea the user is (or was last) editing. The Word-style
 * B/I/U bar lives above the preview pane — far from the textarea — so it needs a
 * handle on the active editor to format its selection. A module singleton keeps
 * this out of React state: the bar buttons use onMouseDown to avoid stealing
 * focus, so the textarea stays selected while the marker is applied.
 */
interface ActiveEditor {
  el: HTMLTextAreaElement;
  setValue: (v: string) => void;
}

let active: ActiveEditor | null = null;

export function setActiveEditor(e: ActiveEditor): void {
  active = e;
}

/** Drop the reference only if the unmounting textarea is the tracked one. */
export function clearActiveEditor(el: HTMLTextAreaElement): void {
  if (active?.el === el) active = null;
}

function currentEditor(): ActiveEditor | null {
  // A section or story can unmount while the formatting bar remains visible.
  // Never write its detached textarea's old value back into the live document.
  if (active && !active.el.isConnected) active = null;
  return active;
}

/** Apply a mark to the last mounted editor's selection. */
export function applyMark(mark: Mark): void {
  const editor = currentEditor();
  if (!editor) return;
  wrapSelection(editor.el, TOKEN[mark], editor.setValue);
}

/** Wrap the active editor's selection in `$…$` for inline LaTeX math. */
export function insertMath(): void {
  const editor = currentEditor();
  if (!editor) return;
  wrapSelection(editor.el, '$', editor.setValue);
}
