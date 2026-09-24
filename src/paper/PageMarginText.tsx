import type { CSSProperties } from 'react';
import type { Doc } from '../schema/document';
import { fontStack } from '../lib/fonts';
import { barStartsRight } from '../lib/barSide';
import { marginTextSettings, pageMarginText } from '../lib/pageMarginText';
import { requestEditorTargetFocus } from '../lib/editorNavigation';

/** Out of flow, so credits never change column geometry or pagination.
 * Real text and inline physical units survive standalone/compiled exports. */
export function PageMarginText({ doc, index }: { doc: Doc; index: number }) {
  const text = pageMarginText(doc, index);
  if (!text) return null;
  const settings = marginTextSettings(doc);
  // Use the same physical-page rule as TagBar, including issue-assigned starts.
  const right = barStartsRight(doc.design.barSide, index);
  const railStyle: CSSProperties = {
    position: 'absolute', zIndex: 21, margin: 0, padding: 0,
    left: right ? 'auto' : `${settings.edgeOffset}mm`,
    right: right ? `${settings.edgeOffset}mm` : 'auto',
    top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    alignItems: 'flex-start', pointerEvents: 'none',
  };
  const style: CSSProperties = {
    margin: 0, padding: 0, flex: '0 0 auto', maxHeight: '100%', pointerEvents: 'auto',
    // Rotate symbols such as © with the letters, rather than keeping them
    // upright before the whole credit is turned to read bottom-to-top.
    writingMode: 'vertical-rl', textOrientation: 'sideways', transform: 'rotate(180deg)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    fontFamily: fontStack(settings.fontFamily), fontSize: `${settings.fontSize}pt`,
    fontWeight: 400, fontStyle: 'normal', lineHeight: 1.2, letterSpacing: '0.02em',
    textAlign: 'start', textTransform: 'none',
    color: settings.color ?? 'color-mix(in srgb, var(--paper-ink, #111) 65%, var(--paper-bg, #fff))',
  };
  return <div className="page-margin-rail" style={railStyle}>
    <div className="page-margin-text" style={style} dir="auto"
      data-editor-tab="design" data-editor-target={`page-margin-text-${index + 1}`}
      onClick={() => requestEditorTargetFocus('design', `page-margin-text-${index + 1}`)}
      title="Edit page margin text">{text}</div>
    {/* Only the spacer shrinks at the top boundary, never the credit itself.
        CSS handles font changes and print without screen-space measurement. */}
    <div aria-hidden="true" className="page-margin-offset" style={{ height: `${settings.bottomOffset}mm`, flex: '0 1 auto', minHeight: 0 }} />
  </div>;
}
