import type {Doc} from '../schema/document';
import {pageDimensions} from './pageFormat';
import {articlePageHeight,isReferenceArticle} from './articleLayouts';

export const HERO_CAPTION_LAYOUT_EVENT='magazoo:hero-caption-layout';
export interface HeroCaptionBox {x:number;y:number;widthMm:number}
export function heroCaptionPageDimensions(doc:Doc){
  const page=pageDimensions(doc.design);
  return isReferenceArticle(doc.templateId)?{...page,height:articlePageHeight(doc.design)}:page;
}

/** Save physical coordinates, not preview pixels; never stretch or scale copy. */
export function boundedHeroCaption(box:HeroCaptionBox,page:{width:number;height:number},height=0):HeroCaptionBox {
  const finite=(value:number,fallback:number)=>Number.isFinite(value)?value:fallback;
  const widthMm=Math.max(5,Math.min(page.width,finite(box.widthMm,40)));
  const round=(value:number)=>Math.round(value*100)/100;
  return {x:round(Math.max(0,Math.min(page.width-widthMm,finite(box.x,0)))),
    y:round(Math.max(0,Math.min(Math.max(0,page.height-Math.max(0,finite(height,0))),finite(box.y,0)))),widthMm:round(widthMm)};
}
