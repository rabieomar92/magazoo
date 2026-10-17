export const FOCUS_BLOCK_EDITOR_EVENT = 'magazoo:focus-block-editor';
export const FOCUS_EDITOR_TARGET_EVENT = 'magazoo:focus-editor-target';

export type EditorTab = 'content' | 'images' | 'highlights' | 'headers' | 'footers' | 'topbar' | 'sidetext' | 'design';

/** Existing canvas targets keep working after the settings reorganisation. */
export function editorTabForTarget(tab:EditorTab,target:string):EditorTab{
  if(/^footer-/.test(target))return 'footers';
  if(/^(meta-masthead|design-topbar|meta-volume)$/.test(target))return 'topbar';
  if(/margin-text|side-text/.test(target))return 'sidetext';
  if(/^meta-(hero|cover)-caption$/.test(target)||/^article-(image|caption)-|^image-/.test(target))return 'images';
  if(/^meta-|^gate-(title|text|positions)/.test(target))return 'headers';
  return tab;
}

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
