import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Doc } from '../schema/document';
import { emptyFrontMatter } from '../store/frontMatter';
import { packFrontMatter, type FrontMatterUnit } from '../lib/frontMatterLayout';
import { runsToHtml } from '../lib/richtext';
import { requestBlockEditorFocus } from '../lib/editorNavigation';
import { FramedImage } from '../components/FramedImage';
import { TagBar } from './TagBar';

export interface FrontMatterStatus { pages: number; overflow: boolean }
const target = (name: string, tab = 'content') => ({'data-editor-tab':tab,'data-editor-target':name});

function Unit({unit,dean}: {unit:FrontMatterUnit;dean:boolean}) {
  return <article data-measure-id={unit.id} className={`fm-unit${dean?' fm-paragraph':''}${unit.continued?' fm-continued':''}`}
    {...(!dean ? target(`fm-entry-${unit.id}`) : {})}
    onClick={dean ? () => requestBlockEditorFocus(unit.id) : undefined}
    style={{fontSize:unit.fontSize ? `${unit.fontSize}pt` : undefined,color:unit.color,paddingTop:unit.topPadding ? `${unit.topPadding}px` : undefined}}>
    {unit.page && <span className="fm-page-number">{unit.page}</span>}
    <div className="fm-entry-copy">
      {unit.title && <h2>{unit.title}{unit.continued && <small> · continued</small>}</h2>}
      <div data-fm-text style={{textIndent:dean && unit.indent && !unit.continued ? '1.2em' : undefined}} dangerouslySetInnerHTML={{__html:runsToHtml(unit.text)}} />
    </div>
  </article>;
}

export function FrontMatterPages({doc,vars,onStatus}: {doc:Doc;vars:CSSProperties;onStatus:(status:FrontMatterStatus)=>void}) {
  const dean = doc.templateId === 'frontmatter-dean';
  const board = doc.templateId === 'frontmatter-board';
  const content = doc.frontMatter ?? emptyFrontMatter();
  const measureRef = useRef<HTMLDivElement>(null);
  const units = useMemo<FrontMatterUnit[]>(() => dean
    ? doc.blocks.filter(b=>b.type==='paragraph').map(b=>({id:b.id,text:b.text,fontSize:b.fontSize,color:b.color,topPadding:b.topPadding,indent:b.indent}))
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
    const gap = parseFloat(getComputedStyle(column).rowGap) || 0;
    let widthOverflow = false;
    const measure = (unit:FrontMatterUnit) => {
      const node = nodes.find(n=>n.dataset.measureId===unit.id);
      if (!node) return 0;
      const copy = node.cloneNode(true) as HTMLElement;
      copy.querySelector('[data-fm-text]')!.innerHTML = runsToHtml(unit.text);
      if (unit.continued) {
        copy.style.paddingTop = '0';
        (copy.querySelector('[data-fm-text]') as HTMLElement).style.textIndent = '0';
        const heading = copy.querySelector('h2');
        if (heading) { const label = document.createElement('small'); label.textContent = ' · continued'; heading.append(label); }
      }
      column.append(copy);
      const size = copy.offsetHeight;
      widthOverflow ||= copy.scrollWidth > copy.clientWidth + 1;
      copy.remove();
      return size;
    };
    const packed = packFrontMatter(units,Math.max(1,height-2),measure,gap);
    // Contents and board groups are modular editorial cards, not article
    // paragraphs. Balance their final pair of columns without changing gaps.
    if (!dean && !packed.overflow) {
      const start = Math.floor((packed.columns.length-1)/2)*2;
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
    const fixedOverflow = height < 40 || [...root.querySelectorAll<HTMLElement>('.fm-rail,.fm-header,.fm-footer')]
      .some(node=>node.scrollHeight>node.clientHeight+1 || node.scrollWidth>node.clientWidth+1);
    packed.overflow ||= fixedOverflow || widthOverflow;
    setLayout(packed);
    onStatus({pages:Math.max(1,Math.ceil(packed.columns.length/2)),overflow:packed.overflow});
  },[units,doc,dean,fontEpoch,onStatus]);

  const photo = (slot:'hero'|'cover', className:string, placeholder?:string) => {
    const frame=doc[slot]; const asset=frame?.assetId ? doc.assets[frame.assetId] : null;
    if (!asset && !placeholder) return null;
    return <div className={className} {...target(`image-${slot}`,'images')}>
      {asset ? <FramedImage asset={asset} frame={frame} /> : <span className="fm-photo-placeholder">{placeholder}</span>}
    </div>;
  };
  const sheet = (pageIndex:number, children:ReactNode, measuring=false) => <div
    className={`page fm-page fm-page--${dean?'dean':board?'board':'contents'}`}
    style={vars} key={pageIndex} data-layout-overflow={!measuring && layout.overflow ? 'true' : undefined}>
    <TagBar doc={doc} pageIndex={pageIndex} detail={doc.meta.volume} />
    <div className="fm-shell">
      <header className="fm-header">
        <p className="fm-kicker" {...target('meta-category')}>{doc.meta.categoryLabel}{pageIndex>0 ? ' · continued' : ''}</p>
        <h1 {...target('meta-title')}>{doc.meta.title}</h1>
        {doc.meta.subtitle && <p className="fm-subtitle" {...target('meta-subtitle')}>{doc.meta.subtitle}</p>}
        {dean && <div className="fm-identity">
          {photo('hero','fm-portrait','Your portrait')}
          <div><strong {...target('meta-author')}>{doc.meta.author}</strong><p {...target('meta-affiliation')}>{doc.meta.affiliation}</p></div>
        </div>}
        {board && photo('cover','fm-banner')}
        {board && doc.meta.photoCredit && <p className="fm-credit" {...target('meta-photo-credit')}>{doc.meta.photoCredit}</p>}
      </header>
      <div className="fm-middle">
        <div className="fm-columns" dir={doc.design.textDirection === 'rtl' ? 'rtl' : 'ltr'}>{children}</div>
        <aside className="fm-rail">
          {!board && photo('cover', 'fm-feature')}
          {!board && doc.meta.photoCredit && <p className="fm-credit" {...target('meta-photo-credit')}>{doc.meta.photoCredit}</p>}
          <div {...target('fm-note')}><h2>{board ? content.aboutTitle : content.noteTitle}</h2>
            <div className="fm-note-text" dangerouslySetInnerHTML={{__html:runsToHtml(board ? content.about : content.note)}} />
          </div>
          {dean && <div className="fm-signoff" {...target('meta-author')}><span>{content.signoff}</span><strong>{doc.meta.author}</strong></div>}
          {!dean && !board && photo('hero','fm-feature fm-feature-secondary')}
        </aside>
      </div>
      <div className="fm-footer" aria-hidden="true" />
    </div>
  </div>;

  return <>
    {Array.from({length:Math.max(1,Math.ceil(layout.columns.length/2))},(_,i)=>sheet(i,
      [0,1].map(c=><div className="fm-column" key={c}>{(layout.columns[i*2+c]??[]).map((unit,j)=><Unit key={`${unit.id}-${j}`} unit={unit} dean={dean}/>)}</div>)))}
    <div className="fm-measure" ref={measureRef} aria-hidden="true">
      {sheet(0,<><div className="fm-column">{units.map(unit=><div className="fm-measure-unit" key={unit.id}><Unit unit={unit} dean={dean}/></div>)}</div><div className="fm-column"/></>,true)}
    </div>
  </>;
}
