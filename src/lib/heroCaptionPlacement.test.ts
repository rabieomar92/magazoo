import {describe,expect,it} from 'vitest';
import {boundedHeroCaption,heroCaptionPageDimensions} from './heroCaptionPlacement';
import {presetFor} from '../store/presets';

describe('physical hero caption coordinates',()=>{
  it('uses the actual reference-article height rather than extending a caption below the sheet',()=>{
    const doc=presetFor('paper-4');
    expect(heroCaptionPageDimensions(doc).height).toBe(276);
    doc.design.pageFormat='magazine';expect(heroCaptionPageDimensions(doc).height).toBe(267);
    delete doc.design.pageFormat;doc.design.articlePageSize='a4';expect(heroCaptionPageDimensions(doc).height).toBe(297);
  });
  it.each([{width:210,height:297},{width:203,height:267},{width:176,height:250}])('keeps a caption inside a $width × $height page',page=>{
    expect(boundedHeroCaption({x:1000,y:1000,widthMm:45},page,12)).toEqual({x:page.width-45,y:page.height-12,widthMm:45});
    expect(boundedHeroCaption({x:-5,y:-5,widthMm:1000},page,500)).toEqual({x:0,y:0,widthMm:page.width});
  });
  it('bounds invalid imported geometry and rounds to hundredths of a millimetre',()=>{
    expect(boundedHeroCaption({x:NaN,y:Infinity,widthMm:NaN},{width:210,height:297})).toEqual({x:0,y:0,widthMm:40});
    expect(boundedHeroCaption({x:12.3456,y:23.4567,widthMm:0},{width:210,height:297})).toEqual({x:12.35,y:23.46,widthMm:5});
  });
});
