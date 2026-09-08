import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { LabeledNumber } from './Field';

function mountNumber(min: number, initial = 10) {
  const onValue = vi.fn();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  function Example() {
    const [value, setValue] = useState(initial);
    return <><LabeledNumber label="Quantity" value={value} min={min} max={40} onChange={n => { onValue(n); setValue(n); }} />
      <button onClick={() => setValue(initial)}>Restore saved value</button></>;
  }
  act(() => root.render(<Example />));
  const input = host.querySelector('input')!;
  return {
    input, onValue,
    edit(text: string) { act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }); },
    blur() { act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))); },
    restore() { act(() => host.querySelector('button')!.click()); },
    unmount() { act(() => root.unmount()); host.remove(); },
  };
}

describe('numeric editing', () => {
  it('accepts negative decimals without resetting an unfinished minus to zero', () => {
    const field = mountNumber(-40);
    field.edit(''); // A number input reports empty while just a minus is typed.
    expect(field.input.value).toBe('');
    expect(field.onValue).not.toHaveBeenCalled();
    field.edit('-2.5');
    expect(field.onValue).toHaveBeenLastCalledWith(-2.5);
    field.blur();
    expect(field.input.value).toBe('-2.5');
    field.unmount();
  });
  it('does not publish negative sizes and enforces their lower bound on blur', () => {
    const field = mountNumber(5);
    field.edit('-7');
    expect(field.onValue).not.toHaveBeenCalled();
    field.blur();
    expect(field.onValue).toHaveBeenLastCalledWith(5);
    expect(field.input.value).toBe('5');
    field.unmount();
  });
  it('bounds signed values, restores abandoned blanks and follows external changes', () => {
    const field = mountNumber(-40);
    field.edit('-90'); field.blur();
    expect(field.input.value).toBe('-40');
    field.edit(''); field.blur();
    expect(field.input.value).toBe('-40');
    field.edit('-8.5'); field.restore();
    expect(field.input.value).toBe('10');
    field.edit('99'); field.blur();
    expect(field.input.value).toBe('40');
    field.unmount();
  });
});
