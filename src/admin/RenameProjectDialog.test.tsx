import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import RenameProjectDialog from './RenameProjectDialog';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const input = (value: string) => act(() => {
  const field = host.querySelector('input')!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
});
const submit = () => act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
it('prefills the project name, rejects blank/unchanged names, and trims a submitted name', async () => {
  const rename = vi.fn().mockResolvedValue(undefined);
  act(() => root.render(<RenameProjectDialog name="Physics" close={vi.fn()} rename={rename} />));
  expect(host.querySelector('input')!.value).toBe('Physics');
  expect(host.querySelector<HTMLButtonElement>('[type=submit]')!.disabled).toBe(true);
  input('   '); await submit(); expect(rename).not.toHaveBeenCalled();
  input('  Physics 2026  '); await submit(); expect(rename).toHaveBeenCalledWith('Physics 2026');
});
it('keeps the proposed name and presents server errors without closing the dialog', async () => {
  const close = vi.fn();
  const rename = vi.fn().mockRejectedValue(new Error('That name is already used. Choose a different name.'));
  act(() => root.render(<RenameProjectDialog name="Physics" close={close} rename={rename} />));
  input('Taken'); await submit();
  expect(host.querySelector('[role=alert]')?.textContent).toContain('already used');
  expect(host.querySelector('input')!.value).toBe('Taken');
  expect(close).not.toHaveBeenCalled();
  expect(host.querySelector<HTMLButtonElement>('[type=submit]')!.disabled).toBe(false);
});
