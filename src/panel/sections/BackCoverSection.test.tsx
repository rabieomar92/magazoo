import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { makeBackCover } from '../../store/backCover';
import { useDoc } from '../../store/useDoc';
import { BackCoverDesign } from './BackCoverSection';

const field = (host: HTMLElement, label: string, scope: ParentNode = host) =>
  [...scope.querySelectorAll('label')].find(element =>
    element.querySelector('.field-label')?.textContent?.replace(/\s*\([^)]*\)\s*$/, '').trim() === label,
  );

const editNumber = (input: HTMLInputElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

describe('BackCoverDesign', () => {
  it('writes grouped controls only into the nested back-cover design object', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    const initial = makeBackCover();
    const originalContent = structuredClone(initial.backCover);
    const { backCover: _nested, ...originalSharedDesign } = structuredClone(initial.design);
    act(() => {
      useDoc.getState().load(initial);
      root.render(<BackCoverDesign />);
    });

    const showQr = field(host, 'Show QR code')?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(showQr?.checked).toBe(true);
    act(() => showQr?.click());

    const width = field(host, 'Brand group width')?.querySelector<HTMLInputElement>('input[type="number"]');
    expect(width).toBeTruthy();
    editNumber(width!, '123');

    const brandStyle = [...host.querySelectorAll('details.back-cover-text-editor')].find(details =>
      details.querySelector('summary')?.textContent?.startsWith('Publication name'),
    );
    const brandSize = field(host, 'Size', brandStyle)?.querySelector<HTMLInputElement>('input[type="number"]');
    const brandVisible = field(host, 'Show object', brandStyle)?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(brandSize).toBeTruthy();
    expect(brandVisible?.checked).toBe(true);
    editNumber(brandSize!, '34.5');
    act(() => brandVisible?.click());

    const edited = useDoc.getState().doc;
    expect(edited.design.backCover).toMatchObject({
      showQr: false,
      brandWidth: 123,
      text: { brand: { fontSize: 34.5, visible: false } },
    });
    const { backCover: _editedNested, ...editedSharedDesign } = edited.design;
    expect(editedSharedDesign).toEqual(originalSharedDesign);
    expect(edited.backCover).toEqual(originalContent);

    act(() => root.unmount());
  });
});
