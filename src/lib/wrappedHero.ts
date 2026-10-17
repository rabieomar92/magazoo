import type { Doc, PlacedImage } from '../schema/document';
import { grid } from './geometry';
import { articleGridDesign, articlePageHeight, isReferenceArticle } from './articleLayouts';
import { pageDimensions } from './pageFormat';
import { heroCaptionText } from './heroCaption';
import { normalizeImageFrame } from './imageFrame';

/** Reuse the existing asset/crop; changing image placement never rewrites or
 * recompresses the source photograph, caption or authored body copy. */
export function wrappedHeroImage(doc: Doc, id: string): PlacedImage | null {
  if (!doc.hero.assetId || !doc.assets[doc.hero.assetId] || doc.design.showHero === false) return null;
  const design = isReferenceArticle(doc.templateId) ? articleGridDesign(doc.design) : doc.design;
  const pageHeight = isReferenceArticle(doc.templateId) ? articlePageHeight(design) : pageDimensions(design).height;
  const y = Math.min(120, pageHeight/2);
  return { id,assetId:doc.hero.assetId,caption:heroCaptionText(doc),
    widthCols:Math.min(2,grid(design).totalCols) as PlacedImage['widthCols'],
    heightMm:Math.min(Math.max(20,design.heroHeight),pageHeight-y-design.margin),
    anchor:{page:1,column:0,y},frame:normalizeImageFrame(doc.hero),
    wrapShape:'polygon',wrapPolygon:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],align:'left' };
}
