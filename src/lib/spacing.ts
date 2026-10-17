import { defaultSubtitleGap, type Doc } from '../schema/document';

/** Signed margins can tighten or overlap adjacent copy. Padding, physical
 * dimensions and page-edge coordinates deliberately keep their own limits. */
export const SUBTITLE_GAP = { min: -40, max: 40 };
export const COVER_STORY_GAP = { min: -40, max: 120 };
export const TEXT_SPACE_AFTER = { min: -100, max: 100 };

export function clampSpacing(value: number | undefined, range: { min: number; max: number }, fallback = 0) {
  return Math.max(range.min, Math.min(range.max, Number.isFinite(value) ? value! : fallback));
}

/** Canvas dragging and the two spacing panels edit one effective gap. */
export function subtitleGapValue(doc: Doc) {
  const dragged=doc.templateId==='magazine-4'?doc.design.frontCover?.text?.subtitle?.spaceBefore:undefined;
  return dragged===undefined ? doc.design.subtitleGap??defaultSubtitleGap(doc.templateId) : Math.max(0,Math.min(40,dragged));
}

export function setSubtitleGap(doc: Doc,value: number) {
  doc.design.subtitleGap=clampSpacing(value,SUBTITLE_GAP,defaultSubtitleGap(doc.templateId));
  if(doc.templateId==='magazine-4'&&doc.design.frontCover?.text?.subtitle) delete doc.design.frontCover.text.subtitle.spaceBefore;
}
