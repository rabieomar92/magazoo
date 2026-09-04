export const FOCUS_BLOCK_EDITOR_EVENT = 'magazoo:focus-block-editor';

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
