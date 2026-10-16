import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe,expect,it } from 'vitest';
import { MetaSection } from './MetaSection';
import { useDoc } from '../../store/useDoc';
import { presetFor, TEMPLATES } from '../../store/presets';

describe('MetaSection top-bar editor', () => {
  it('shows one dedicated top-bar text field for every template', () => {
    for (const template of TEMPLATES) {
      const host = document.createElement('div');
      const root = createRoot(host);
      const doc = template.make();
      act(() => {
        useDoc.setState({ doc });
        root.render(<MetaSection />);
      });
      const labels = [...host.querySelectorAll('.field-label')].filter(
        (label) => label.textContent === 'Top bar text',
      );
      expect(labels, template.id).toHaveLength(1);
      expect(labels[0].closest('label')?.querySelector('input')?.getAttribute('value')).toBe(doc.meta.masthead ?? '');
      act(() => root.unmount());
    }
  });
});

describe('shared article heading width control',()=>{
  it('edits only the optional width and restores the existing default',()=>{
    const prior=useDoc.getState().doc;
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
    try{
      act(()=>{useDoc.setState({doc:presetFor('paper-8')});root.render(<MetaSection/>);});
      const original=JSON.stringify(useDoc.getState().doc);
      const select=Array.from(host.querySelectorAll('label')).find(label=>label.textContent?.includes('Heading box width'))!.querySelector('select')!;
      expect(Array.from(select.options).map(o=>o.value)).toEqual(['template','1','2','3','4']);
      for(const width of ['1','2','3','4']){
        act(()=>{select.value=width;select.dispatchEvent(new Event('change',{bubbles:true}));});
        expect(useDoc.getState().doc.design.headerWidthCols).toBe(Number(width));
        const saved=structuredClone(useDoc.getState().doc);delete saved.design.headerWidthCols;
        expect(JSON.stringify(saved)).toBe(original);
      }
      act(()=>{select.value='template';select.dispatchEvent(new Event('change',{bubbles:true}));});
      expect(JSON.stringify(useDoc.getState().doc)).toBe(original);
    }finally{act(()=>root.unmount());host.remove();useDoc.setState({doc:prior});}
  });
});
