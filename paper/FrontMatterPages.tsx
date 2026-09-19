import { Fragment, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Doc } from '../schema/document';
import { emptyFrontMatter } from '../store/frontMatter';
import { packFrontMatter, type FrontMatterUnit } from '../lib/frontMatterLayout';
import { runsToHtml } from '../lib/richtext';
import { dropCapEnabled } from '../lib/textDirection';
import { requestBlockEditorFocus } from '../lib/editorNavigation';
import { FramedImage } from '../components/FramedImage';
import { TagBar } from './TagBar';
import { largestBoardScaleThatFits } from '../lib/frontMatterBoardFit';

export interface FrontMatterStatus { pages: number; overflow: boolean }
const target = (name: string, tab = 'content') => ({'data-editor-tab':tab,'data-editor-target':name});

function Unit({unit,dean,initial=false,doc}: {unit:FrontMatterUnit;dean:boolean;initial?:boolean;doc:Doc}) {
  if (unit.kind === 'signature') {
    const content = doc.frontMatter ?? emptyFrontMatter();
    const frame = content.signature;
    const asset = frame?.assetId ? doc.assets[frame.assetId] : null;
    return <article data-measure-id={unit.id} className="fm-unit fm-dean-signature">
      {asset && <div className="fm-signature-image" data-editor-tab="images" data-editor-target="image-signature"><FramedImage asset={asset} frame={frame} fit="contain" /></div>}
      <div className="fm-signoff" data-editor-tab="content" data-editor-target="meta-author"><span>{content.signoff}</span><strong>{doc.meta.author}</strong></div>
    </article>;
  }
  return <article data-measure-id={unit.id} className={`fm-unit${dean?' fm-paragraph':''}${unit.continued?' fm-continued':''}`}
    {...(!dean ? target(`fm-entry-${unit.id}`) : {})}
    onClick={dean ? () => requestBlockEditorFocus(unit.id) : undefined}
    style={{fontSize:unit.fontSize ? `${unit.fontSize}pt` : undefined,color:unit.color,paddingTop:unit.topPadding ? `${unit.topPadding}px` : undefined}}>
    {unit.page && <span className="fm-page-number">{unit.page}</span>}
    <div className="fm-entry-copy">
      {unit.title && <h2>{unit.title}{unit.continued && <small> · continued</small>}</h2>}
      <div data-fm-text style={{textIndent:dean && unit.indent && !unit.continued ? '1.2em' : undefined}} dangerouslySetInnerHTML={{__html:runsToHtml(unit.text,initial && !unit.continued)}} />
    </div>
  </article>;
}

export function FrontMatterPages({doc,vars,onStatus}: {doc:Doc;vars:CSSProperties;onStatus:(status:FrontMatterStatus)=>void}) {
  const dean = doc.templateId === 'frontmatter-dean';
  const board = doc.templateId === 'frontmatter-board';
  const content = doc.frontMatter ?? emptyFrontMatter();
  const aboutColumns = Math.max(1,Math.min(3,doc.design.frontMatterAboutColumns ?? 3));
  const logoWidth = Math.max(8,Math.min(40,content.logoWidth ?? 18));
  const logoAsset = content.logo?.assetId ? doc.assets[content.logo.assetId] : null;
  const logoAspect = logoAsset ? Math.max(.8,Math.min(8,logoAsset.naturalWidth/Math.max(1,logoAsset.naturalHeight))) : 3.2;
  const [boardScale,setBoardScale] = useState(1);
  const pageVars = {
    ...vars,
    '--fm-about-columns': String(aboutColumns),
    '--fm-board-body-size': `${doc.design.sizes.body * boardScale}pt`,
    '--fm-board-heading-size': `${7.2 * boardScale}pt`,
    '--fm-board-entry-gap': `${2.8 * boardScale}mm`,
    '--fm-logo-width': `${logoWidth}mm`,
    '--fm-logo-height': `${logoWidth / logoAspect}mm`,
    '--fm-signature-width': `${Math.max(15,Math.min(55,content.signatureWidth ?? 34))}mm`,
    '--fm-dean-category-gap': `${Math.max(0,Math.min(40,doc.design.deanCategoryTopGap ?? 0))}mm`,
    '--fm-dean-title-gap': `${Math.max(0,Math.min(35,doc.design.deanTitleBottomGap ?? (doc.meta.subtitle ? 4 : 8)))}mm`,
  } as CSSProperties;
  const initial = dean && dropCapEnabled(doc.design,doc.templateId);
  const measureRef = useRef<HTMLDivElement>(null);
  const units = useMemo<FrontMatterUnit[]>(() => dean
    ? [...doc.blocks.filter(b=>b.type==='paragraph').map(b=>({id:b.id,text:b.text,fontSize:b.fontSize,color:b.color,topPadding:b.topPadding,indent:b.indent})), {id:'dean-signature',text:'',kind:'signature' as const}]
    : (doc.frontMatter?.entries ?? []).map(e=>({...e})), [dean,doc.blocks,doc.frontMatter]);
  const [layout,setLayout] = useState<{columns:FrontMatterUnit[][];overflow:boolean}>({columns:[[]],overflow:false});
  const [fontEpoch,setFontEpoch] = useState(0);
  useLayoutEffect(() => {
    let alive = true;
    const refresh = () => { if (alive) setFontEpoch(n=>n+1); };
    void document.fonts.ready.then(refresh);
    document.fonts.addEventListener('loadingdone',refresh);
    return ()=>{alive=false;document.fonts.removeEventListener('loadingdone',refresh);};
  },[]);

  useLayoutEffect(() => {
    const root = measureRef.current;
    const column = root?.querySelector<HTMLElement>('.fm-column');
    if (!root || !column) return;
    const nodes = [...column.querySelectorAll<HTMLElement>('.fm-unit')];
    const height = column.clientHeight;
    let gap = parseFloat(getComputedStyle(column).rowGap) || 0;
    let widthOverflow = false;
    let trackWidthOverflow = !board;
    const measure = (unit:FrontMatterUnit) => {
      const node = nodes.find(n=>n.dataset.measureId===unit.id);
      if (!node) return 0;
      const copy = node.cloneNode(true) as HTMLElement;
      const text = copy.querySelector<HTMLElement>('[data-fm-text]');
      if (text) text.innerHTML = runsToHtml(unit.text,initial && unit.id===units[0]?.id && !unit.continued);
      if (unit.continued) {
        copy.style.paddingTop = '0';
        if (text) text.style.textIndent = '0';
        const heading = copy.querySelector('h2');
        if (heading) { const label = document.createElement('small'); label.textContent = ' · continued'; heading.append(label); }
      }
      column.append(copy);
      const size = copy.offsetHeight;
      if (trackWidthOverflow) widthOverflow ||= copy.scrollWidth > copy.clientWidth + 1;
      copy.remove();
      return size;
    };
    const applyBoardScale = (scale:number) => {
      root.style.setProperty('--fm-board-body-size',`${doc.design.sizes.body * scale}pt`);
      root.style.setProperty('--fm-board-heading-size',`${7.2 * scale}pt`);
      root.style.setProperty('--fm-board-entry-gap',`${2.8 * scale}mm`);
      gap = parseFloat(getComputedStyle(column).rowGap) || 0;
    };
    const packAtScale = (scale:number) => {
      if (board) applyBoardScale(scale);
      return packFrontMatter(units,Math.max(1,height-2),measure,gap);
    };
    let selectedBoardScale = 1;
    if (board) {
      const fitsBoardScale = (scale:number) => {
        const trial = packAtScale(scale);
        return !trial.overflow && trial.columns.length <= 2;
      };
      // Keep a genuinely readable floor. If the role list still needs a
      // continuation sheet, retain full-size type and use the continuation
      // layout instead of shrinking the publication credits into fine print.
      selectedBoardScale = fitsBoardScale(.78)
        ? largestBoardScaleThatFits(fitsBoardScale,.78)
        : 1;
      applyBoardScale(selectedBoardScale);
      setBoardScale(previous => Math.abs(previous-selectedBoardScale) < .001 ? previous : selectedBoardScale);
      trackWidthOverflow = true;
    } else {
      setBoardScale(previous => previous === 1 ? previous : 1);
    }
    let packed = packAtScale(selectedBoardScale);
    // Contents and board groups are modular editorial cards, not article
    // paragraphs. Balance their final pair of columns without changing gaps.
    if (!dean && !packed.overflow) {
      const start = board ? 0 : Math.floor((packed.columns.length-1)/2)*2;
      const tail = packed.columns.slice(start).flat();
      let low = Math.max(1,...tail.map(measure)), high = height-2;
      let balanced = packFrontMatter(tail,high,measure,gap);
      while (high-low > 1) {
        const middle = (low+high)/2;
        const candidate = packFrontMatter(tail,middle,measure,gap);
        if (candidate.columns.length<=2 && !candidate.overflow) { high=middle; balanced=candidate; } else low=middle;
      }
      packed.columns.splice(start,packed.columns.length-start,...balanced.columns);
    }
    // Fixed header/rail/footer text is also checked, not silently clipped.
    const fixedOverflow = height < 40 || [...root.querySelectorAll<HTMLElement>('.fm-rail,.fm-header,.fm-footer,.fm-board-caption,.fm-board-list-header,.fm-board-contact')]
      .some(node=>node.scrollHeight>node.clientHeight+1 || node.scrollWidth>node.clientWidth+1);
    packed.overflow ||= fixedOverflow || widthOverflow;
    setLayout(packed);
    onStatus({pages:Math.max(1,Math.ceil(packed.columns.length/2)),overflow:packed.overflow});
  },[units,doc,dean,board,initial,fontEpoch,onStatus]);

  type Frame = {assetId:string|null;offsetX:number;offsetY:number;scale:number};
  const framedPhoto = (frame:Frame|undefined, className:string, editorTarget:string, placeholder?:string, fit:'cover'|'contain'='cover') => {
    const asset=frame?.assetId ? doc.assets[frame.assetId] : null;
    if (!asset && !placeholder) return null;
    return <div className={className} {...target(editorTarget,'images')}>
      {asset ? <FramedImage asset={asset} frame={frame} fit={fit} /> : <span className="fm-photo-placeholder">{placeholder}</span>}
    </div>;
  };
  const photo = (slot:'hero'|'cover', className:string, placeholder?:string, fit:'cover'|'contain'='cover') =>
    framedPhoto(doc[slot],className,`image-${slot}`,placeholder,fit);
  const boardHero = () => {
    const frame=doc.cover;
    const asset=frame?.assetId ? doc.assets[frame.assetId] : null;
    if (!asset) return null;
    const hasCaption=Boolean(doc.meta.categoryLabel || doc.meta.heroCaption || doc.meta.photoCredit);
    return <figure className="fm-board-hero">
      {framedPhoto(frame,'fm-banner fm-banner--bleed','image-cover')}
      {hasCaption && <figcaption className="fm-board-caption">
        <p className="fm-board-caption-line">
          {doc.meta.categoryLabel && <strong {...target('meta-category')}>{doc.meta.categoryLabel}</strong>}
          {' '}
          {doc.meta.heroCaption && <span {...target('meta-hero-caption')}>{doc.meta.heroCaption}</span>}
        </p>
        {doc.meta.photoCredit && <small {...target('meta-photo-credit')}>{doc.meta.photoCredit}</small>}
      </figcaption>}
    </figure>;
  };
  const boardAbout = () => {
    const paragraphs = content.about.split(/\n\s*\n/u);
    const after = Math.max(0,Math.min(paragraphs.length,content.logoAfterParagraph ?? Math.max(0,paragraphs.length-1)));
    const wrap = content.logoWrap ?? 'end';
    const logo = framedPhoto(
      content.logo,
      `fm-board-logo fm-board-logo--wrap-${wrap} fm-board-logo--${content.logoAlign ?? 'center'}`,
      'image-logo',undefined,'contain',
    );
    return <div className="fm-note-text">
      {after===0 && logo}
      {paragraphs.map((paragraph,index)=><Fragment key={`${index}-${paragraph.slice(0,16)}`}>
        <p className="fm-note-paragraph" dangerouslySetInnerHTML={{__html:runsToHtml(paragraph)}} />
        {after===index+1 && logo}
      </Fragment>)}
    </div>;
  };
  const sheet = (pageIndex:number, children:ReactNode, measuring=false) => <div
    className={`${measuring?'fm-measure-page':'page'} fm-page fm-page--${dean?'dean':board?'board':'contents'}${board&&pageIndex>0&&!measuring?' fm-page--continuation':''}${board&&doc.design.showTopBar===false?' fm-page--no-topbar':''}`}
    style={pageVars} dir={doc.design.textDirection ?? 'ltr'} key={pageIndex}
    data-layout-helper={measuring ? 'true' : undefined}
    data-layout-overflow={!measuring && layout.overflow ? 'true' : undefined}>
    {(!board || doc.design.showTopBar !== false) && <TagBar doc={doc} pageIndex={pageIndex} detail={doc.meta.volume} />}
    <div className="fm-shell">
      {board ? (pageIndex===0 || measuring ? boardHero() : null) : <header className="fm-header">
        <p className="fm-kicker" {...target('meta-category')}>{doc.meta.categoryLabel}{pageIndex>0 ? ' · continued' : ''}</p>
        <h1 {...target('meta-title')}>{doc.meta.title}</h1>
        {doc.meta.subtitle && <p className="fm-subtitle" {...target('meta-subtitle')}>{doc.meta.subtitle}</p>}
        {dean && <div className="fm-identity">
          {photo('hero','fm-portrait','Your portrait')}
          <div><strong {...target('meta-author')}>{doc.meta.author}</strong><p {...target('meta-affiliation')}>{doc.meta.affiliation}</p></div>
        </div>}
      </header>}
      <div className="fm-middle">
        <div className="fm-columns" dir={doc.design.textDirection === 'rtl' ? 'rtl' : 'ltr'}>
          {board && <div className="fm-board-list-header">
            <h1 {...target('meta-title')}>{doc.meta.title}{pageIndex>0 ? ' · continued' : ''}</h1>
            {pageIndex===0 && doc.meta.subtitle && <p {...target('meta-subtitle')}>{doc.meta.subtitle}</p>}
          </div>}
          {children}
        </div>
        {!(board&&pageIndex>0&&!measuring) && <aside className="fm-rail">
          {dean ? <div {...target('fm-note')}><h2>{content.noteTitle}</h2>
            {photo('cover', 'fm-feature fm-dean-cover')}
            {doc.meta.photoCredit && <p className="fm-credit" {...target('meta-photo-credit')}>{doc.meta.photoCredit}</p>}
            <div className="fm-note-text" dangerouslySetInnerHTML={{__html:runsToHtml(content.note)}} />
          </div> : <>
            {!board && photo('cover', 'fm-feature')}
            {!board && doc.meta.photoCredit && <p className="fm-credit" {...target('meta-photo-credit')}>{doc.meta.photoCredit}</p>}
            <div {...target('fm-note')}><h2>{board ? content.aboutTitle : content.noteTitle}</h2>
              {board ? boardAbout() : <div className="fm-note-text" dangerouslySetInnerHTML={{__html:runsToHtml(content.note)}} />}
            </div>
          </>}
          {board && content.contact && <p className="fm-board-contact" {...target('fm-contact')}>{content.contact}</p>}
          {!dean && !board && photo('hero','fm-feature fm-feature-secondary')}
        </aside>}
      </div>
      <div className="fm-footer" aria-hidden="true" />
    </div>
  </div>;

  return <>
    {Array.from({length:Math.max(1,Math.ceil(layout.columns.length/2))},(_,i)=>sheet(i,
      [0,1].map(c=><div className="fm-column" key={c}>{(layout.columns[i*2+c]??[]).map((unit,j)=><Unit key={`${unit.id}-${j}`} unit={unit} dean={dean} initial={initial && unit.id===units[0]?.id} doc={doc}/>)}</div>)))}
    <div className="fm-measure" ref={measureRef} aria-hidden="true">
      {sheet(0,<><div className="fm-column">{units.map(unit=><div className="fm-measure-unit" key={unit.id}><Unit unit={unit} dean={dean} initial={initial && unit.id===units[0]?.id} doc={doc}/></div>)}</div><div className="fm-column"/></>,true)}
    </div>
  </>;
}
