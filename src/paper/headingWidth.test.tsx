import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { presetFor } from '../store/presets';
import { cssVars } from '../lib/geometry';
import { articleHeaderWidthVars } from '../lib/articleHeaderWidth';
import { PaperTwoPage } from './PaperTwo';
import { Page1 } from './Page1';

describe('article heading span rendering',()=>{
  it.each([1,2,3,4] as const)('keeps the %s-column Physics Letter heading outside the photo/body regions',headerWidthCols=>{
    const doc=presetFor('paper-2');doc.design.headerWidthCols=headerWidthCols;
    const host=document.createElement('div');
    host.innerHTML=renderToStaticMarkup(<PaperTwoPage doc={doc} vars={{...cssVars(doc.design),...articleHeaderWidthVars(doc.design)}} left={[]} right={[]}/>);
    expect(host.querySelectorAll('.p2-head')).toHaveLength(1);
    expect(host.querySelector('.p2-shared-heading > .p2-head')).not.toBeNull();
    expect(host.querySelector('.p2-left .p2-head')).toBeNull();
    for(const field of ['meta-title','meta-subtitle','meta-author','meta-affiliation'])expect(host.querySelector(`.p2-shared-heading [data-editor-target="${field}"]`)).not.toBeNull();
  });
  it('retains the original split heading when the setting is absent',()=>{
    const doc=presetFor('paper-2');
    const host=document.createElement('div');host.innerHTML=renderToStaticMarkup(<PaperTwoPage doc={doc} vars={cssVars(doc.design)} left={[]} right={[]}/>);
    expect(host.querySelector('.p2-left .p2-head')).not.toBeNull();
    expect(host.querySelector('.p2-shared-heading')).toBeNull();
  });
  it.each(['paper-1','paper-3'] as const)('%s keeps the heading together above the measured body',id=>{
    const doc=presetFor(id);doc.design.headerWidthCols=2;
    const host=document.createElement('div');host.innerHTML=renderToStaticMarkup(<Page1 doc={doc} vars={{...cssVars(doc.design),...articleHeaderWidthVars(doc.design)}} pieces={[]}/>);
    for(const field of ['meta-title','meta-subtitle','meta-author','meta-affiliation'])expect(host.querySelector(`.header [data-editor-target="${field}"]`)).not.toBeNull();
    expect(host.querySelector<HTMLElement>('.page')!.style.getPropertyValue('--article-header-width')).toMatch(/mm$/);
  });
});
