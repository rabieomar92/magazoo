import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDoc } from '../store/useDoc';
import { FOCUS_BLOCK_EDITOR_EVENT, FOCUS_EDITOR_TARGET_EVENT, type EditorTargetDetail } from '../lib/editorNavigation';
import './typography-toolbar.css';

const LABELS: Record<string, string> = {
  theme: 'Theme defaults', body: 'Body defaults (all paragraphs)', title: 'Title', subtitle: 'Subtitle / description',
  category: 'Category / kicker', author: 'Author', affiliation: 'Affiliation', masthead: 'Masthead',
  footer: 'Page footer', marginText: 'Page margin text', quote: 'Pull quote', attribution: 'Quote attribution', photoCredit: 'Photo credit',
  strapline: 'Strapline', kicker: 'Category / kicker', storyTag: 'Story tag', teaserTitle: 'Teaser title', teaserBody: 'Teaser description', footerBrand: 'Footer publication',
  brand: 'Brand name', tagline: 'Tagline', website: 'Website', qrLabel: 'QR description',
  socialLabel: 'Social-media labels', socialUrl: 'Social-media links', footerText: 'Footer text', imprint: 'Issue mark',
};
type Group = { group: string; label: string };
interface TypographyContextValue {
  templateId: string | undefined;
  host: HTMLDivElement | null;
  active: string | null;
  register: (id: string, group: Group) => () => void;
  setHost: (host: HTMLDivElement | null) => void;
  select: (group: string | null) => void;
  groups: Group[];
}
const TypographyContext = createContext<TypographyContextValue | null>(null);

/** Presentation state only. Document updates and object selection stay with
 * their existing owners; we merely observe their existing navigation signals. */
export function TypographyProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [active, select] = useState<string | null>('body');
  const [registered, setRegistered] = useState<Record<string, Group>>({});
  const templateId = useDoc(state => state.doc.templateId);
  const register = useCallback((id: string, group: Group) => {
    setRegistered(current => ({ ...current, [id]: group }));
    return () => setRegistered(current => { const next = { ...current }; delete next[id]; return next; });
  }, []);
  const groups = useMemo(() => [...new Map(Object.values(registered).map(group => [group.group, group])).values()], [registered]);

  useEffect(() => { select(templateId === 'magazine-4' ? 'title' : templateId === 'backcover-1' ? 'brand' : 'body'); }, [templateId]);
  useEffect(() => {
    const resolve = (target: string): string | null | undefined => {
      const doc = useDoc.getState().doc;
      if (/^(image-|gallery-image-|news-photo-|design-background|signature)/.test(target)) return null;
      const story = doc.news?.stories.find(story => target === `news-${story.id}` || target.endsWith(`-${story.id}`));
      if (story && target.startsWith('news-')) return `news:${story.id}`;
      if (target.startsWith('front-cover-style-')) return target.slice('front-cover-style-'.length);
      if (target.startsWith('backcover-style-')) return target.slice('backcover-style-'.length);
      if (target.startsWith('footer-')) return 'footer';
      if (target.startsWith('page-margin-text-')) return 'marginText';
      if (target.startsWith('backcover-')) {
        const role = target.slice('backcover-'.length);
        if (role.startsWith('social')) return 'socialUrl';
        return ({ 'qr-label': 'qrLabel', 'footer-text': 'footerText' } as Record<string, string>)[role] ?? (LABELS[role] ? role : undefined);
      }
      if (target.startsWith('fm-')) return 'body';
      if (target === 'design-fonts' || target === 'design-ink') return 'theme';
      if (target === 'design-topbar') return 'masthead';
      const meta: Record<string, string> = { 'meta-title': 'title', 'meta-subtitle': 'subtitle', 'meta-author': 'author', 'meta-category': doc.templateId === 'magazine-4' || doc.templateId === 'magazine-3' ? 'kicker' : 'category', 'meta-affiliation': doc.templateId === 'magazine-4' ? 'strapline' : 'affiliation', 'meta-masthead': 'masthead', 'meta-volume': 'masthead', 'meta-location': 'storyTag', 'meta-photo-credit': 'photoCredit', 'meta-hero-caption': 'subtitle', 'meta-pull-quote': 'quote', 'meta-pull-quote-by': 'attribution' };
      return meta[target];
    };
    const targetFocus = (event: Event) => {
      const target = (event as CustomEvent<EditorTargetDetail>).detail?.target;
      if (!target) return;
      const next = resolve(target);
      if (next !== undefined) select(next);
    };
    const blockFocus = (event: Event) => {
      const id = (event as CustomEvent<{ blockId?: string }>).detail?.blockId;
      if (id) select(`block:${id}`);
    };
    const focus = (event: FocusEvent) => {
      if (!(event.target instanceof Element) || event.target.closest('.typography-toolbar')) return;
      // Image arrangement remains in Images; only its authored caption uses
      // the existing description typography. No click/selection is intercepted.
      if (event.target.closest('.gallery-slot') && event.target.matches('textarea,input:not([type])')) { select('subtitle'); return; }
      if (event.target.closest('[id^="editor-target-backcover-social-"]') && event.target.matches('input')) {
        const label = event.target.closest('label')?.querySelector('.field-label')?.textContent ?? '';
        select(label.startsWith('Label') ? 'socialLabel' : 'socialUrl'); return;
      }
      const block = event.target.closest<HTMLElement>('[data-block-editor-id], [id^="block-editor-"]');
      if (block) { select(`block:${block.dataset.blockEditorId ?? block.id.slice('block-editor-'.length)}`); return; }
      const field = event.target.closest<HTMLElement>('[id^="editor-target-"]');
      if (field) {
        const next = resolve(field.id.slice('editor-target-'.length));
        if (next !== undefined) select(next);
      }
    };
    window.addEventListener(FOCUS_EDITOR_TARGET_EVENT, targetFocus);
    window.addEventListener(FOCUS_BLOCK_EDITOR_EVENT, blockFocus);
    document.addEventListener('focusin', focus);
    return () => {
      window.removeEventListener(FOCUS_EDITOR_TARGET_EVENT, targetFocus);
      window.removeEventListener(FOCUS_BLOCK_EDITOR_EVENT, blockFocus);
      document.removeEventListener('focusin', focus);
    };
  }, []);
  const value = useMemo(() => ({ host, active, register, setHost, select, groups, templateId }), [host, active, register, groups, templateId]);
  return <TypographyContext.Provider value={value}>{children}</TypographyContext.Provider>;
}

/** Relocate the original React element, including its original handlers.
 * Keep it mounted while groups change so number drafts and DOM focus survive. */
export function TypographyControl({ group, label, also = '', order = 50, children }: {
  group: string; label?: string; also?: string; order?: number; children: ReactNode;
}) {
  const context = useContext(TypographyContext);
  const id = useId();
  const register = context?.register;
  const name = label ?? LABELS[group] ?? group;
  useEffect(() => register?.(id, { group, label: name }), [register, id, group, name]);
  if (!context) return <>{children}</>;
  const active = context.active;
  const localSelection = !!(active?.startsWith('block:') || active?.startsWith('news:') || active === 'marginText');
  const sharedFallback = !localSelection && group === 'body' && active !== null && !context.groups.some(item => item.group === active);
  const pairedSocial = active === 'socialUrl' && group === 'socialLabel';
  // The publication-name field is shared by the masthead and footer brand.
  const coverShared = context.templateId === 'magazine-4' && active === 'masthead' && group === 'footerBrand';
  // A selected paragraph/story must never expose the document-wide size or
  // colour beside its own overrides. Global controls remain in explicit groups.
  const visible = active !== null && (active === group || (!localSelection && group === 'theme') || sharedFallback || pairedSocial || coverShared || also.split(' ').includes(active));
  const scope = active !== group && group === 'theme' ? 'Theme default' : coverShared || pairedSocial ? name : null;
  return context.host ? createPortal(<div className="typography-control" data-typography-group={group} hidden={!visible} style={{ order }}>
    {scope && <span className="typography-control-scope">{scope}</span>}
    {children}
  </div>, context.host) : null;
}

export function TypographyToolbar() {
  const context = useContext(TypographyContext);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const host = context?.host;
  const active = context?.active;
  const groups = context?.groups;
  useEffect(() => {
    if (!host) return;
    const measure = () => setOverflow({ left: host.scrollLeft > 1, right: host.scrollLeft + host.clientWidth < host.scrollWidth - 1 });
    measure();
    host.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(host);
    return () => { host.removeEventListener('scroll', measure); observer?.disconnect(); };
  }, [host, active, groups]);
  useEffect(() => { if (host) host.scrollLeft = 0; }, [host, active]);
  if (!context) return null;
  const known = context.groups.some(group => group.group === context.active);
  return <section className="typography-toolbar" aria-label="Text typography">
    <label className="typography-context field" title="Choose text controls. Scroll the formatting row horizontally for more options. Theme and body defaults affect all matching text.">
      <span className="field-label">Text controls</span>
      <select className="field-input select-control" aria-label="Typography group" value={context.active ?? ''}
        onChange={event => context.select(event.target.value || null)}>
        <option value="">Select text to format</option>
        {!known && context.active && <option value={context.active}>{LABELS[context.active] ?? 'Selected text'}</option>}
        {context.groups.map(group => <option key={group.group} value={group.group}>{group.label}</option>)}
      </select>
      <small className="typography-scope-note">Theme and body defaults affect all matching text.</small>
    </label>
    <div className="typography-controls" ref={context.setHost} role="group" aria-label="Formatting controls" tabIndex={0} />
    {(overflow.left || overflow.right) && <div className="typography-overflow-nav" aria-label="More formatting controls">
      <button type="button" aria-label="Previous formatting controls" title="Previous controls" disabled={!overflow.left} onClick={() => host?.scrollBy({ left: -280, behavior: 'smooth' })}>‹</button>
      <button type="button" aria-label="More formatting controls" title="More controls" disabled={!overflow.right} onClick={() => host?.scrollBy({ left: 280, behavior: 'smooth' })}>›</button>
    </div>}
    {context.active === null && <p className="typography-hint">Select or focus text to see its existing formatting controls.</p>}
  </section>;
}
