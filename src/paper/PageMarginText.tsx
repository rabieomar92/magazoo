import type { CSSProperties } from 'react';
import type { Doc } from '../schema/document';
import { fontStack } from '../lib/fonts';
import { marginTextSettings, pageMarginText } from '../lib/pageMarginText';
import { requestEditorTargetFocus } from '../lib/editorNavigation';

/** Out of flow, so credits never change column geometry or pagination.
 * Real text and inline physical units survive standalone/compiled exports. */
export function PageMarginText({ doc, index }: { doc: Doc; index: number }) {
  const text = pageMarginText(doc, index);
  if (!text) return null;
  const settings = marginTextSettings(doc);
  const style: CSSProperties = {
    position: 'absolute', zIndex: 21, margin: 0, padding: 0,
    left: settings.side === 'left' ? `${settings.edgeOffset}mm` : 'auto',
    right: settings.side === 'right' ? `${settings.edgeOffset}mm` : 'auto',
    top: 'auto', bottom: `${settings.bottomOffset}mm`,
    maxHeight: `calc(100% - ${settings.bottomOffset + 16}mm)`,
    writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    fontFamily: fontStack(settings.fontFamily), fontSize: `${settings.fontSize}pt`,
    fontWeight: 400, fontStyle: 'normal', lineHeight: 1.2, letterSpacing: '0.02em',
    textAlign: 'start', textTransform: 'none',
    color: settings.color ?? 'color-mix(in srgb, var(--paper-ink, #111) 65%, var(--paper-bg, #fff))',
  };
  return <div className="page-margin-text" style={style} dir="auto"
    data-editor-tab="design" data-editor-target={`page-margin-text-${index + 1}`}
    onClick={() => requestEditorTargetFocus('design', `page-margin-text-${index + 1}`)}
    title="Edit page margin text">{text}</div>;
}
