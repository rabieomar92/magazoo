import { useDoc } from '../../store/useDoc';
import { grid } from '../../lib/geometry';
import { articleGridDesign, articlePageHeight, isReferenceArticle } from '../../lib/articleLayouts';
import { defaultPlacedHighlights, placedHighlightsGeometry } from '../../lib/placedHighlights';
import { familyOf, type PlacedHighlights } from '../../schema/document';
import { LabeledColor, LabeledInput, LabeledNumber, RowButtons, Section, SegmentField, Toggle } from '../Field';
import {highlightBorderEnabled} from '../../lib/highlightBorder';

export function HighlightsSection() {
  const highlights = useDoc((s) => s.doc.highlights);
  const label = useDoc((s) => s.doc.meta.highlightsLabel);
  const design = useDoc((s) => s.doc.design);
  const templateId=useDoc(s=>s.doc.templateId);
  const borderVisible=highlightBorderEnabled(design,templateId);
  const isReference = useDoc(s => isReferenceArticle(s.doc.templateId));
  const geometryDesign = isReference ? articleGridDesign(design) : design;
  const pageHeight = isReference ? articlePageHeight(design) : undefined;
  const placement = useDoc((s) => s.doc.highlightBox);
  const isGallery = useDoc((s) => familyOf(s.doc.templateId) === 'gallery');
  const update = useDoc((s) => s.update);
  const free = design.highlightsPlacement === 'free';
  const box = placement ?? defaultPlacedHighlights(geometryDesign, pageHeight);
  const maxWidth = Math.min(4, grid(geometryDesign).totalCols);
  const widthOptions = Array.from({ length: maxWidth }, (_, index) => ({
    value: (index + 1) as PlacedHighlights['widthCols'],
    label: `${index + 1} col`,
  }));

  const set = (i: number, v: string) =>
    update((d) => {
      d.highlights[i] = v;
    });

  const setLabel = (v: string) =>
    update((d) => {
      d.meta.highlightsLabel = v;
    });

  const remove = (i: number) =>
    update((d) => {
      d.highlights.splice(i, 1);
    });

  const add = () =>
    update((d) => {
      d.highlights.push('');
    });

  const setFree = (enabled: boolean) =>
    update((d) => {
      d.design.highlightsPlacement = enabled ? 'free' : 'page1';
      if (enabled) {
        d.design.sidebar = true;
        d.highlightBox ??= defaultPlacedHighlights(geometryDesign, pageHeight);
      }
    });

  const changeBox = (fn: (box: PlacedHighlights) => void) =>
    update((d) => {
      d.highlightBox ??= defaultPlacedHighlights(geometryDesign, pageHeight);
      fn(d.highlightBox);
    });

  return (
    <Section title="Highlights" editorTarget="highlights">
      <Toggle label="Show highlights box" checked={design.sidebar} onChange={visible => update(d => { d.design.sidebar = visible; })} />
      <p className="hint">Hide or show the highlights and references box. Your saved text and position are kept.</p>
      <details className="control-disclosure"><summary>Box appearance</summary>
        <Toggle label="Show highlight border" checked={borderVisible} onChange={visible=>update(d=>{d.design.highlightBorder=visible;})}/>
        {borderVisible&&<>
          <LabeledColor label="Highlight border colour" value={design.highlightBorderColor??design.colors.accent} onChange={color=>update(d=>{d.design.highlightBorderColor=color;})}/>
          {design.highlightBorderColor&&<button type="button" className="btn" onClick={()=>update(d=>{delete d.design.highlightBorderColor;})}>Use theme border colour</button>}
        </>}
      </details>
      <LabeledInput
        label="Section heading"
        editorTarget="highlights-label"
        value={label ?? ''}
        onChange={setLabel}
        placeholder="Highlights"
      />
      {!isGallery && (
        <div className="highlight-placement-controls">
          <Toggle label="Arrange freely on page" checked={free} onChange={setFree} />
          {free && (
            <>
              <p className="hint">
                Drag the box exactly like an image. Its left edge snaps to columns; text wraps around it and it automatically avoids page images.
              </p>
              <SegmentField<PlacedHighlights['widthCols']>
                label="Box width"
                value={Math.min(box.widthCols, maxWidth) as PlacedHighlights['widthCols']}
                options={widthOptions}
                onChange={(widthCols) =>
                  changeBox((current) => {
                    current.widthCols = widthCols;
                    const next = placedHighlightsGeometry(current, geometryDesign, 0, pageHeight);
                    current.anchor.column = next.column;
                    current.anchor.y = next.top;
                  })
                }
              />
              <LabeledNumber
                label="Page"
                value={box.anchor.page}
                min={1}
                max={99}
                onChange={(page) =>
                  changeBox((current) => {
                    current.anchor.page = Math.min(99, Math.max(1, Math.round(page)));
                  })
                }
              />
            </>
          )}
        </div>
      )}
      {highlights.map((h, i) => (
        // Plain strings have no id; index key is acceptable until reorder lands.
        <div className="list-item" key={i}>
          <textarea
            className="field-input field-textarea"
            dir="auto"
            value={h}
            rows={2}
            placeholder={`Highlight ${i + 1}`}
            onChange={(e) => set(i, e.target.value)}
          />
          <RowButtons onRemove={() => remove(i)} />
        </div>
      ))}
      <button type="button" className="add-btn" onClick={add}>
        + Add highlight
      </button>
    </Section>
  );
}
