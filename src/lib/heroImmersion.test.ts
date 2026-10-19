import {expect,it} from 'vitest';
import {articleGeometry,articleRegions} from './articleLayouts';
import {presetFor} from '../store/presets';
import {migrate} from '../schema/document';
import {canvasElementControls} from './canvasElementControls';

it('moves the immersive heading and measured body into a top hero together',()=>{
 const doc=presetFor('paper-4'),base=articleGeometry('paper-4',doc.design,25);
 doc.design.heroImmersionMm=30;const next=articleGeometry('paper-4',doc.design,25);
 expect(next.titleTop).toBe(base.titleTop-30);expect(next.bodyTop).toBe(base.bodyTop-30);expect(next.col).toBe(base.col);
 expect(migrate(JSON.parse(JSON.stringify(doc))).design.heroImmersionMm).toBe(30);
});
it('lets bottom-hero body columns enter the picture without moving the title',()=>{
 const doc=presetFor('paper-4');doc.design.heroAtBottom=true;doc.design.pageFormat='jis-b5';
 const base=articleGeometry('paper-4',doc.design,20,8,14),before=articleRegions(base,1);
 doc.design.heroImmersionMm=30;const next=articleGeometry('paper-4',doc.design,20,8,14),after=articleRegions(next,1);
 expect(next.titleTop).toBe(base.titleTop);expect(next.image).toEqual(base.image);
 expect(after.filter(r=>r.page===0).reduce((sum,r)=>sum+r.height,0)).toBeGreaterThan(before.filter(r=>r.page===0).reduce((sum,r)=>sum+r.height,0));
 expect(after.filter(r=>r.page===1)).toEqual(before.filter(r=>r.page===1));
 expect(after.every(r=>r.y+r.height<=next.bottom)).toBe(true);
});
it.each([false,true])('bounds extreme depth and protects masthead, caption and footer (bottom=%s)',bottom=>{
 const doc=presetFor('paper-4');doc.design.heroAtBottom=bottom;doc.design.heroImmersionMm=1e6;
 const g=articleGeometry('paper-4',doc.design,20,12,15);
 expect(g.titleTop).toBeGreaterThanOrEqual(g.contentTop);
 if(bottom)expect(g.immersionDepth).toBeLessThanOrEqual(g.image.height-12-g.gutter-4);
 expect(articleRegions(g,0).every(r=>r.y+r.height<=g.bottom)).toBe(true);
});
it('does not alter other article templates or hidden-hero layouts',()=>{
 const doc=presetFor('paper-6'),before=articleGeometry('paper-6',doc.design,20);
 doc.design.heroImmersionMm=50;const next=articleGeometry('paper-6',doc.design,20);expect({...next,span:undefined}).toEqual({...before,span:undefined});
 doc.design.showHero=false;expect(articleGeometry('paper-4',doc.design,20).immersionDepth).toBe(0);
});
it.each([false,true])('exposes a saved directional immersion handle for the hero (bottom=%s)',bottom=>{
 const doc=presetFor('paper-4');doc.design.heroAtBottom=bottom;
 const element=document.createElement('figure');element.className='article-hero';
 const control=canvasElementControls(doc,element).find(c=>c.id==='immersion')!;
 expect(control.direction).toBe(bottom?1:-1);expect(control.max).toBeGreaterThan(20);control.save(doc,20);expect(doc.design.heroImmersionMm).toBe(20);
});
