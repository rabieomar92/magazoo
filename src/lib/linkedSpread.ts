import type {Doc,PlacedImage,Design} from '../schema/document';
import {placedImageGeometry} from './placedImage';
import {pageDimensions} from './pageFormat';
import {framedSpreadPhoto} from './magSplit';
import {documentBleed} from './documentBleed';

export function linkedPair(doc:Doc,image:PlacedImage) {
  if(!image.spreadLink)return null;
  const pair=doc.images.filter(i=>i.spreadLink===image.spreadLink).sort((a,b)=>a.anchor.page-b.anchor.page);
  return pair.length===2&&pair[1].anchor.page===pair[0].anchor.page+1?pair:null;
}

/** Apply one shared author edit atomically, including edits made in the panel,
 * on canvas, and undo. Captions and individual wrapping contours stay local. */
export function syncLinkedSpreads(previous:Doc,next:Doc) {
  const handled=new Set<string>();
  for(const image of next.images){
    if(!image.spreadLink||handled.has(image.spreadLink))continue;
    handled.add(image.spreadLink);
    const pair=linkedPair(next,image);
    if(!pair){next.images.filter(i=>i.spreadLink===image.spreadLink).forEach(i=>delete i.spreadLink);continue;}
    const changed=pair.find(item=>{
      const old=previous.images.find(i=>i.id===item.id);
      return old&&(JSON.stringify(old.frame)!==JSON.stringify(item.frame)||old.assetId!==item.assetId||old.heightMm!==item.heightMm||old.anchor.y!==item.anchor.y||old.bleed?.top!==item.bleed?.top||old.bleed?.bottom!==item.bleed?.bottom);
    })??pair[0];
    for(const item of pair){
      item.assetId=changed.assetId;
      item.frame=changed.frame?{...changed.frame,crop:changed.frame.crop?structuredClone(changed.frame.crop):undefined}:undefined;
      item.heightMm=changed.heightMm;item.anchor.y=changed.anchor.y;
      const physicalLeft=(item===pair[0])!==(next.design.textDirection==='rtl');
      item.bleed={...item.bleed,[physicalLeft?'right':'left']:true,top:changed.bleed?.top,bottom:changed.bleed?.bottom};
    }
  }
}

/** Render both frames from one fit. At the finished trim, the two windows
 * sample exactly the same source coordinate, regardless of outer margins. */
export function linkedSpreadPhoto(doc:Doc,image:PlacedImage,design:Design,pageHeight?:number) {
  const pair=linkedPair(doc,image);if(!pair)return null;
  const [left,right]=doc.design.textDirection==='rtl'?[pair[1],pair[0]]:pair;
  const asset=doc.assets[left.assetId];if(!asset)return null;
  const a=placedImageGeometry(left,asset,design,pageHeight),b=placedImageGeometry(right,asset,design,pageHeight);
  const bleed=design.bleedCanvas?documentBleed(design.bleedMm):0;
  const width=a.visualWidth+b.visualWidth-2*bleed;
  const geometry=framedSpreadPhoto(asset.naturalWidth/asset.naturalHeight,width,a.visualHeight,left.frame);
  const windowOffset=image.id===right.id?a.visualWidth-2*bleed:0;
  return {asset,frame:left.frame,geometry:{...geometry,x:geometry.x-windowOffset},width,height:a.visualHeight,windowOffset};
}

export function linkSpreadPhotos(doc:Doc,sourceId:string,otherId:string,design:Design,link:string) {
  const source=doc.images.find(i=>i.id===sourceId),other=doc.images.find(i=>i.id===otherId);
  if(!source||!other||Math.abs(source.anchor.page-other.anchor.page)!==1||!doc.assets[source.assetId])return;
  // Dissolve previous pairs before creating this explicit, reversible link.
  const oldLinks=[source.spreadLink,other.spreadLink].filter(Boolean);
  doc.images.forEach(i=>{if(oldLinks.includes(i.spreadLink))delete i.spreadLink;});
  const g=placedImageGeometry(source,doc.assets[source.assetId],design,pageDimensions(design).height);
  source.spreadLink=other.spreadLink=link;
  source.heightMm=other.heightMm=g.height;
  other.anchor.y=source.anchor.y;
  other.assetId=source.assetId;
  other.frame=source.frame?structuredClone(source.frame):undefined;
  syncLinkedSpreads(doc,doc);
}
