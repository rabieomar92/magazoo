import {expect,it} from 'vitest';
import {customPageSize,paperSize,isPdfPageSize,fitPdfSheets} from './pdfPageSize';
import {readProjectSettings} from './projectSettings';
it('round trips custom physical dimensions in project backups',()=>{
 const size=customPageSize(190.5,260.25);
 expect(size).toBe('custom:190.5x260.25');expect(paperSize(size)).toEqual({label:'Custom',width:190.5,height:260.25});
 expect(readProjectSettings(JSON.parse(JSON.stringify({paperSize:size,bleedMm:5})))).toEqual({paperSize:size,bleedMm:5});
});
it.each(['custom:0x260','custom:481x260','custom:NaNx260','custom:190.123x260','custom:190xInfinity','custom:190x-260','bogus'])('rejects invalid custom size %s',size=>expect(isPdfPageSize(size)).toBe(false));
it.each([false,true])('exports custom trim with optional bleed and eight corner marks (%s)',print=>{
 const doc=document.implementation.createHTMLDocument();doc.body.innerHTML='<div class="pdf-export-page" data-page-width-mm="200.5" data-page-height-mm="270.25" data-canvas-bleed-mm="5"><p>Original text</p></div>';
 fitPdfSheets(doc,'custom:190.5x260.25',print?5:0,print);
 expect(doc.head.textContent).toContain(`size: ${print?200.5:190.5}mm ${print?270.25:260.25}mm`);
 expect(doc.querySelectorAll('.pdf-crop-marks line')).toHaveLength(print?8:0);
 expect(doc.querySelector<HTMLElement>('.pdf-export-page')!.style.getPropertyValue('--pdf-fit-scale')).toBe('1');
 expect(doc.querySelector('p')!.textContent).toBe('Original text');
});
it.each([false,true])('gives contents and imported PDF pages the same export contract (%s)',print=>{
 const doc=document.implementation.createHTMLDocument();
 doc.body.innerHTML=['issue-contents-page','issue-external-pdf-page'].map(cls=>`<div class="pdf-export-page ${cls}" data-page-width-mm="192" data-page-height-mm="267" data-canvas-bleed-mm="5"><img src="artwork.png" style="object-fit:contain" /></div>`).join('');
 fitPdfSheets(doc,'jis-b5',print?5:0,print);
 expect(doc.querySelectorAll('.pdf-export-sheet')).toHaveLength(2);
 expect(doc.querySelectorAll('.pdf-crop-marks line')).toHaveLength(print?16:0);
 for(const page of doc.querySelectorAll<HTMLElement>('.pdf-export-page')){
  expect(page.style.getPropertyValue('--pdf-fit-left')).toBe(print?'0mm':'-5mm');
  expect(page.style.getPropertyValue('--pdf-fit-scale')).toBe('1');
  expect(page.querySelector('img')!.style.objectFit).toBe('contain');
 }
});
