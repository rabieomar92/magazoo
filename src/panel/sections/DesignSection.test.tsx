import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { presetFor } from '../../store/presets';
import { useDoc } from '../../store/useDoc';
import { DesignSection } from './DesignSection';

describe('DesignSection font choices', () => {
  it.each(['paper-4','paper-5','paper-6','paper-7','paper-8'] as const)('%s hero caption alignment updates saved typography as well as the native setting',template=>{
    const host=document.createElement('div'),root=createRoot(host);
    const doc=presetFor(template);doc.design.textStyles={heroCaption:{align:'left',fontSize:8}};
    act(()=>{useDoc.getState().load(doc);root.render(<DesignSection/>);});
    const control=host.querySelector('[aria-label="Caption alignment"]')!;
    act(()=>([...control.querySelectorAll('button')].find(b=>b.textContent==='Center') as HTMLButtonElement).click());
    expect(useDoc.getState().doc.design.articleCaptionAlign).toBe('center');
    expect(useDoc.getState().doc.design.textStyles?.heroCaption).toEqual({align:'center',fontSize:8});
    act(()=>root.unmount());
  });
  const allowedFonts = ['Helvetica', 'Playfair Display', 'Bebas Neue', 'Arial', 'Avenir Next LT Pro Light', 'Avenir Next LT Pro', 'TeX Gyre Schola', 'TeX Gyre Pagella'];
  it('offers all eight fonts in every standard font selector', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() => {
      useDoc.setState({ doc: presetFor('paper-1') });
      root.render(<DesignSection />);
    });

    const selects = [...host.querySelectorAll('select')].filter((select) =>
      ['Display', 'Body', 'Category', 'Subtitle', 'Author', 'Affiliation'].includes(
        select.closest('label')?.querySelector('.field-label')?.textContent ?? '',
      ),
    );
    expect(selects).toHaveLength(6);
    for (const select of selects) {
      expect([...select.options].map((option) => option.value)).toEqual(allowedFonts);
    }
    expect(host.textContent).not.toContain('Title to subtitle gap');
    expect(host.textContent).toContain('Subtitle / lede');
    expect(host.textContent).toContain('Author bold');
    expect(host.textContent).toContain('Affiliation italic');

    act(() => root.unmount());
  });

  it('replaces generic typography with an editable selector for every cover text object', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() => {
      useDoc.setState({ doc: presetFor('magazine-4') });
      root.render(<DesignSection />);
    });

    expect(host.textContent).toContain('Front cover layout');
    expect(host.textContent).not.toContain('Title to subtitle gap');
    expect(host.textContent).toContain('Cover object styles');
    const fontSelects = [...host.querySelectorAll('select')].filter(
      (select) => select.closest('label')?.querySelector('.field-label')?.textContent === 'Font',
    );
    expect(fontSelects).toHaveLength(11);
    for (const select of fontSelects) {
      expect([...select.options].map((option) => option.value)).toEqual(allowedFonts);
    }

    act(() => root.unmount());
  });

  it.each(['paper-4','paper-5','paper-6','paper-7','paper-8'] as const)('%s exposes every shared callout placement and image-theme control', template=> {
    const host=document.createElement('div');const root=createRoot(host);
    act(()=>{useDoc.setState({doc:presetFor(template)});root.render(<DesignSection/>);});
    const selector=[...host.querySelectorAll('select')].find(s=>s.closest('label')?.textContent?.startsWith('Highlights position'))!;
    expect([...selector.options].map(o=>o.value)).toEqual(['page1','page1-flow','all','below','free']);
    act(()=>{selector.value='free';selector.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(useDoc.getState().doc.design.highlightsPlacement).toBe('free');
    expect(host.textContent).toContain('Match colours to hero image');
    expect(host.textContent).toContain('Photograph rises from the foot of the page');
    expect(host.textContent).toContain('First-page background graphic');
    act(()=>root.unmount());
  });

  it.each(['paper-3','paper-4','paper-5','paper-6','paper-7','paper-8'] as const)('%s offers optional bottom trim bleed only with bottom hero placement', template => {
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() => { useDoc.setState({ doc: presetFor(template) }); root.render(<DesignSection />); });
    const checkbox = (label: string) => [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
      .find(input => input.closest('label')?.textContent?.includes(label));
    expect(checkbox('Bleed hero image to bottom edge')).toBeUndefined();
    act(() => checkbox('Photograph rises from the foot of the page')!.click());
    const bleed = checkbox('Bleed hero image to bottom edge')!;
    expect(bleed).toBeDefined();
    expect(bleed.checked).toBe(false);
    act(() => bleed.click());
    expect(useDoc.getState().doc.design.heroBottomBleed).toBe(true);
    act(() => checkbox('Photograph rises from the foot of the page')!.click());
    expect(checkbox('Bleed hero image to bottom edge')).toBeUndefined();
    expect(useDoc.getState().doc.design.heroBottomBleed).toBe(true);
    act(() => root.unmount());
  });
});
