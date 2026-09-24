import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { gatePlacement } from './gatePlacement';
import { presetFor } from '../store/presets';
import { cloneDocForUpdate } from '../store/useDoc';
import { migrate } from '../schema/document';
import { MagGateA } from '../paper/MagGate';

describe('Gatefold placement', () => {
  it('keeps even imported out-of-range boxes inside the sheet', () => {
    for (const inset of [-100, 8, 30, 152, 400]) {
      for (const width of [-30, 50, 100, 500]) {
        const box = gatePlacement({ inset, width, top: 500 }, 14);
        expect(box.inset).toBeGreaterThanOrEqual(8);
        expect(box.width).toBeGreaterThanOrEqual(50);
        expect(box.inset + box.width).toBeLessThanOrEqual(202);
        expect(box.top).toBe(260);
      }
    }
  });
  it('retains positions through save/import and isolates undo edits', () => {
    const doc = presetFor('magazine-3');
    doc.design.gateTitle = { top: 42, inset: 20, width: 130 };
    doc.design.gateText = { top: 70, inset: 30, width: 100, align: 'start' };
    const saved = migrate(JSON.parse(JSON.stringify(doc)));
    expect(saved.design.gateText).toEqual(doc.design.gateText);
    const clone = cloneDocForUpdate(saved);
    clone.design.gateTitle!.top = 90;
    clone.design.gateText!.inset = 50;
    expect(saved.design.gateTitle!.top).toBe(42);
    expect(saved.design.gateText!.inset).toBe(30);
  });
  it('keeps Arabic titles intact with natural wrapping by default', () => {
    const doc = presetFor('magazine-3');
    doc.design.textDirection = 'rtl';
    doc.meta.title = 'ألوان الضوء على سطح فقاعة الصابون';
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<MagGateA doc={doc} vars={{}} />);
    expect(host.querySelector('h1')?.textContent).toBe(doc.meta.title);
    expect(host.querySelector('.mag-gate-title--natural')).not.toBeNull();
    expect(host.querySelector('.mag-title-word')).toBeNull();
  });
});
