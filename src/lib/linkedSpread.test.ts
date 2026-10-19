import {describe,it,expect} from 'vitest';
import {emptyDoc,migrate} from '../schema/document';
import {cloneDocForUpdate,useDoc} from '../store/useDoc';
import {linkSpreadPhotos,linkedSpreadPhoto,syncLinkedSpreads} from './linkedSpread';
import {placedImageGeometry} from './placedImage';
import {pageDimensions} from './pageFormat';

function fixture(bleed=5,rtl=false){
 const doc=emptyDoc();doc.design.pageFormat='jis-b5';doc.design.bleedCanvas=true;doc.design.bleedMm=bleed;doc.design.textDirection=rtl?'rtl':'ltr';
 doc.assets.a={src:'a',naturalWidth:1600,naturalHeight:900};doc.assets.b={src:'b',naturalWidth:800,naturalHeight:1200};
 doc.images=[{id:'left',assetId:'a',caption:'left caption',widthCols:2,heightMm:90,anchor:{page:1,column:2,y:100},frame:{scale:1.6,offsetX:13,offsetY:-9,panX:12,panY:-4}}, {id:'right',assetId:'b',caption:'right caption',widthCols:2,heightMm:70,anchor:{page:2,column:0,y:90}}];
 return doc;
}
describe('explicit linked facing-page photographs',()=>{
 for(const bleed of [0,3,5,10])for(const rtl of [false,true])it(`joins exactly at trim for ${bleed} mm bleed, ${rtl?'RTL':'LTR'}`,()=>{
  const doc=fixture(bleed,rtl);linkSpreadPhotos(doc,'left','right',doc.design,'pair');
  const [left,right]=rtl?[doc.images[1],doc.images[0]]:doc.images;
  const a=linkedSpreadPhoto(doc,left,doc.design)!,b=linkedSpreadPhoto(doc,right,doc.design)!;
  const box=placedImageGeometry(left,a.asset,doc.design),width=pageDimensions(doc.design).width;
  const leftSource=width-bleed-box.visualLeft-a.geometry.x;
  const rightSource=bleed-b.geometry.x;
  expect(leftSource).toBeCloseTo(rightSource,10);
  expect(a.geometry.w).toBe(b.geometry.w);expect(a.geometry.y).toBe(b.geometry.y);
  expect(doc.images.map(i=>i.caption)).toEqual(['left caption','right caption']);
 });
 it('uses the selected source even when linking from the later page',()=>{
  const doc=fixture();linkSpreadPhotos(doc,'right','left',doc.design,'pair');expect(doc.images.map(i=>i.assetId)).toEqual(['b','b']);expect(doc.images.map(i=>i.heightMm)).toEqual([70,70]);
 });
 it('shares framing and height edits from either side without mutating history',()=>{
  const original=fixture();linkSpreadPhotos(original,'left','right',original.design,'pair');
  const next=cloneDocForUpdate(original);next.images[1].frame={scale:2,offsetX:0,offsetY:0,panX:24};next.images[1].heightMm=110;next.images[1].anchor.y=80;
  syncLinkedSpreads(original,next);expect(next.images[0].frame).toEqual(next.images[1].frame);expect(next.images[0].anchor.y).toBe(80);expect(next.images[0].heightMm).toBe(110);expect(original.images[0].frame?.panX).toBe(12);
  expect(migrate(JSON.parse(JSON.stringify(next))).images[0].spreadLink).toBe('pair');
 });
 it('store commits a linked edit in one undoable update',()=>{
  const doc=fixture();linkSpreadPhotos(doc,'left','right',doc.design,'pair');useDoc.getState().load(doc);
  useDoc.getState().update(d=>{d.images[1].frame={scale:2,offsetX:0,offsetY:0,panX:40};});
  expect(useDoc.getState().doc.images[0].frame?.panX).toBe(40);useDoc.temporal.getState().undo();expect(useDoc.getState().doc.images[0].frame?.panX).toBe(12);
 });
 it('does not link non-adjacent pages and cleans orphaned links after removal',()=>{
  const doc=fixture();doc.images[1].anchor.page=3;linkSpreadPhotos(doc,'left','right',doc.design,'pair');expect(doc.images[0].spreadLink).toBeUndefined();
  doc.images[1].anchor.page=2;linkSpreadPhotos(doc,'left','right',doc.design,'pair');const next=cloneDocForUpdate(doc);next.images.pop();syncLinkedSpreads(doc,next);expect(next.images[0].spreadLink).toBeUndefined();
 });
});
