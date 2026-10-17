import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {describe,it,expect} from 'vitest';
import {HeaderLayoutSection} from './HeaderLayoutSection';
import {useDoc} from '../../store/useDoc';
import {presetFor,TEMPLATE_META} from '../../store/presets';
describe('heading spacing removal',()=>{
  it.each(TEMPLATE_META.map(t=>[t.id]))('does not expose the removed subtitle-gap control in %s',id=>{
    const host=document.createElement('div'),root=createRoot(host),doc=presetFor(id),before=JSON.stringify(doc);
    act(()=>{useDoc.getState().load(doc);root.render(<HeaderLayoutSection/>);});
    expect(host.textContent).not.toContain('Title to subtitle gap');
    expect(JSON.stringify(useDoc.getState().doc)).toBe(before);
    act(()=>root.unmount());
  });
});
