import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {describe,it,expect} from 'vitest';
import {HeaderLayoutSection} from './HeaderLayoutSection';
import {useDoc} from '../../store/useDoc';
import {presetFor} from '../../store/presets';
import {defaultSubtitleGap} from '../../schema/document';
import {subtitleGapValue,setSubtitleGap} from '../../lib/spacing';
import {renderToStaticMarkup} from 'react-dom/server';
import {MagazineFrontCover} from '../../paper/MagazineFrontCover';
import {cssVars} from '../../lib/geometry';

describe('heading gap control',()=>{
  it('reads the dragged cover subtitle gap, replaces it on edit, and resets both sources',()=>{
    const doc=presetFor('magazine-4');doc.design.frontCover={...doc.design.frontCover,text:{subtitle:{spaceBefore:19,inset:3}}};
    const host=document.createElement('div'),root=createRoot(host);
    act(()=>{useDoc.getState().load(doc);root.render(<HeaderLayoutSection/>);});
    const input=host.querySelector<HTMLInputElement>('input')!;
    expect(input.value).toBe('19');
    act(()=>{
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'7');
      input.dispatchEvent(new Event('input',{bubbles:true}));
    });
    const edited=useDoc.getState().doc;
    expect(subtitleGapValue(edited)).toBe(7);
    expect(edited.design.frontCover?.text?.subtitle).toEqual({inset:3});
    const preview=document.createElement('div');preview.innerHTML=renderToStaticMarkup(<MagazineFrontCover doc={edited} vars={cssVars(edited.design)}/>);
    expect(preview.querySelector<HTMLElement>('.front-cover-lede')!.style.marginBlockStart).toBe('');
    expect(cssVars(edited.design)['--subtitle-gap']).toBe('7mm');
    act(()=>host.querySelector('button')!.click());
    expect(subtitleGapValue(useDoc.getState().doc)).toBe(defaultSubtitleGap('magazine-4'));
    act(()=>root.unmount());
  });
  it.each(['paper-1','paper-2','paper-3','paper-4','paper-5','paper-6','paper-7','paper-8','magazine-1','magazine-2','magazine-3','magazine-4','frontmatter-contents','frontmatter-board'] as const)('preserves signed gap edits through saving %s',id=>{
    const doc=presetFor(id);setSubtitleGap(doc,-2.5);
    expect(subtitleGapValue(JSON.parse(JSON.stringify(doc)))).toBe(-2.5);
    expect(cssVars(doc.design,id)['--subtitle-gap']).toBe('-2.5mm');
  });
});
