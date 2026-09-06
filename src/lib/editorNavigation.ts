export const FOCUS_BLOCK_EDITOR_EVENT = 'magazoo:focus-block-editor';
export const FOCUS_EDITOR_TARGET_EVENT = 'magazoo:focus-editor-target';

export type EditorTab = 'content' | 'images' | 'highlights' | 'design';

export interface EditorTargetDetail {
  tab: EditorTab;
  target: string;
}

export function requestBlockEditorFocus(blockId: string) {
  window.dispatchEvent(
    new CustomEvent<{ blockId: string }>(FOCUS_BLOCK_EDITOR_EVENT, {
      detail: { blockId },
    }),
  );
}

export function blockEditorId(blockId: string) {
  return `block-editor-${blockId}`;
}

export function editorTargetId(target: string) {
  return `editor-target-${target}`;
}

/** Ask the left panel to reveal the setting represented by a preview object. */
export function requestEditorTargetFocus(tab: EditorTab, target: string) {
  window.dispatchEvent(
    new CustomEvent<EditorTargetDetail>(FOCUS_EDITOR_TARGET_EVENT, {
      detail: { tab, target },
    }),
  );
}
