import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMark, clearActiveEditor, insertMath, setActiveEditor } from './activeEditor';

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn());
});

afterEach(() => {
  document.body.replaceChildren();
  // The disconnected-editor guard also releases the module's last reference.
  applyMark('b');
  vi.unstubAllGlobals();
});

function editor(text: string) {
  const el = document.createElement('textarea');
  el.value = text;
  document.body.append(el);
  el.setSelectionRange(0, text.length);
  const setValue = vi.fn();
  setActiveEditor({ el, setValue });
  return { el, setValue };
}

describe('formatting toolbar editor ownership', () => {
  it('formats the mounted editor selection', () => {
    const { setValue } = editor('Important news');
    applyMark('b');
    expect(setValue).toHaveBeenCalledWith('**Important news**');
  });

  it('cannot overwrite a story through a textarea detached by changing tabs', () => {
    const { el, setValue } = editor('Old copy');
    el.remove();
    applyMark('b');
    insertMath();
    expect(setValue).not.toHaveBeenCalled();
  });

  it('does not clear the new editor when a previous story unmounts', () => {
    const previous = editor('Previous');
    const current = editor('Current');
    clearActiveEditor(previous.el);
    applyMark('i');
    expect(previous.setValue).not.toHaveBeenCalled();
    expect(current.setValue).toHaveBeenCalledWith('*Current*');
  });

  it('stops formatting when the tracked editor explicitly unregisters', () => {
    const { el, setValue } = editor('Copy');
    clearActiveEditor(el);
    insertMath();
    expect(setValue).not.toHaveBeenCalled();
  });
});
