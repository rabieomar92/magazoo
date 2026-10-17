import { useEffect, useState } from 'react';
import { useDoc } from '../store/useDoc';
import { familyOf, type TemplateFamily, type TemplateId } from '../schema/document';
import { TEMPLATE_META } from '../store/presets';
import { IMAGE_LED_COMPOSITIONS, isImageLedTemplate, templateChoiceId, templateChoices, templateDisplayName } from '../lib/templateChoices';
import { MetaSection } from './sections/MetaSection';
import { FooterSection } from './sections/FooterSection';
import { PageMarginTextSection } from './sections/PageMarginTextSection';
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
import { PhotoBackgroundSection } from './sections/PhotoBackgroundSection';
import { TopBarSection } from './sections/TopBarSection';
import {HeaderLayoutSection} from './sections/HeaderLayoutSection';
import {GateDesignSection} from './sections/GateDesignSection';
import {EditorSectionIcon} from './EditorSectionIcon';
import {ImageDeck,REVEAL_IMAGE_CONTROL} from './ImageDeck';
import './editor-refinements.css';
import './workspace-polish.css';
import {
  blockEditorId,
  editorTargetId,
  editorTabForTarget,
  FOCUS_BLOCK_EDITOR_EVENT,
  FOCUS_EDITOR_TARGET_EVENT,
  type EditorTab,
  type EditorTargetDetail,
} from '../lib/editorNavigation';

type TabId = EditorTab;

const TABS: { id: TabId; label: string;short?:string }[] = [
  { id: 'content', label: 'Content' },
  { id: 'images', label: 'Images' },
  { id: 'highlights', label: 'Highlights & references',short:'Highlights' },
  { id: 'headers', label: 'Headers' },
  { id: 'footers', label: 'Footers' },
  { id: 'topbar', label: 'Top bar' },
  { id: 'sidetext', label: 'Side text' },
  { id: 'design', label: 'Page & design' },
];

const TEMPLATE_GROUPS: { family: TemplateFamily; label: string }[] = [
  { family: 'news', label: 'News & briefs' },
  { family: 'backcover', label: 'Back cover' },
  { family: 'frontmatter', label: 'Magazine front matter' },
  { family: 'paper', label: 'Article' },
  { family: 'magazine', label: 'Editorial' },
  { family: 'gallery', label: 'Photo essay' },
];

const LAYOUT_CHOICES = templateChoices(TEMPLATE_META);

/**
 * Writing is the one dominant task, the rest is occasional setup — so the panel
 * shows one section at a time. Meta lives with Body under Content; page images
 * have their own tab because they are positioned independently from paragraphs.
 * The A4 preview is a separate pane, so switching tabs never hides the result.
 */
export function Panel() {
  const [tab, setTab] = useState<TabId>('content');
  const [marginPage,setMarginPage]=useState(1);
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
    const reveal = (id: string, attempts = 0) => {
      const destination = document.getElementById(id);
      if (!destination) {
        if (attempts < 8) requestAnimationFrame(() => reveal(id, attempts + 1));
        return;
      }
      if(destination.closest('.image-deck-item[hidden]')){
        window.dispatchEvent(new CustomEvent(REVEAL_IMAGE_CONTROL,{detail:{target:id.replace(/^editor-target-/,'')}}));
        if(attempts<8)requestAnimationFrame(()=>reveal(id,attempts+1));
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
      const margin=detail.target.match(/^page-margin-text-(\d+)$/);if(margin)setMarginPage(Number(margin[1]));
      setTab(editorTabForTarget(detail.tab,detail.target));
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
    <aside className="panel" id="editor-panel" aria-label="Editing controls">
      <div className="panel-workspace-heading"><span>Editor</span><span className="panel-workspace-context">{TABS.find(t=>t.id===tab)?.label}</span></div>
      <nav className="panel-tabs" role="tablist" aria-label="Editor sections">
        {TABS.map((t,index) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-label={t.label}
            title={t.label}
            tabIndex={tab===t.id?0:-1}
            className={`panel-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
            onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?TABS.length-1:(index+(event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:event.key==='ArrowUp'?-4:4)+TABS.length)%TABS.length;setTab(TABS[next].id);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();}}
          >
            <EditorSectionIcon name={t.id}/><span>{t.short??t.label}</span>
            {t.id === 'highlights' && sidebarCount > 0 && <span className="badge" aria-hidden="true">{sidebarCount}</span>}
          </button>
        ))}
      </nav>

      <div className="template-switch-compact">
        <label className="template-switch-field">
          <span>Layout</span>
          <select
            className="select-control"
            value={templateChoiceId(templateId)}
            aria-label="Layout template"
            onChange={(event) => {
              const next = event.target.value as TemplateId;
              if (next !== templateChoiceId(templateId)) setPendingTemplate(next);
            }}
          >
            {TEMPLATE_GROUPS.map((group) => (
              <optgroup label={group.label} key={group.family}>
                {LAYOUT_CHOICES.filter((template) => template.family === group.family).map((template) => (
                  <option value={template.id} key={template.id}>
                    {template.name} — {template.kind}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {isImageLedTemplate(templateId) && <div className="template-composition-group">
          <label className="template-switch-field">
            <span>Composition</span>
            <select className="select-control" value={templateId} aria-label="Image-led composition" aria-describedby="image-led-composition-hint"
              onChange={event => {
                const next = event.target.value as TemplateId;
                if (next !== templateId) setPendingTemplate(next);
              }}>
              {IMAGE_LED_COMPOSITIONS.map(composition => <option value={composition.id} key={composition.id}>{composition.name}</option>)}
            </select>
          </label>
          <p id="image-led-composition-hint" className="template-composition-hint">{IMAGE_LED_COMPOSITIONS.find(composition => composition.id === templateId)?.description}</p>
        </div>}
      </div>

      <div className="panel-scroll" tabIndex={0} aria-label="Editor options" data-editor-category={tab}>
        {tab === 'content' && (
          <>
            {isBackCover ? <BackCoverContent part="content" /> : isGate ? <div className="section"><p className="hint">Cover headings and positioning are in Headers.</p><button type="button" className="add-btn" onClick={() => setTab('headers')}>Edit cover headings</button></div> : null}
            {isBackCover ? null : isNews ? <NewsContent /> : isFrontMatter ? <FrontMatterContent /> : <BodySection />}
          </>
        )}
        {tab === 'images' &&
          (isBackCover ? <BackCoverImages /> : isNews ? <NewsImages /> : isFrontMatter ? <FrontMatterImages /> : isGallery ? (
            <GallerySection />
          ) : (
            <>
              <ImageDeck label="Image group" names={isCoverOnly?['Cover image']:['Hero & cover','Page images']}>
                <HeroSection />
                {!isCoverOnly && <ArticleImagesSection />}
              </ImageDeck>
            </>
          ))}
        {tab === 'highlights' && (
          <>
            {(isGallery||isCoverOnly||isFrontMatter||isNews||isBackCover)&&<p className="hint">This layout does not print an article highlights box. These notes remain available when switching to an article layout.</p>}
            <HighlightsSection />
            <ReferencesSection />
          </>
        )}
        {tab==='headers'&&<>{isGate?<GateDesignSection headingsOnly/>:isBackCover?<BackCoverContent part="headers"/>:isGallery?<p className="hint">Gallery image headings and descriptions are in Images. The running masthead is in Top bar.</p>:<><MetaSection headingOnly/>{(!isFrontMatter&&!isNews||templateId==='frontmatter-dean')&&<HeaderLayoutSection/>}</>}</>}
        {tab==='footers'&&<><FooterSection expanded/>{isBackCover&&<BackCoverContent part="footers"/>}</>}
        {tab==='topbar'&&<TopBarSection complete/>}
        {tab==='sidetext'&&<PageMarginTextSection expanded initialPage={marginPage}/>}
        <div className="panel-design-pane" hidden={tab !== 'design'}>
          <p className="typography-relocated-note">Font and text styling controls are in the top toolbar. Page layout, backgrounds and object positioning stay here.</p>
          {isBackCover ? <BackCoverDesign /> : isFrontMatter || isNews ? <FrontMatterDesign pageOnly/> : <DesignSection pageOnly/>}
          <PhotoBackgroundSection /><DirectionSection />
        </div>
      </div>
      {pendingTemplate && <div className="template-warning-backdrop" role="presentation">
        <section className="template-warning" role="alertdialog" aria-modal="true" aria-labelledby="template-warning-title" aria-describedby="template-warning-copy">
          <span className="template-warning-icon" aria-hidden="true">!</span>
          <h2 id="template-warning-title">Changing the layout can reflow every page</h2>
          <p id="template-warning-copy">
            You are changing from <strong>{templateDisplayName(templateId, TEMPLATE_META)}</strong> to <strong>{templateDisplayName(pendingTemplate, TEMPLATE_META)}</strong>. Your writing, images and saved project data will remain, but page breaks, image positions and template-specific settings may look different.
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
