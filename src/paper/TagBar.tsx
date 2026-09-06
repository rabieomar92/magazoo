import type { Doc } from '../schema/document';
import { barStartsRight } from '../lib/barSide';

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
  const detailText = detail?.trim();
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
      <span className="tag-bar-mark" />
      {/* Hugs its text: a longer tag simply lengthens the block and eats into
          the rule beside it. */}
      {topBarText && (
        <span className="tag-bar-tag" data-editor-tab="content" data-editor-target="meta-masthead">
          {topBarText}
        </span>
      )}
      <span className="tag-bar-fill">
        {detailText && (
          <span className="tag-bar-detail" data-editor-tab="content" data-editor-target="meta-volume">
            {detailText}
          </span>
        )}
      </span>
    </div>
  );
}
