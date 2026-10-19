/** @jsxImportSource ../lib/mathJsx */
import type { Doc } from '../schema/document';
import { barStartsRight } from '../lib/barSide';
import { topBarVisible } from '../lib/topBar';
import {documentBleed} from '../lib/documentBleed';

/** The paper rule with a tag block. A direct-on-page bar can opt into horizontal
 *  full bleed; bars already living in a full-bleed hero/top region must not. */
export function TagBar({
  doc,
  pageIndex,
  fullBleed = false,
  detail,
}: {
  doc: Doc;
  pageIndex: number;
  fullBleed?: boolean;
  /** Optional issue/date copy shown inside the rule on magazine bars. */
  detail?: string;
}) {
  const flip = barStartsRight(doc.design.barSide, pageIndex);
  const topBarText = doc.meta.masthead?.trim();
  // Every template exposes the same optional issue/date feature. An explicit
  // empty detail can still suppress it without changing the document metadata.
  const detailText = (detail ?? doc.meta.volume)?.trim();
  if (!topBarVisible(doc)) return null;
  return (
    <div
      className={`tag-bar${flip ? ' tag-bar--flip' : ''}${detailText ? ' tag-bar--detailed' : ''}`}
      data-editor-tab="design"
      data-editor-target="design-topbar"
      style={
        fullBleed
          ? {
              marginLeft: 'calc(-1 * var(--margin))',
              marginRight: 'calc(-1 * var(--margin))',
            }
          : undefined
      }
    >
      <span className="tag-bar-mark" style={doc.design.mastheadAlignMargin!==false
        ? {width:'var(--margin)',minWidth:`${doc.design.bleedCanvas?documentBleed(doc.design.bleedMm):0}mm`}
        : doc.design.bleedCanvas ? {width:`calc(var(--bar-h, 6mm) + ${documentBleed(doc.design.bleedMm)}mm)`} : undefined} />
      {/* Hugs its text: a longer tag simply lengthens the block and eats into
          the rule beside it. */}
      {topBarText && (
        <span className={`tag-bar-tag${/\p{Script=Arabic}/u.test(topBarText) ? ' arabic-copy' : ''}`} dir="auto" data-editor-tab="content" data-editor-target="meta-masthead">
          {topBarText}
        </span>
      )}
      <span className="tag-bar-fill">
        {detailText && (
          <span className={`tag-bar-detail${/\p{Script=Arabic}/u.test(detailText) ? ' arabic-copy' : ''}`} dir="auto" data-editor-tab="content" data-editor-target="meta-volume">
            {detailText}
          </span>
        )}
      </span>
    </div>
  );
}
