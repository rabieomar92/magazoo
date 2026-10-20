import {expect,it} from 'vitest';
import {canvasElementControls,canvasTextTarget} from './canvasElementControls';
import {presetFor,TEMPLATES} from '../store/presets';

it.each(['.fm-header','.fm-board-list-header','.news-header','.mag2-head-content'])('moves %s without altering typography',selector=>{
 const doc=presetFor('magazine-2'),header=document.createElement('header');header.className=selector.slice(1);
 const control=canvasElementControls(doc,header).find(c=>c.id==='headerSpacing')!;
 expect(control.axis).toBe('y');expect(control.paint).toBe('moveY');control.save(doc,12.5);
 expect(doc.design.headerOffsetMm).toBe(12.5);expect(doc.design.sizes.title).toBe(presetFor('magazine-2').design.sizes.title);
});

it.each(TEMPLATES.map(t=>t.id))('%s never offers typography drag handles',id=>{
 const doc=presetFor(id),element=document.createElement('p');element.className='subtitle';element.style.fontSize='16px';element.style.lineHeight='20px';
 const header=document.createElement('div');header.className='header';header.append(element);document.body.append(header);
 try{const target=canvasTextTarget(doc,element)!;expect(target.key).toBe('subtitle');
  const controls=canvasElementControls(doc,target.element,target.key);
  expect(controls.some(c=>c.id==='size'||c.id==='leading')).toBe(false);
 }finally{header.remove();}
});
it('targets an individual paragraph rather than changing the entire body',()=>{
 const doc=presetFor('paper-8'),block=doc.blocks.find(b=>b.type==='paragraph')!;
 const p=document.createElement('p');p.dataset.sourceBlockId=block.id;
 expect(canvasTextTarget(doc,p)?.key).toBe(`block:${block.id}`);
});
it('keeps the two gatefold text blocks independent',()=>{
 const doc=presetFor('magazine-3'),element=document.createElement('div');element.className='mag-gate-mid';element.dataset.editorTarget='gate-text-position';
 canvasElementControls(doc,element).find(c=>c.id==='gateWidth')!.save(doc,90);
 expect(doc.design.gateText?.width).toBe(90);expect(doc.design.gateTitle?.width).not.toBe(90);
});
it('previews gate changes on the entire block and preserves its measured position',()=>{
 const doc=presetFor('magazine-3');doc.design.pageFormat='vendor-b5';
 const page=document.createElement('div');page.className='page';
 const gate=document.createElement('div');gate.className='mag-gate-mid';gate.dataset.editorTarget='gate-text-position';
 const text=document.createElement('p');gate.append(text);page.append(gate);document.body.append(page);
 page.getBoundingClientRect=()=>({left:0,right:364,top:0,bottom:516,width:364,height:516} as DOMRect);
 gate.getBoundingClientRect=()=>({left:40,right:280,top:240,bottom:340,width:240,height:100} as DOMRect);
 try{
  const controls=canvasElementControls(doc,text),width=controls.find(c=>c.id==='gateWidth')!,inset=controls.find(c=>c.id==='gateInset')!;
  expect(width).toMatchObject({value:120,paint:'gateWidth',element:gate});
  expect(inset).toMatchObject({value:20,paint:'gateInset',max:54,element:gate});
  width.save(doc,110);expect(doc.design.gateText).toMatchObject({width:110,inset:20,top:120});
 }finally{page.remove();}
});
it('uses existing footer, bar, QR and logo geometry fields and limits',()=>{
 const doc=presetFor('backcover-1'),host=document.createElement('div');host.innerHTML='<div class="tag-bar"><span>Issue</span></div><footer class="page-folio"><span>Footer</span></footer><div data-editor-target="image-backcover-qr"></div><div data-editor-target="image-backcover-logo"></div>';
 canvasElementControls(doc,host.querySelector('.tag-bar span')!).find(c=>c.id==='bar')!.save(doc,12);
 canvasElementControls(doc,host.querySelector('.page-folio span')!).find(c=>c.id==='footer')!.save(doc,9);
 canvasElementControls(doc,host.querySelector('[data-editor-target="image-backcover-qr"]')!).find(c=>c.id==='qrSize')!.save(doc,30);
 const logo=canvasElementControls(doc,host.lastElementChild as HTMLElement);expect(logo.find(c=>c.id==='logoWidth')).toMatchObject({min:10,max:80});logo.find(c=>c.id==='logoHeight')!.save(doc,20);
 expect(doc.design.topBarOffset).toBe(12);expect(doc.footer?.bottomOffset).toBe(9);expect(doc.design.backCover).toMatchObject({qrSize:30,logoHeight:20});
});
