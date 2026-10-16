import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyDoc, migrate, type TemplateId } from '../../schema/document';
import { presetFor } from '../../store/presets';
import { useDoc } from '../../store/useDoc';
import { DesignSection } from './DesignSection';
import { HeroSection } from './HeroSection';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useDoc.getState().load(emptyDoc());
});

function mount(template: TemplateId = 'paper-8', design = false) {
  const doc = presetFor(template);
  act(() => {
    useDoc.getState().load(doc);
    root.render(design ? <DesignSection /> : <HeroSection />);
  });
  return doc;
}

function widthButtons() {
  return [...host.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Image width"] button')];
}

function setNumber(input: HTMLInputElement, value: number) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('Inset Research composition controls', () => {
  it('keeps the legacy three-column image selected until an author changes its width', () => {
    mount();
    expect(widthButtons().map(button => button.textContent)).toEqual(['1 column', '2 columns', '3 columns']);
    expect(widthButtons().map(button => button.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
    expect(useDoc.getState().doc.design.heroWidthCols).toBeUndefined();
  });

  it('saves each width independently of crop, height and copy, with undo, redo and JSON round-trip', () => {
    const original = mount();
    for (const width of [1, 2, 3] as const) {
      act(() => widthButtons()[width - 1].click());
      const saved = useDoc.getState().doc;
      expect(saved.design.heroWidthCols).toBe(width);
      expect(saved.hero).toEqual(original.hero);
      expect(saved.design.heroHeight).toBe(original.design.heroHeight);
      expect(saved.blocks).toEqual(original.blocks);
      expect(saved.meta).toEqual(original.meta);
      expect(migrate(JSON.parse(JSON.stringify(saved))).design.heroWidthCols).toBe(width);
      expect(widthButtons()[width - 1].getAttribute('aria-pressed')).toBe('true');
    }
    act(() => useDoc.temporal.getState().undo());
    expect(useDoc.getState().doc.design.heroWidthCols).toBe(2);
    act(() => useDoc.temporal.getState().redo());
    expect(useDoc.getState().doc.design.heroWidthCols).toBe(3);
  });

  it('fits the control to a narrower text grid without discarding the saved width preference', () => {
    mount();
    act(() => useDoc.getState().update(doc => {
      doc.design.heroWidthCols = 3;
      doc.design.bodyCols = 2;
    }));
    expect(widthButtons().map(button => button.textContent)).toEqual(['1 column', '2 columns']);
    expect(widthButtons()[1].getAttribute('aria-pressed')).toBe('true');
    expect(useDoc.getState().doc.design.heroWidthCols).toBe(3);
    act(() => useDoc.getState().update(doc => { doc.design.bodyCols = 4; }));
    expect(widthButtons()[2].getAttribute('aria-pressed')).toBe('true');
  });

  it.each(['paper-1', 'paper-2', 'paper-3', 'paper-4', 'paper-5', 'paper-6', 'paper-7', 'magazine-1', 'magazine-2'] as const)(
    '%s does not acquire an unrelated inset-width control', template => {
      mount(template);
      expect(widthButtons()).toHaveLength(0);
    },
  );

  it('shows the actual title position, moves it upward and restores the automatic position', () => {
    const original = mount('paper-8', true);
    const titleInput = () => [...host.querySelectorAll<HTMLInputElement>('input[type="number"]')]
      .find(input => input.closest('label')?.querySelector('.field-label')?.textContent?.startsWith('Top to title'))!;
    expect(titleInput().value).toBe('37');
    setNumber(titleInput(), 24);
    expect(useDoc.getState().doc.design.firstPageTopMargin).toBe(24);
    expect(titleInput().value).toBe('24');
    expect(useDoc.getState().doc.blocks).toEqual(original.blocks);
    expect(migrate(JSON.parse(JSON.stringify(useDoc.getState().doc))).design.firstPageTopMargin).toBe(24);
    const reset = [...host.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent === 'Reset title position')!;
    act(() => reset.click());
    expect(useDoc.getState().doc.design.firstPageTopMargin).toBeUndefined();
    expect(titleInput().value).toBe('37');
    act(() => useDoc.temporal.getState().undo());
    expect(titleInput().value).toBe('24');
    act(() => useDoc.temporal.getState().redo());
    expect(titleInput().value).toBe('37');
  });
});
