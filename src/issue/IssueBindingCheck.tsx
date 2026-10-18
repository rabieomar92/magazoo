import { bindingPageCounts, bindingPadding } from './binding';
import type { IssueAssignment, IssueItem, IssuePrintSettings } from './model';
import { BusyIndicator } from '../components/BusyIndicator';

export function IssueBindingCheck({ items, assignments, ready, settings, onChange, disabled }: {
  items: IssueItem[]; assignments: IssueAssignment[]; ready: boolean; settings?:IssuePrintSettings; onChange?:(settings:IssuePrintSettings)=>void; disabled?:boolean;
}) {
  const multiple=settings?.perfectMultiple??2;
  const pages = bindingPageCounts(items, assignments);
  const result = (count: number, step: number) => {
    const extra = bindingPadding(count, step);
    return <output className={`issue-binding-result${extra === 0 ? ' is-complete' : ''}`} aria-label={extra === 0 ? 'No extra pages needed' : `Add ${extra} blank pages`}>
      {extra === 0 ? <><span aria-hidden="true">✓</span> No padding</> : <>+{extra} blank {extra === 1 ? 'page' : 'pages'}</>}
    </output>;
  };
  return <section className="issue-binding-check" aria-label="Binding page check">
    <header className="issue-binding-heading"><h3>Binding</h3><span>{ready ? `${pages.total} pages · entire issue` : 'Awaiting page counts'}</span></header>
    {!ready ? <div className="issue-binding-pending"><BusyIndicator label="Calculating page counts…" /></div> : <>
      <div className="issue-binding-options" aria-live="polite">
        <div className="issue-binding-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M4 4h16v16H4zM12 4v16M10 8h4M10 16h4" /></svg>
          <div><h4>Stapled</h4><span>{pages.total} → {pages.total + bindingPadding(pages.total, 4)} pages · includes covers</span></div>{result(pages.total, 4)}
        </div>
        <div className="issue-binding-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M5 4h15v16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM7 4v16" /></svg>
          <div><h4>Perfect bound</h4><span>{pages.interior} → {pages.interior + bindingPadding(pages.interior, multiple)} interior pages · multiple of {multiple}</span></div>{result(pages.interior, multiple)}
        </div>
      </div>
      <details className="issue-binding-details">
        <summary>Printer settings <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="m5 6 3 3 3-3" /></svg></summary>
        <div className="issue-binding-settings">
      <label className="issue-binding-multiple">Perfect-binding page multiple
        <select value={multiple} disabled={disabled} onChange={event => onChange?.({binding:'saddle-stitch',...settings,perfectMultiple:Number(event.target.value) as IssuePrintSettings['perfectMultiple']})}>
          <option value={2}>Even pages (2) · digital</option>
          <option value={4}>Multiple of 4</option>
          <option value={8}>Multiple of 8</option>
          <option value={16}>Multiple of 16</option>
          <option value={32}>Multiple of 32</option>
        </select>
      </label>
      <p>Counts refer to printed sides. Stapled binding requires a multiple of 4; include any inside covers missing from this PDF. Perfect binding excludes {pages.cover} cover pages and includes front matter and contents. Confirm the printer’s page multiple and minimum thickness; supply the cover and spine separately.</p>
      <p>Every compiled page counts, including documents not listed in the contents. Page-count estimate only; blank pages are not added automatically.</p>
        </div>
      </details>
    </>}
  </section>;
}
