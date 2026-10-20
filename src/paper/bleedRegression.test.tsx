import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {TEMPLATES} from '../store/presets';
import {TagBar} from './TagBar';
import {spreadWindows} from '../lib/magSplit';
import {cropMarkSegments,PDF_PAGE_SIZES} from '../lib/pdfPageSize';
import {footerBottomOffset,footerCanvasBottomOffset,footerBottomMargin} from '../lib/pageFooter';

describe('all-template trim and top bar regressions',()=>{
 it('anchors the canvas mark SVG more specifically than shared page children',()=>{
  const css=readFileSync('src/styles/canvas-bleed.css','utf8');
  expect(css).toMatch(/\.page\s*>\s*\.canvas-trim-corners\s*\{position:absolute;inset:0/);
 });
 it('keeps full-page photo tools out of page flow',()=>{
  const pan=readFileSync('src/styles/canvas-image-pan.css','utf8');
  expect(pan).toContain('.page>.canvas-pan-surface{position:absolute;inset:0;z-index:25}');
  expect(pan).toContain('.page>.canvas-pan-trigger{position:absolute;z-index:10}');
  expect(pan).toContain('.page :has(>.canvas-pan-surface){z-index:30}');
  expect(readFileSync('src/styles/image-canvas.css','utf8')).toContain('.page>.canvas-crop-surface{position:absolute;');
  expect(readFileSync('src/styles/canvas-image-resize.css','utf8')).toContain('.page>.canvas-height-handle{position:absolute;');
 });
 it('keeps all eight ticks outside trim for every paper size',()=>{
  for(const size of Object.values(PDF_PAGE_SIZES))for(const bleed of [.1,3,5,10]){
   const segments=cropMarkSegments(size.width,size.height,bleed);expect(segments).toHaveLength(8);
   for(const [x1,y1,x2,y2] of segments){
    expect(x1).toBeGreaterThanOrEqual(0);expect(y1).toBeGreaterThanOrEqual(0);
    expect(x2).toBeLessThanOrEqual(size.width+2*bleed);expect(y2).toBeLessThanOrEqual(size.height+2*bleed);
    expect(Math.max(x1,x2)<bleed||Math.min(x1,x2)>size.width+bleed||Math.max(y1,y2)<bleed||Math.min(y1,y2)>size.height+bleed).toBe(true);
   }
  }
 });
 for(const template of TEMPLATES)it(`compensates either short-bar side for ${template.id}`,()=>{
  const doc=template.make();doc.design.showTopBar=true;doc.design.bleedCanvas=true;doc.design.bleedMm=5;
  for(const pageIndex of [0,1]){
   const host=document.createElement('div');host.innerHTML=renderToStaticMarkup(<TagBar doc={doc} pageIndex={pageIndex}/>);
   expect(host.querySelector<HTMLElement>('.tag-bar-mark')?.style.width).toBe('var(--margin)');
   expect(host.querySelector<HTMLElement>('.tag-bar-mark')?.style.minWidth).toBe('5mm');
  }
 });
 for(const template of TEMPLATES)it(`keeps footer clearance relative to trim for ${template.id}`,()=>{
  const doc=template.make();doc.footer={...doc.footer,enabled:true,bottomOffset:8};
  doc.design.bleedCanvas=true;doc.design.bleedMm=0;const base=footerBottomMargin(doc);
  doc.design.bleedMm=5;expect(footerBottomOffset(doc)).toBe(8);expect(footerCanvasBottomOffset(doc)).toBe(13);
  if(template.id!=='magazine-4'&&template.id!=='backcover-1')expect(footerBottomMargin(doc)).toBeCloseTo(base+5);
 });
 it('uses trim-width steps, with overlapping inner bleed, for automatic spreads',()=>{
  for(const size of Object.values(PDF_PAGE_SIZES))for(const bleed of [0,3,5,10]){
   const windows=spreadWindows(size.width+2*bleed,bleed);expect(windows.step).toBe(size.width);expect(windows.width).toBe(2*size.width+2*bleed);
  }
 });
});
