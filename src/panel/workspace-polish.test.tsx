import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {describe,expect,it} from 'vitest';
import {Panel} from './Panel';
import {Section} from './Field';
import {useDoc} from '../store/useDoc';
import {presetFor} from '../store/presets';

describe('progressive editor controls',()=>{
  it('uses native keyboard-accessible disclosure while keeping controls mounted',()=>{
    const host=document.createElement('div'),root=createRoot(host);
    try{
      act(()=>root.render(<Section title="Secondary settings" collapsible defaultOpen={false}><input aria-label="Existing setting" defaultValue="unchanged"/></Section>));
      const details=host.querySelector('details')!;
      expect(details.open).toBe(false);
      expect(details.querySelector('summary h2')!.textContent).toBe('Secondary settings');
      expect(details.querySelector('input')!.value).toBe('unchanged');
      details.open=true;
      expect(details.querySelector('input')!.value).toBe('unchanged');
    }finally{act(()=>root.unmount());}
  });
  it('keeps metadata/page furniture compact and image tools grouped, without editing an article',()=>{
    const previous=useDoc.getState().doc;
    const host=document.createElement('div'),root=createRoot(host);
    try{
      const doc=presetFor('paper-8');doc.images=[{id:'ui-proof',assetId:doc.hero.assetId!,caption:'Exact caption',widthCols:2,anchor:{page:1,column:0,y:200}}];
      const json=JSON.stringify(doc);
      act(()=>{useDoc.setState({doc});root.render(<Panel/>);});
      expect(host.querySelector('#editor-panel')).not.toBeNull();
      expect(host.querySelector('.panel-scroll')!.getAttribute('tabindex')).toBe('0');
      const closed=Array.from(host.querySelectorAll<HTMLDetailsElement>('.section--disclosure')).filter(d=>!d.open).map(d=>d.querySelector('summary')!.textContent);
      expect(closed).toContain('Title & Author');expect(closed).toContain('Page footer');
      act(()=>host.querySelector<HTMLButtonElement>('[role="tab"].panel-tab:nth-child(2)')!.click());
      const summaries=Array.from(host.querySelectorAll('.control-disclosure > summary')).map(s=>s.textContent);
      for(const label of ['Crop & framing','Fine size adjustment','Position & caption','Text wrapping & outline','Bleed to page edges'])expect(summaries).toContain(label);
      expect(host.querySelector('.image-card-heading .row-buttons')).not.toBeNull();
      expect(JSON.stringify(useDoc.getState().doc)).toBe(json);
    }finally{act(()=>root.unmount());useDoc.setState({doc:previous});}
  });
});
