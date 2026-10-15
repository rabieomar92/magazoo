import type { Doc } from '../schema/document';
import { heroCaptionText } from '../lib/heroCaption';

/** A real text layer, independent of the crop and safe in the vector print clone. */
export function HeroCaption({ doc, cover = false, overlay = false, className = '' }: {
  doc: Doc; cover?: boolean; overlay?: boolean; className?: string;
}) {
  const text = heroCaptionText(doc, cover);
  if (!text.trim()) return null;
  return <p className={`hero-caption${overlay ? ' hero-caption--overlay' : ''}${className ? ` ${className}` : ''}`}
    data-editor-tab="images" data-editor-target={cover && doc.templateId !== 'frontmatter-board' ? 'meta-cover-caption' : 'meta-hero-caption'}>{text}</p>;
}
