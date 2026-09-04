import {
  Fragment,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useDoc } from '../../store/useDoc';
import { familyOf, uid, type Block } from '../../schema/document';
import { LabeledColor, LabeledNumber, RowButtons, Section, SegmentField } from '../Field';
import { TOKEN, wrapSelection, type Mark } from '../../lib/richtext';
import { setActiveEditor } from '../../lib/activeEditor';
import { normalizeInlineContinuations, removeArticleBlock } from '../../lib/inlineFigure';
import { blockEditorId } from '../../lib/editorNavigation';

const KEY_TO_MARK: Record<string, Mark> = { b: 'b', i: 'i', u: 'u' };
type DropTarget = { index: number; edge: 'before' | 'after' };
type EditorResize = {
  blockId: string;
  pointerId: number;
  startY: number;
  startHeight: number;
  minHeight: number;
  maxHeight: number;
  textarea: HTMLTextAreaElement;
};

export function BodySection() {
  const blocks = useDoc((state) => state.doc.blocks);
  const update = useDoc((state) => state.update);
  const isGallery = useDoc((state) => familyOf(state.doc.templateId) === 'gallery');
  const isFrontCover = useDoc((state) => state.doc.templateId === 'magazine-4');
  const isCardContent = isGallery || isFrontCover;
  const templateBodySize = useDoc((state) => state.doc.design.sizes.body);
  const templateInk = useDoc((state) => state.doc.design.colors.ink);
  const templateBodyAlign = useDoc((state) => state.doc.design.bodyAlign ?? 'left');
  const dragFrom = useRef<number | null>(null);
  const pendingParagraphFocus = useRef<string | null>(null);
  const editorHeights = useRef(new Map<string, number>());
  const editorResize = useRef<EditorResize | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const resizeBounds = (textarea: HTMLTextAreaElement) => {
    const style = getComputedStyle(textarea);
    const minHeight = Number.parseFloat(style.minHeight) || 46;
    const parsedMax = Number.parseFloat(style.maxHeight);
    const maxHeight = Number.isFinite(parsedMax)
      ? Math.max(minHeight, parsedMax)
      : Math.max(minHeight, window.innerHeight * 0.8);
    return { minHeight, maxHeight };
  };

  const applyEditorHeight = (blockId: string, textarea: HTMLTextAreaElement, height: number) => {
    const { minHeight, maxHeight } = resizeBounds(textarea);
    const nextHeight = Math.min(maxHeight, Math.max(minHeight, height));
    textarea.style.height = `${nextHeight}px`;
    editorHeights.current.set(blockId, nextHeight);
  };

  const beginEditorResize = (blockId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const textarea = event.currentTarget.parentElement?.querySelector<HTMLTextAreaElement>('textarea');
    if (!textarea) return;
    event.preventDefault();
    event.stopPropagation();
    const { minHeight, maxHeight } = resizeBounds(textarea);
    editorResize.current = {
      blockId,
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: textarea.getBoundingClientRect().height,
      minHeight,
      maxHeight,
      textarea,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    textarea.focus({ preventScroll: true });
  };

  const moveEditorResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = editorResize.current;
    if (!state || state.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const nextHeight = Math.min(
      state.maxHeight,
      Math.max(state.minHeight, state.startHeight + event.clientY - state.startY),
    );
    state.textarea.style.height = `${nextHeight}px`;
    editorHeights.current.set(state.blockId, nextHeight);
  };

  const finishEditorResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (editorResize.current?.pointerId !== event.pointerId) return;
    editorResize.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const resizeEditorWithKeyboard = (
    blockId: string,
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const textarea = event.currentTarget.parentElement?.querySelector<HTMLTextAreaElement>('textarea');
    if (!textarea) return;
    event.preventDefault();
    const step = event.shiftKey ? 32 : 12;
    applyEditorHeight(
      blockId,
      textarea,
      textarea.getBoundingClientRect().height + (event.key === 'ArrowDown' ? step : -step),
    );
  };

  const setText = (index: number, text: string) =>
    update((doc) => {
      const block = doc.blocks[index];
      if (block.type === 'paragraph') block.text = text;
    });

  const setIndent = (index: number, indent: boolean | undefined) =>
    update((doc) => {
      const block = doc.blocks[index];
      if (block.type === 'paragraph') block.indent = indent;
    });

  const setParagraphAlign = (
    index: number,
    align: 'left' | 'center' | 'right' | 'justify',
  ) =>
    update((doc) => {
      const block = doc.blocks[index];
      if (block.type === 'paragraph') block.align = align;
    });

  const setParagraphStyle = (
    index: number,
    patch: { fontSize?: number; color?: string },
    reset = false,
  ) =>
    update((doc) => {
      const block = doc.blocks[index];
      if (block.type !== 'paragraph') return;
      if (reset) {
        delete block.fontSize;
        delete block.color;
        return;
      }
      if (patch.fontSize !== undefined) block.fontSize = Math.min(72, Math.max(5, patch.fontSize));
      if (patch.color !== undefined) block.color = patch.color;
    });

  const setTex = (index: number, tex: string) =>
    update((doc) => {
      const block = doc.blocks[index];
      if (block.type === 'equation') block.tex = tex;
    });

  const setEquationCaption = (index: number, caption: string) =>
    update((doc) => {
      const block = doc.blocks[index];
      if (block.type === 'equation') block.caption = caption;
    });

  const setEquationAlign = (index: number, align: 'left' | 'center' | 'right') =>
    update((doc) => {
      const block = doc.blocks[index];
      if (block.type === 'equation') block.align = align;
    });

  const remove = (index: number) => update((doc) => { removeArticleBlock(doc, index); });

  const insertParagraph = (index: number) => {
    const id = uid();
    pendingParagraphFocus.current = id;
    update((doc) => {
      doc.blocks.splice(index, 0, { id, type: 'paragraph', text: '' });
      normalizeInlineContinuations(doc.blocks);
    });
  };

  const swap = (from: number, to: number) =>
    update((doc) => {
      if (to < 0 || to >= doc.blocks.length) return;
      [doc.blocks[from], doc.blocks[to]] = [doc.blocks[to], doc.blocks[from]];
      normalizeInlineContinuations(doc.blocks);
    });

  const move = (from: number, target: DropTarget) =>
    update((doc) => {
      if (target.index < 0 || target.index >= doc.blocks.length) return;
      let insertionIndex = target.index + (target.edge === 'after' ? 1 : 0);
      if (from < insertionIndex) insertionIndex -= 1;
      if (insertionIndex === from) return;
      const [block] = doc.blocks.splice(from, 1);
      doc.blocks.splice(insertionIndex, 0, block);
      normalizeInlineContinuations(doc.blocks);
    });

  const paragraphNeighbour = (index: number, direction: -1 | 1) => {
    for (let next = index + direction; next >= 0 && next < blocks.length; next += direction) {
      if (blocks[next].type === 'paragraph') return next;
    }
    return -1;
  };

  // Gallery's fixed slot images remain a template implementation detail. All
  // ordinary page images are stored separately and edited in the Images tab.
  const view = blocks
    .map((block, index) => ({ block, index }))
    .filter(
      (entry): entry is { block: Exclude<Block, { type: 'figure' }>; index: number } =>
        entry.block.type !== 'figure',
    );

  return (
    <Section title={isGallery ? 'Text cards' : isFrontCover ? 'Cover teasers' : 'Content'}>
      <details className="formatting-help">
        <summary>Formatting shortcuts</summary>
        <p>
          <code>**bold**</code> · <code>*italic*</code> · <code>__underline__</code> · math
          with <code>$E = mc^2$</code>.
          {isFrontCover ? (
            <> The first line is the teaser title; the remaining lines are its description.</>
          ) : !isGallery ? (
            <> Pictures are managed in <strong>Images</strong>.</>
          ) : null}
        </p>
      </details>

      {view.map(({ block, index }, viewIndex) => (
        <Fragment key={block.id}>
        <div
          className={`list-item list-item--stack block-card${dragging === index ? ' is-dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (dragFrom.current === null) return;
            event.dataTransfer.dropEffect = 'move';
            const bounds = event.currentTarget.getBoundingClientRect();
            const edge = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
            if (dropTarget?.index !== index || dropTarget.edge !== edge) {
              setDropTarget({ index, edge });
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (dragFrom.current !== null && dropTarget) move(dragFrom.current, dropTarget);
            dragFrom.current = null;
            setDragging(null);
            setDropTarget(null);
          }}
        >
          {dropTarget?.index === index && (
            <span
              className={`block-drop-marker block-drop-marker--${dropTarget.edge}`}
              aria-hidden="true"
            >
              <span>Move here</span>
            </span>
          )}
          <div className="block-card-head">
            <span
              className="drag-handle block-drag-handle"
              title="Drag to reorder — the insertion line shows where it will land"
              draggable
              aria-label={`Reorder ${isFrontCover ? 'cover teaser' : block.type === 'paragraph' ? 'paragraph' : 'equation'} ${viewIndex + 1}`}
              onDragStart={(event) => {
                dragFrom.current = index;
                setDragging(index);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', block.id);
              }}
              onDragEnd={() => {
                dragFrom.current = null;
                setDragging(null);
                setDropTarget(null);
              }}
            >
              <span className="block-drag-icon" aria-hidden="true">⠿</span>
              <span>{block.type === 'paragraph' ? `${isFrontCover ? 'Teaser' : 'Paragraph'} ${viewIndex + 1}` : `Equation ${viewIndex + 1}`}</span>
            </span>
            <RowButtons
              onUp={() => swap(index, isGallery ? paragraphNeighbour(index, -1) : index - 1)}
              onDown={() => swap(index, isGallery ? paragraphNeighbour(index, 1) : index + 1)}
              onRemove={() => remove(index)}
              disableUp={isGallery ? paragraphNeighbour(index, -1) === -1 : index === 0}
              disableDown={isGallery ? paragraphNeighbour(index, 1) === -1 : index === blocks.length - 1}
            />
          </div>

          {block.type === 'paragraph' ? (
            <div className="figure-edit">
              <div className="textarea-resize-shell">
                <textarea
                  ref={(element) => {
                    if (!element) return;
                    const savedHeight = editorHeights.current.get(block.id);
                    if (savedHeight !== undefined) element.style.height = `${savedHeight}px`;
                    if (pendingParagraphFocus.current !== block.id) return;
                    pendingParagraphFocus.current = null;
                    requestAnimationFrame(() => {
                      if (!element.isConnected) return;
                      element.focus();
                      element.setSelectionRange(0, 0);
                    });
                  }}
                  className="field-input field-textarea field-textarea--grow"
                  id={blockEditorId(block.id)}
                  data-block-editor-id={block.id}
                  dir="auto"
                  value={block.text}
                  rows={4}
                  placeholder={isFrontCover ? 'TEASER TITLE\nShort cover line…' : 'Write a paragraph…'}
                  onFocus={(event) =>
                    setActiveEditor({
                      el: event.currentTarget,
                      setValue: (value) => setText(index, value),
                    })
                  }
                  onKeyDown={(event) => {
                    if (!(event.metaKey || event.ctrlKey)) return;
                    const mark = KEY_TO_MARK[event.key.toLowerCase()];
                    if (!mark) return;
                    event.preventDefault();
                    wrapSelection(event.currentTarget, TOKEN[mark], (value) => setText(index, value));
                  }}
                  onChange={(event) => setText(index, event.target.value)}
                />
                <button
                  type="button"
                  className="textarea-resize-grip"
                  aria-label="Resize paragraph editor vertically"
                  title="Drag up or down to resize · Arrow keys also work"
                  onPointerDown={(event) => beginEditorResize(block.id, event)}
                  onPointerMove={moveEditorResize}
                  onPointerUp={finishEditorResize}
                  onPointerCancel={finishEditorResize}
                  onKeyDown={(event) => resizeEditorWithKeyboard(block.id, event)}
                >
                  <span aria-hidden="true">↕</span>
                </button>
              </div>
              {!isFrontCover && <div className="paragraph-indent">
                <SegmentField<'default' | 'on' | 'off'>
                  label="Indent"
                  value={block.indent === true ? 'on' : block.indent === false ? 'off' : 'default'}
                  options={[
                    { value: 'default', label: 'Default' },
                    { value: 'on', label: 'Indent' },
                    { value: 'off', label: 'Flush' },
                  ]}
                  onChange={(value) =>
                    setIndent(index, value === 'on' ? true : value === 'off' ? false : undefined)
                  }
                />
              </div>}
              {isCardContent && (
                <div className="paragraph-alignment">
                  <SegmentField<'left' | 'center' | 'right' | 'justify'>
                    label="Alignment"
                    value={block.align ?? templateBodyAlign}
                    options={[
                      { value: 'left', label: 'Left' },
                      { value: 'center', label: 'Center' },
                      { value: 'right', label: 'Right' },
                      { value: 'justify', label: 'Justify' },
                    ]}
                    onChange={(value) => setParagraphAlign(index, value)}
                  />
                </div>
              )}
              <div className="paragraph-style-grid">
                <LabeledNumber
                  label="Size"
                  unit="pt"
                  value={block.fontSize ?? templateBodySize}
                  min={5}
                  max={72}
                  step={0.5}
                  onChange={(fontSize) => setParagraphStyle(index, { fontSize })}
                />
                <LabeledColor
                  label="Color"
                  value={block.color ?? templateInk}
                  onChange={(color) => setParagraphStyle(index, { color })}
                />
                {(block.fontSize !== undefined || block.color !== undefined) && (
                  <button
                    type="button"
                    className="style-reset-btn"
                    title="Use template typography"
                    aria-label="Use template typography"
                    onClick={() => setParagraphStyle(index, {}, true)}
                  >
                    ↺
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="figure-edit">
              <textarea
                className="field-input field-textarea field-textarea--grow field-mono"
                dir="ltr"
                value={block.tex}
                rows={4}
                placeholder="LaTeX, e.g. E = mc^2  or  \int_0^\infty e^{-x}\,dx"
                onChange={(event) => setTex(index, event.target.value)}
              />
              <input
                className="field-input"
                dir="auto"
                value={block.caption}
                placeholder="Equation caption (optional)…"
                onChange={(event) => setEquationCaption(index, event.target.value)}
              />
              <SegmentField<'left' | 'center' | 'right'>
                label="Caption align"
                value={block.align ?? 'center'}
                options={[
                  { value: 'left', label: 'Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'right', label: 'Right' },
                ]}
                onChange={(value) => setEquationAlign(index, value)}
              />
            </div>
          )}

        </div>
        {viewIndex < view.length - 1 && (
          <div className="paragraph-insert-row">
            <span aria-hidden="true" />
            <button
              type="button"
              className="paragraph-insert-btn"
              title={`Insert ${isGallery ? 'text card' : isFrontCover ? 'cover teaser' : 'paragraph'} here`}
              aria-label={`Insert ${isGallery ? 'text card' : isFrontCover ? 'cover teaser' : 'paragraph'} between items ${viewIndex + 1} and ${viewIndex + 2}`}
              onClick={() => insertParagraph(view[viewIndex + 1].index)}
            >
              <b aria-hidden="true">+</b>
              <span>{isGallery ? 'Text card' : isFrontCover ? 'Cover teaser' : 'Paragraph'}</span>
            </button>
            <span aria-hidden="true" />
          </div>
        )}
        </Fragment>
      ))}

      <div className="add-row">
        <button
          type="button"
          className="add-btn"
          onClick={() => insertParagraph(blocks.length)}
        >
          {isGallery ? '+ Text card' : isFrontCover ? '+ Cover teaser' : '+ Paragraph'}
        </button>
        {!isGallery && !isFrontCover && (
          <button
            type="button"
            className="add-btn"
            onClick={() =>
              update((doc) => {
                doc.blocks.push({ id: uid(), type: 'equation', tex: '', caption: '', align: 'center' });
              })
            }
          >
            + Equation
          </button>
        )}
      </div>
    </Section>
  );
}
