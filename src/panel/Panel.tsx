import { useEffect, useState } from 'react';
import { useDoc } from '../store/useDoc';
import { familyOf, type TemplateFamily, type TemplateId } from '../schema/document';
import { TEMPLATE_META } from '../store/presets';
import { MetaSection } from './sections/MetaSection';
import { FooterSection } from './sections/FooterSection';
import { HeroSection } from './sections/HeroSection';
import { GallerySection } from './sections/GallerySection';
import { BodySection } from './sections/BodySection';
import { HighlightsSection } from './sections/HighlightsSection';
import { ReferencesSection } from './sections/ReferencesSection';
import { DesignSection } from './sections/DesignSection';
import { ArticleImagesSection } from './sections/ArticleImagesSection';
import { FrontMatterContent, FrontMatterImages, FrontMatterDesign } from './sections/FrontMatterSection';
import { NewsContent, NewsImages } from './sections/NewsSection';
import { BackCoverContent, BackCoverImages, BackCoverDesign } from './sections/BackCoverSection';
import { DirectionSection } from './sections/DirectionSection';
import './editor-refinements.css';
import {
  blockEditorId,
  editorTargetId,
  FOCUS_BLOCK_EDITOR_EVENT,
  FOCUS_EDITOR_TARGET_EVENT,
  type EditorTab,
  type EditorTargetDetail,
} from '../lib/editorNavigation';

type TabId = EditorTab;

const TABS: { id: TabId; label: string }[] = [
  { id: 'content', label: 'Content' },
  { id: 'images', label: 'Images' },
  { id: 'highlights', label: 'Highlights' },
  { id: 'design', label: 'Design' },
];

const TEMPLATE_GROUPS: { family: TemplateFamily; label: string }[] = [
  { family: 'news', label: 'News & briefs' },
  { family: 'backcover', label: 'Back cover' },
  { family: 'frontmatter', label: 'Magazine front matter' },
  { family: 'paper', label: 'Article' },
  { family: 'magazine', label: 'Editorial' },
  { family: 'gallery', label: 'Photo essay' },
];

/**
 * Writing is the one dominant task, the rest is occasional setup — so the panel
 * shows one section at a time. Meta lives with Body under Content; page images
 * have their own tab because they are positioned independently from paragraphs.
 * The A4 preview is a separate pane, so switching tabs never hides the result.
 */
export function Panel() {
  const [tab, setTab] = useState<TabId>('content');
  const [pendingTemplate, setPendingTemplate] = useState<TemplateId | null>(null);
  const sidebarCount = useDoc(
    (s) => s.doc.highlights.filter((h) => h.trim()).length + s.doc.references.length,
  );
  const templateId = useDoc((s) => s.doc.templateId ?? 'paper-1');
  const switchTemplate = useDoc((s) => s.switchTemplate);
  const isGallery = familyOf(templateId) === 'gallery';
  const isCoverOnly = templateId === 'magazine-4';
  const isGate = templateId === 'magazine-3';
  const isFrontMatter = familyOf(templateId) === 'frontmatter';
  const isNews = familyOf(templateId) === 'news';
  const isBackCover = familyOf(templateId) === 'backcover';
  useEffect(() => {
    if ((isFrontMatter || isNews || isBackCover) && tab === 'highlights') setTab('content');
  },[isFrontMatter,isNews,isBackCover,tab]);

  useEffect(() => {
    const reveal = (id: string, attempts = 0) => {
      const destination = document.getElementById(id);
      if (!destination) {
        if (attempts < 8) requestAnimationFrame(() => reveal(id, attempts + 1));
        return;
      }

      // Cover object settings live inside collapsible groups. Open every
      // enclosing group before scrolling, then focus the first safe control.
      let parent: HTMLElement | null = destination;
      while (parent) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
        parent = parent.parentElement;
      }
      destination.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const control = destination.matches('input, textarea, select, button, summary')
        ? destination
        : destination.querySelector<HTMLElement>(
            'input:not([type="hidden"]), textarea, select, summary, button',
          );
      control?.focus({ preventScroll: true });
      destination.classList.remove('is-preview-focused');
      // Restart the short locator pulse even when the same object is clicked twice.
      requestAnimationFrame(() => destination.classList.add('is-preview-focused'));
      window.setTimeout(() => destination.classList.remove('is-preview-focused'), 1100);
    };

    const onFocusBlock = (event: Event) => {
      const blockId = (event as CustomEvent<{ blockId?: string }>).detail?.blockId;
      if (!blockId) return;
      setTab('content');

      // Switching tabs mounts BodySection. Retry for a few animation frames so
      // the same interaction works from Images/Highlights/Design as well as
      // when the editor is already visible.
      requestAnimationFrame(() => reveal(blockEditorId(blockId)));
    };

    const onFocusTarget = (event: Event) => {
      const detail = (event as CustomEvent<EditorTargetDetail>).detail;
      if (!detail?.tab || !detail.target) return;
      setTab(isGate && /^(meta-|footer-)/.test(detail.target) ? 'design' : detail.tab);
      requestAnimationFrame(() => reveal(editorTargetId(detail.target)));
    };
    window.addEventListener(FOCUS_BLOCK_EDITOR_EVENT, onFocusBlock);
    window.addEventListener(FOCUS_EDITOR_TARGET_EVENT, onFocusTarget);
    return () => {
      window.removeEventListener(FOCUS_BLOCK_EDITOR_EVENT, onFocusBlock);
      window.removeEventListener(FOCUS_EDITOR_TARGET_EVENT, onFocusTarget);
    };
  }, [isGate]);

  return (
    <aside className="panel">
      <nav className="panel-tabs" role="tablist" aria-label="Editor sections">
        {TABS.filter(t => !(isFrontMatter || isNews || isBackCover) || t.id !== 'highlights').map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`panel-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {isGate && t.id === 'content' ? 'Article' : isGate && t.id === 'design' ? 'Cover & design' : t.label}
            {t.id === 'highlights' && sidebarCount > 0 && <span className="badge">{sidebarCount}</span>}
          </button>
        ))}
      </nav>

      <div className="template-switch-compact">
        <label className="template-switch-field">
          <span>Layout</span>
          <select
            className="select-control"
            value={templateId}
            aria-label="Layout template"
            onChange={(event) => {
              const next = event.target.value as TemplateId;
              if (next !== templateId) setPendingTemplate(next);
            }}
          >
            {TEMPLATE_GROUPS.map((group) => (
              <optgroup label={group.label} key={group.family}>
                {TEMPLATE_META.filter((template) => template.family === group.family).map((template) => (
                  <option value={template.id} key={template.id}>
                    {template.name} — {template.kind}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <div className="panel-scroll">
        {tab === 'content' && (
          <>
            {isBackCover ? <BackCoverContent /> : isGate ? <div className="section"><p className="hint">Cover text and its appearance now live together under Cover & design.</p><button type="button" className="add-btn" onClick={() => setTab('design')}>Edit cover text & design</button></div> : <><MetaSection /><FooterSection /></>}
            {isBackCover ? null : isNews ? <NewsContent /> : isFrontMatter ? <FrontMatterContent /> : <BodySection />}
          </>
        )}
        {tab === 'images' &&
          (isBackCover ? <BackCoverImages /> : isNews ? <NewsImages /> : isFrontMatter ? <FrontMatterImages /> : isGallery ? (
            <GallerySection />
          ) : (
            <>
              <HeroSection />
              {!isCoverOnly && <ArticleImagesSection />}
            </>
          ))}
        {tab === 'highlights' && (
          <>
            <HighlightsSection />
            <ReferencesSection />
          </>
        )}
        <div className="panel-design-pane" hidden={tab !== 'design'}>
          <p className="typography-relocated-note">Font and text styling controls are in the top toolbar. Page layout, backgrounds and object positioning stay here.</p>
          <DirectionSection />{isBackCover ? <BackCoverDesign /> : isFrontMatter || isNews ? <FrontMatterDesign /> : <DesignSection />}
        </div>
      </div>
      {pendingTemplate && <div className="template-warning-backdrop" role="presentation">
        <section className="template-warning" role="alertdialog" aria-modal="true" aria-labelledby="template-warning-title" aria-describedby="template-warning-copy">
          <span className="template-warning-icon" aria-hidden="true">!</span>
          <h2 id="template-warning-title">Changing the layout can reflow every page</h2>
          <p id="template-warning-copy">
            You are changing from <strong>{TEMPLATE_META.find(t=>t.id===templateId)?.name ?? templateId}</strong> to <strong>{TEMPLATE_META.find(t=>t.id===pendingTemplate)?.name ?? pendingTemplate}</strong>. Your writing, images and saved project data will remain, but page breaks, image positions and template-specific settings may look different.
          </p>
          <p className="template-warning-advice">For an important issue, save a separate copy before continuing. You can also use Undo immediately after the change.</p>
          <div className="template-warning-actions">
            <button type="button" className="tool-btn" autoFocus onClick={()=>setPendingTemplate(null)}>Keep current layout</button>
            <button type="button" className="tool-btn template-warning-confirm" onClick={()=>{
              const next = pendingTemplate;
              setPendingTemplate(null);
              switchTemplate(next);
            }}>Change layout</button>
          </div>
        </section>
      </div>}
    </aside>
  );
}
