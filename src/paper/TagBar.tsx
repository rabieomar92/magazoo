import type { Doc } from '../schema/document';
import { barStartsRight } from '../lib/barSide';

/** The paper rule with a tag block. A direct-on-page bar can opt into horizontal
 *  full bleed; bars already living in a full-bleed hero/top region must not. */
export function TagBar({
  doc,
  pageIndex,
  fullBleed = false,
}: {
  doc: Doc;
  pageIndex: number;
  fullBleed?: boolean;
}) {
  const flip = barStartsRight(doc.design.barSide, pageIndex);
  const topBarText = doc.meta.masthead?.trim();
  return (
    <div
      className={`tag-bar${flip ? ' tag-bar--flip' : ''}`}
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
      {topBarText && <span className="tag-bar-tag">{topBarText}</span>}
      <span className="tag-bar-fill" />
    </div>
  );
}
