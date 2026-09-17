import { useEffect, useState } from 'react';
import { contentsDeck, issueHeroChoices, issuePlainText, issueSection, type ContentsDesign, type ContentsEntryStyle, type IssueItem } from './model';
import { HeroCropEditor } from './HeroCropEditor';
import type { ImageFrame } from '../lib/imageFrame';

/**
 * The shape the picture will actually be cut to, read off the compiled sheet
 * on screen. The same photograph sits in a wide rail slot on one page and a
 * tall feature slot on another, so the crop control asks the page rather than
 * assuming — and falls back to a plain landscape slot only while no sheet has
 * been compiled yet.
 */
function useSlotAspect(id: string, version: number) {
  const [aspect, setAspect] = useState(16 / 10);
  useEffect(() => {
    const slot = document.querySelector<HTMLElement>(`.issue-proof-pages [data-contents-shot="${CSS.escape(id)}"]`);
    if (!slot) return;
    const width = slot.clientWidth;
    const height = slot.clientHeight;
    if (width > 0 && height > 0) setAspect(width / height);
  }, [id, version]);
  return aspect;
}

export function ContentsEntryCard({ item, index, style, design, busy, proofVersion, onChange, onReset }: {
  item: IssueItem; index: number; style: ContentsEntryStyle; design: ContentsDesign;
  busy: boolean; proofVersion: number;
  onChange: (patch: Partial<ContentsEntryStyle>) => void; onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const realTitle = issuePlainText(item.doc.meta.title) || item.name.replace(/\.json$/iu, '');
  const realSubtitle = contentsDeck(item.doc.meta.subtitle);
  const realSection = issueSection(item);
  const choices = issueHeroChoices(item.doc);
  const automatic = choices[0];
  const chosen = style.assetId === null ? undefined : style.assetId ? item.doc.assets?.[style.assetId] ?? automatic?.asset : automatic?.asset;
  const showsPicture = (style.hero ?? design.showHeroes) && !!chosen?.src;
  const hiddenDeck = style.deck === '';
  const customDeck = typeof style.deck === 'string' && style.deck !== '';
  const overridden = Object.keys(style).length > 0;
  const aspect = useSlotAspect(item.id, proofVersion);

  return <div className={`entry-card${open ? ' is-open' : ''}`} data-entry-id={item.id}>
    <button type="button" className="entry-summary" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span className="entry-index">{String(index + 1).padStart(2, '0')}</span>
      <span className="entry-summary-copy">
        <strong dir="auto">{style.title || realTitle}</strong>
        <small dir="auto">{style.section || realSection || 'No section'}{showsPicture ? ' · picture' : ' · text only'}{overridden ? ' · edited' : ''}</small>
      </span>
      <span className="entry-chevron" aria-hidden="true" />
    </button>
    {open && <div className="entry-body">
      <label className="field">Title on the contents page
        <input maxLength={140} placeholder={realTitle} value={style.title ?? ''} disabled={busy}
          onChange={event => onChange({ title: event.target.value || undefined })} />
      </label>
      <label className="switch">
        <input type="checkbox" checked={!hiddenDeck} disabled={busy}
          onChange={event => onChange({ deck: event.target.checked ? undefined : '' })} />
        <span>Show a subtitle</span>
      </label>
      {!hiddenDeck && <label className="field">Subtitle{!customDeck && realSubtitle && <em> — using the article’s own</em>}
        <textarea rows={2} maxLength={240} placeholder={realSubtitle || 'No subtitle on the article itself'}
          value={style.deck ?? ''} disabled={busy}
          onChange={event => onChange({ deck: event.target.value || undefined })} />
      </label>}
      <div className="field-pair">
        <label className="field">Badge
          <input maxLength={30} placeholder="e.g. COVER STORY" value={style.badge ?? ''} disabled={busy}
            onChange={event => onChange({ badge: event.target.value || undefined })} />
        </label>
        <label className="field">Section
          <input maxLength={40} placeholder={realSection || 'No top bar on this article'} value={style.section ?? ''} disabled={busy}
            onChange={event => onChange({ section: event.target.value || undefined })} />
        </label>
      </div>
      <p className="field-hint">Sections come from each article’s own top bar, so consecutive articles carrying the same bar are grouped together. Type here only to depart from it.</p>

      <div className="entry-picture">
        <label className="switch">
          <input type="checkbox" checked={style.hero ?? design.showHeroes} disabled={busy || !chosen?.src}
            onChange={event => onChange({ hero: event.target.checked === design.showHeroes ? undefined : event.target.checked })} />
          <span>Show a picture for this entry</span>
        </label>
        {!chosen?.src && <p className="field-hint">This article has no picture the contents page can use.</p>}
        {choices.length > 1 && <label className="field">Which picture
          <select value={style.assetId === null ? '__none__' : style.assetId ?? '__auto__'} disabled={busy}
            onChange={event => onChange({ assetId: event.target.value === '__auto__' ? undefined : event.target.value === '__none__' ? null : event.target.value })}>
            <option value="__auto__">Automatic — the article’s lead picture</option>
            {choices.map((choice, position) => <option key={choice.id} value={choice.id}>Picture {position + 1}{choice.id === automatic?.id ? ' (lead)' : ''}</option>)}
            <option value="__none__">No picture</option>
          </select>
        </label>}
        {showsPicture && chosen && <HeroCropEditor
          asset={chosen} frame={style.frame} aspect={aspect} disabled={busy}
          onChange={(frame: ImageFrame) => onChange({ frame })}
        />}
        <label className="switch">
          <input type="checkbox" checked={style.pageLabel ?? design.pageLabels} disabled={busy || !showsPicture}
            onChange={event => onChange({ pageLabel: event.target.checked === design.pageLabels ? undefined : event.target.checked })} />
          <span>Page-number chip on this picture</span>
        </label>
      </div>
      {overridden && <button type="button" className="ghost entry-reset" disabled={busy} onClick={onReset}>Reset this entry to the article</button>}
    </div>}
  </div>;
}
