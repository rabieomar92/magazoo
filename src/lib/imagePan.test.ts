import {describe,expect,it} from 'vitest';
import {framedImageGeometry,normalizeImageFrame} from './imageFrame';
import {galleryFrameGeometry} from './galleryFrame';
import {framedSpreadPhoto,gatePageBg} from './magSplit';
import {emptyDoc,migrate} from '../schema/document';
import {wrappedHeroImage} from './wrappedHero';

describe('free image pan without moving the crop frame',()=>{
  it('preserves every existing crop when optional pan is absent',()=>{
    expect(normalizeImageFrame()).toEqual({scale:1,offsetX:0,offsetY:0});
    expect(framedImageGeometry(200,100,100,60,{scale:1,offsetX:0,offsetY:0})).toEqual({width:120,height:60,left:-10,top:0});
  });
  it('moves in frame percentages beyond all four image edges, without resizing or distortion',()=>{
    for(const fit of ['cover','contain'] as const)for(const source of [[300,800],[800,300],[500,500]])for(const scale of [.5,1,3])for(const pan of [-200,-50,0,50,200]){
      const frame={scale,offsetX:23,offsetY:-17},base=framedImageGeometry(source[0],source[1],120,80,frame,fit);
      const moved=framedImageGeometry(source[0],source[1],120,80,{...frame,panX:pan,panY:-pan},fit);
      expect(moved.width).toBe(base.width);expect(moved.height).toBe(base.height);
      expect(moved.left-base.left).toBeCloseTo(120*pan/100);expect(moved.top-base.top).toBeCloseTo(-80*pan/100);
    }
  });
  it('permits completely uncovering a frame and sanitises invalid imports',()=>{
    const out=framedImageGeometry(100,100,100,100,{panX:150,panY:-150});
    expect(out.left).toBe(150);expect(out.top+out.height).toBe(-50);
    expect(normalizeImageFrame({panX:Infinity,panY:-9000})).toEqual({scale:1,offsetX:0,offsetY:0,panX:0,panY:-1000});
  });
  it('uses one logical pan across both gallery fold windows',()=>{
    const base=galleryFrameGeometry({scale:1,offsetX:0,offsetY:0},2);
    const moved=galleryFrameGeometry({scale:1,offsetX:0,offsetY:0,panX:30,panY:-40},2);
    expect(moved.left-base.left).toBe(60);expect(moved.top-base.top).toBe(-40);
    expect((moved.left-100)+100).toBe(moved.left);
  });
  it.each([{width:210,height:297},{width:176,height:250},{width:203,height:267}])('keeps gatefold seams and physical coordinates on $width mm sheets',page=>{
    const base=framedSpreadPhoto(1.6,page.width*2,page.height);
    const moved=framedSpreadPhoto(1.6,page.width*2,page.height,{panX:-25,panY:75});
    expect(moved.x-base.x).toBeCloseTo(-page.width*.5);expect(moved.y-base.y).toBeCloseTo(page.height*.75);
    expect(parseFloat(gatePageBg(moved,0,page.width).backgroundPosition)-parseFloat(gatePageBg(moved,1,page.width).backgroundPosition)).toBeCloseTo(page.width);
  });
  it('retains optional pan through JSON import and hero-to-page-image conversion',()=>{
    const doc=emptyDoc();doc.hero={assetId:'image',scale:1.5,offsetX:2,offsetY:-4,panX:45,panY:-12};
    doc.assets.image={src:'data:image/png;base64,test',naturalWidth:800,naturalHeight:600};
    const loaded=migrate(JSON.parse(JSON.stringify(doc)));
    expect(loaded.hero).toEqual(doc.hero);expect(wrappedHeroImage(loaded,'placed')?.frame).toEqual(normalizeImageFrame(doc.hero));
  });
});
