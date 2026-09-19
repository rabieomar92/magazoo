import type { CSSProperties, ReactNode } from 'react';
import type { Doc, FrontCoverTextRole } from '../schema/document';
import { useDoc } from '../store/useDoc';
import { useVerticalDrag } from './useVerticalDrag';
import { defaultFrontCoverTextStyle } from '../lib/frontCoverDesign';

const coverObjectGap = (n: number) => Math.max(0, Math.min(40, Number.isFinite(n) ? n : 0));

/** Margins participate in normal flow: moving a heading also makes room for
 * its subtitle. Objects never trade places or become detached absolute boxes. */
export function CoverTextObject({ doc, role, as: Element = 'div', className = '', target, children }: {
  doc: Doc; role: FrontCoverTextRole; as?: 'div' | 'span' | 'p' | 'h1';
  className?: string; target: string; children: ReactNode;
}) {
  const style = defaultFrontCoverTextStyle(doc.design,role);
  const update = useDoc(s => s.update);
  const drag = useVerticalDrag({
    start: element => parseFloat(getComputedStyle(element).marginTop) * 25.4 / 96 || 0,
    clamp: coverObjectGap,
    commit: spaceBefore => update(d => {
      d.design.frontCover = { ...d.design.frontCover, text: { ...d.design.frontCover?.text,
        [role]: { ...d.design.frontCover?.text?.[role], spaceBefore } } };
    }),
  });
  const textStyle: CSSProperties = {
    marginBlockStart: style?.spaceBefore === undefined ? undefined : `${coverObjectGap(style.spaceBefore)}mm`,
    marginInlineStart: style?.inset === undefined ? undefined : `${coverObjectGap(style.inset)}mm`,
    maxWidth: style?.inset ? `calc(100% - ${coverObjectGap(style.inset)}mm)` : undefined,
    lineHeight: style?.lineHeight === undefined ? undefined : Math.max(doc.design.textDirection === 'rtl' ? 1.2 : .8, Math.min(2.5, style.lineHeight)),
  };
  const arabic = typeof children === 'string' && /\p{Script=Arabic}/u.test(children);
  return <Element className={`${className} cover-text-object${arabic ? ' arabic-copy' : ''}${drag.dragging ? ' is-dragging' : ''}`}
    data-editor-tab="design" data-editor-target={`front-cover-style-${role}`} data-copy-target={target}
    style={textStyle} {...drag.handlers} title="Drag vertically to adjust this object's space above; reading order stays fixed">
    {children}
  </Element>;
}
