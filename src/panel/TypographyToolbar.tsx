import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDoc } from '../store/useDoc';
import { TRACKING_SELECTORS, trackingRoleSupported } from '../lib/textTracking';
import { LetterSpacingField } from './LetterSpacingField';
import { extraTextGroups, textStyleSelector } from '../lib/textStyles';
import { TextStyleFields } from './TextStyleFields';
import type { TextStyle } from '../schema/document';
import { FOCUS_BLOCK_EDITOR_EVENT, FOCUS_EDITOR_TARGET_EVENT, type EditorTargetDetail } from '../lib/editorNavigation';
import './typography-toolbar.css';

const LABELS: Record<string, string> = {
  theme: 'Theme defaults', body: 'Body defaults (all paragraphs)', title: 'Title', subtitle: 'Subtitle / description',
  category: 'Category / kicker', author: 'Author', affiliation: 'Affiliation', masthead: 'Masthead',
  footer: 'Page footer', marginText: 'Page margin text', quote: 'Pull quote', attribution: 'Quote attribution', photoCredit: 'Photo credit',
  strapline: 'Strapline', kicker: 'Category / kicker', storyTag: 'Story tag', teaserTitle: 'Teaser title', teaserBody: 'Teaser description', footerBrand: 'Footer publication',
  brand: 'Brand name', tagline: 'Tagline', website: 'Website', qrLabel: 'QR description',
  socialLabel: 'Social-media labels', socialUrl: 'Social-media links', footerText: 'Footer text', imprint: 'Issue mark',
  caption: 'Image / equation captions', heroCaption: 'Hero image caption', coverCaption: 'Cover image caption', highlights: 'Highlights', references: 'References',
  newsHeadline: 'Story headlines', newsCaption: 'Story captions', newsKicker: 'Story kickers', newsDeck: 'Story introductions', newsByline: 'Story bylines',
};
type Group = { group: string; label: string; property?: keyof TextStyle | 'tracking'; also?: string };
interface TypographyContextValue {
  templateId: string | undefined;
  host: HTMLDivElement | null;
  active: string | null;
  register: (id: string, group: Group) => () => void;
  setHost: (host: HTMLDivElement | null) => void;
  select: (group: string | null) => void;
  groups: Group[];
  controls: Group[];
}
const TypographyContext = createContext<TypographyContextValue | null>(null);

/** Presentation state only. Document updates and object selection stay with
 * their existing owners; we merely observe their existing navigation signals. */
export function TypographyProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [active, select] = useState<string | null>('body');
  const [registered, setRegistered] = useState<Record<string, Group>>({});
  const templateId = useDoc(state => state.doc.templateId);
  // Group labels depend on object identities/order, not their authored text.
  // Keep the context stable while typing rather than refreshing every portal.
  const extraGroupsKey = useDoc(state => JSON.stringify(extraTextGroups(state.doc)));
  const register = useCallback((id: string, group: Group) => {
    setRegistered(current => ({ ...current, [id]: group }));
    return () => setRegistered(current => { const next = { ...current }; delete next[id]; return next; });
  }, []);
  const controls = useMemo(() => Object.values(registered), [registered]);
  const groups = useMemo(() => [...new Map([...(JSON.parse(extraGroupsKey) as Group[]), ...controls].map(group => [group.group, group])).values()], [controls, extraGroupsKey]);

  useEffect(() => { select(templateId === 'magazine-4' ? 'title' : templateId === 'backcover-1' ? 'brand' : 'body'); }, [templateId]);
  useEffect(() => {
    const resolve = (target: string): string | null | undefined => {
      const doc = useDoc.getState().doc;
      if (target.startsWith('gallery-caption-')) return `gallery-caption:${target.slice('gallery-caption-'.length)}`;
      if (target.startsWith('article-caption-')) return `image-caption:${target.slice('article-caption-'.length)}`;
      if (target === 'highlights-label') return 'highlightHeading';
      if (target === 'references-label') return 'referenceHeading';
      if (target.startsWith('highlights')) return 'highlights';
      if (target.startsWith('references')) return 'references';
      if (/^(image-|gallery-image-|news-photo-|design-background|signature)/.test(target)) return null;
      const story = doc.news?.stories.find(story => target === `news-${story.id}` || target.endsWith(`-${story.id}`));
      if (story && target.startsWith('news-')) {
        const role = target.slice(5, -(story.id.length + 1));
        if (role === 'alt') return null;
        return `news:${story.id}:${role === 'text' || !role ? 'body' : role}`;
      }
      if (target.startsWith('front-cover-style-')) return target.slice('front-cover-style-'.length);
      if (target.startsWith('backcover-style-')) return target.slice('backcover-style-'.length);
      if (target.startsWith('footer-')) return 'footer';
      if (target.startsWith('page-margin-text-')) return 'marginText';
      if (target.startsWith('backcover-')) {
        const role = target.slice('backcover-'.length);
        if (role.startsWith('social')) return 'socialUrl';
        return ({ 'qr-label': 'qrLabel', 'footer-text': 'footerText' } as Record<string, string>)[role] ?? (LABELS[role] ? role : undefined);
      }
      if (target.startsWith('fm-entry-title-')) return `fm-entry:${target.slice(15)}:title`;
      if (target.startsWith('fm-entry-text-')) return `fm-entry:${target.slice(14)}:body`;
      if (target.startsWith('fm-entry-')) return `fm-entry:${target.slice(9)}:body`;
      if (target === 'fm-heading') return 'fmHeading';
      if (target === 'fm-contact') return 'fmContact';
      if (target === 'fm-note') return doc.templateId === 'frontmatter-board' ? 'fmAbout' : 'fmNote';
      if (target === 'design-fonts' || target === 'design-ink') return 'theme';
      if (target === 'design-topbar') return 'masthead';
      const meta: Record<string, string> = { 'meta-title': 'title', 'meta-subtitle': 'subtitle', 'meta-author': 'author', 'meta-category': doc.templateId === 'magazine-4' || doc.templateId === 'magazine-3' ? 'kicker' : 'category', 'meta-affiliation': doc.templateId === 'magazine-4' ? 'strapline' : 'affiliation', 'meta-masthead': 'masthead', 'meta-volume': 'volume', 'meta-location': 'storyTag', 'meta-photo-credit': 'photoCredit', 'meta-hero-caption': 'heroCaption', 'meta-pull-quote': 'quote', 'meta-pull-quote-by': 'attribution' };
      return target === 'meta-cover-caption' ? 'coverCaption' : meta[target];
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
      // Image arrangement stays in Images; each authored caption owns its
      // alignment while still exposing the existing shared description fonts.
      const galleryCaption = event.target.closest<HTMLElement>('[data-gallery-caption-id]');
      if (galleryCaption && event.target.matches('textarea,input:not([type])')) {
        select(`gallery-caption:${galleryCaption.dataset.galleryCaptionId}`); return;
      }
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
  const value = useMemo(() => ({ host, active, register, setHost, select, groups, controls, templateId }), [host, active, register, groups, controls, templateId]);
  return <TypographyContext.Provider value={value}>{children}<TrackingControls /><CompleteTypography /></TypographyContext.Provider>;
}

function CompleteTypography() {
  const context = useContext(TypographyContext)!;
  const doc = useDoc(s => s.doc);
  const active = context.active;
  if (!context.host || !active || active === 'theme' || !textStyleSelector(active)) return null;
  const properties = context.controls.filter(c => c.group === active || c.also?.split(' ').includes(active)).flatMap(c => c.property ? [c.property] : []);
  // These older local spacing controls are mounted directly into the toolbar.
  if (/^(block:|gallery-caption:)/.test(active) || /^news:[^:]+$/.test(active)) properties.push('tracking');
  return createPortal(<TextStyleFields key={active} group={active} existing={properties} doc={doc} />, context.host);
}

const COVER_TRACKING = new Set(['masthead', 'strapline', 'kicker', 'title', 'subtitle', 'author', 'storyTag', 'teaserTitle', 'teaserBody', 'footerBrand', 'photoCredit']);
const GATE_TRACKING = new Set(['title', 'kicker', 'subtitle', 'quote', 'attribution', 'author', 'photoCredit']);
const BACK_TRACKING = new Set(['brand', 'tagline', 'website', 'qrLabel', 'socialLabel', 'socialUrl', 'footerText', 'imprint']);

function TrackingControls() {
  const context = useContext(TypographyContext)!;
  const doc = useDoc(state => state.doc);
  const update = useDoc(state => state.update);
  const set = (key: string, value?: number) => update(d => {
    d.design.textTracking ??= {};
    if (value === undefined) delete d.design.textTracking[key];
    else d.design.textTracking[key] = value;
  });
  const existing = doc.templateId === 'magazine-4' ? COVER_TRACKING : doc.templateId === 'magazine-3' ? GATE_TRACKING : doc.templateId === 'backcover-1' ? BACK_TRACKING : new Set<string>();
  const roles = Object.keys(TRACKING_SELECTORS).filter(role => !existing.has(role) && trackingRoleSupported(doc.templateId, role) && (!role.startsWith('news') || doc.templateId === 'news-briefs')
    && !(role === 'subtitle' && context.active?.startsWith('gallery-caption:')));
  const active = context.active ?? '';
  const local = active.startsWith('block:') || active.startsWith('gallery-caption:');
  const paragraph = active.startsWith('block:') ? doc.blocks.find(block => block.id === active.slice(6)) : undefined;
  return <>
    {roles.map(role => <TypographyControl key={role} group={role} order={45}
      label={role === 'storyTag' && doc.templateId === 'magazine-2' ? 'Photo caption (right page)' : undefined} property="tracking">
      <LetterSpacingField value={doc.design.textTracking?.[role]} onChange={value => set(role, value)} />
    </TypographyControl>)}
    {context.host && local && (!paragraph || paragraph.type === 'paragraph' || paragraph.type === 'equation') && createPortal(
      <div className="typography-control" style={{ order: 45 }}><LetterSpacingField key={active} value={doc.design.textTracking?.[active]} onChange={value => set(active, value)} /></div>, context.host)}
    {context.host && /^news:[^:]+$/.test(active) && createPortal(<div className="typography-control" style={{ order: 45 }}>
      {(['title', 'body', 'caption'] as const).map(role => <LetterSpacingField key={`${active}:${role}`} label={`${role[0].toUpperCase()}${role.slice(1)} spacing`}
        value={doc.design.textTracking?.[`${active}:${role}`]} onChange={value => set(`${active}:${role}`, value)} />)}
    </div>, context.host)}
  </>;
}

/** Relocate the original React element, including its original handlers.
 * Keep it mounted while groups change so number drafts and DOM focus survive. */
export function TypographyControl({ group, label, also = '', order = 50, children, property }: {
  group: string; label?: string; also?: string; order?: number; children: ReactNode; property?: keyof TextStyle | 'tracking';
}) {
  const context = useContext(TypographyContext);
  const overrides = useDoc(s => s.doc.design.textStyles?.[group]);
  const id = useId();
  const register = context?.register;
  const name = label ?? LABELS[group] ?? group;
  useEffect(() => register?.(id, { group, label: name, property, also }), [register, id, group, name, property, also]);
  if (!context) return <>{children}</>;
  const active = context.active;
  const localSelection = !!(active?.startsWith('block:') || active?.startsWith('news:') || active?.startsWith('gallery-caption:') || active === 'marginText');
  const captionShared = active?.startsWith('gallery-caption:') && group === 'subtitle';
  const sharedFallback = !localSelection && group === 'body' && active !== null && !context.groups.some(item => item.group === active);
  const pairedSocial = active === 'socialUrl' && group === 'socialLabel';
  // The publication-name field is shared by the masthead and footer brand.
  const coverShared = context.templateId === 'magazine-4' && active === 'masthead' && group === 'footerBrand';
  // A selected paragraph/story must never expose the document-wide size or
  // colour beside its own overrides. Global controls remain in explicit groups.
  const overridden = property && property !== 'tracking' && overrides?.[property] !== undefined;
  const visible = !overridden && active !== null && (active === group || sharedFallback || pairedSocial || coverShared || captionShared || also.split(' ').includes(active));
  const scope = captionShared ? 'Description defaults' : active !== group && group === 'theme' ? 'Theme default' : coverShared || pairedSocial ? name : null;
  const propertyOrder:Partial<Record<keyof TextStyle|'tracking',number>>={fontFamily:10,fontSize:20,fontWeight:30,italic:31,underline:32,color:40,tracking:45,lineHeight:48,align:50};
  const groupedOrder=property ? propertyOrder[property]??order : 100+order;
  return context.host ? createPortal(<div className="typography-control" data-typography-group={group} data-style-property={property} hidden={!visible} style={{ order:groupedOrder }}>
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
    const measure = () => {
      const left = host.scrollLeft > 1, right = host.scrollLeft + host.clientWidth < host.scrollWidth - 1;
      setOverflow(current => current.left === left && current.right === right ? current : { left, right });
    };
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
