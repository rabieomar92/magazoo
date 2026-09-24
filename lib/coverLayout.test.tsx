import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {presetFor} from '../store/presets';
import {cloneDocForUpdate} from '../store/useDoc';
import {pageFooter,footerBottomMargin} from './pageFooter';
import {TagBar} from '../paper/TagBar';
import {MagazineFrontCover} from '../paper/MagazineFrontCover';
describe('cover and Arabic safeguards',()=>{
  it('does not add an article top bar or page number to the front cover',()=>{
    const doc=presetFor('magazine-4');doc.footer={enabled:true,startNumber:99};
    expect(pageFooter(doc,0).enabled).toBe(false);expect(footerBottomMargin(doc)).toBe(doc.design.margin);
    expect(renderToStaticMarkup(<TagBar doc={doc} pageIndex={0}/>)).toBe('');
  });
  it('identifies Arabic masthead text independently of reading direction',()=>{
    const doc=presetFor('paper-1');doc.meta.masthead='KUANTA';doc.design.textDirection='rtl';
    expect(renderToStaticMarkup(<TagBar doc={doc} pageIndex={0}/>)).not.toContain('arabic-copy');
    doc.meta.masthead='مجلة الفيزياء';doc.design.textDirection='ltr';
    expect(renderToStaticMarkup(<TagBar doc={doc} pageIndex={0}/>)).toContain('arabic-copy');
  });
  it('preserves cover hierarchy while applying independent flow spacing and mirrored insets',()=>{
    const doc=presetFor('magazine-4');doc.design.frontCover={text:{title:{spaceBefore:12,inset:5},subtitle:{spaceBefore:3}}};
    const host=document.createElement('div');host.innerHTML=renderToStaticMarkup(<MagazineFrontCover doc={doc} vars={{}}/>);
    expect(host.querySelector('h1')!.style.marginBlockStart).toBe('12mm');expect(host.querySelector('h1')!.style.marginInlineStart).toBe('5mm');
    expect(host.querySelector('.front-cover-lede')!.previousElementSibling?.tagName).toBe('H1');
    const clone=cloneDocForUpdate(doc);clone.design.frontCover!.text!.title!.inset=30;expect(doc.design.frontCover.text!.title!.inset).toBe(5);
  });
});
