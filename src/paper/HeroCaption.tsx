/** @jsxImportSource ../lib/mathJsx */
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type CSSProperties,type PointerEvent as ReactPointerEvent} from 'react';
import {createPortal} from 'react-dom';
import type { Doc } from '../schema/document';
import { heroCaptionText } from '../lib/heroCaption';
import {boundedHeroCaption,heroCaptionPageDimensions,HERO_CAPTION_LAYOUT_EVENT,type HeroCaptionBox} from '../lib/heroCaptionPlacement';
import {useDoc} from '../store/useDoc';
import {usePreviewReadOnly} from './PreviewReadOnly';
import '../styles/hero-caption-editor.css';

type Layer={page:HTMLElement;style:CSSProperties;box:HeroCaptionBox};
type Gesture={pointer:number;x:number;y:number;scale:number;box:HeroCaptionBox;next:HeroCaptionBox;moved:boolean};
const MM=96/25.4;

/** Preserve the template's native slot. Only an intentionally moved caption
 * gets a page-level text layer, outside the photo's crop/overflow rectangle. */
export function HeroCaption({doc,cover=false,overlay=false,className='',as:Tag='p',style,readOnly=false}: {
  doc:Doc;cover?:boolean;overlay?:boolean;className?:string;as?:'p'|'figcaption'|'div';style?:CSSProperties;readOnly?:boolean;
}) {
  const inheritedReadOnly=usePreviewReadOnly();readOnly=readOnly||inheritedReadOnly;
  const key=cover&&doc.templateId!=='frontmatter-board'?'coverCaptionPlacement':'heroCaptionPlacement';
  const placement=doc.design[key],text=heroCaptionText(doc,cover);
  const dimensions=useMemo(()=>heroCaptionPageDimensions(doc),[doc]);
  const update=useDoc(s=>s.update);
  const source=useRef<HTMLElement>(null),floating=useRef<HTMLParagraphElement>(null);
  const gesture=useRef<Gesture|null>(null);
  const [layer,setLayer]=useState<Layer|null>(null),[draft,setDraft]=useState<HeroCaptionBox|null>(null);
  const notification=useRef('');
  const classes=className.includes('article-hero-caption')?className:`hero-caption${overlay?' hero-caption--overlay':''}${className?` ${className}`:''}`;
  const target=cover&&doc.templateId!=='frontmatter-board'?'meta-cover-caption':'meta-hero-caption';

  const readLayer=useCallback(()=>{
    const element=source.current,page=element?.closest<HTMLElement>('.page');if(!element||!page)return null;
    const pr=page.getBoundingClientRect(),rect=element.getBoundingClientRect(),scale=pr.width/dimensions.width;
    if(!(scale>0))return null;
    const css=getComputedStyle(element);
    const copied:CSSProperties={fontFamily:css.fontFamily,fontSize:css.fontSize,fontWeight:css.fontWeight,fontStyle:css.fontStyle,
      lineHeight:css.lineHeight,letterSpacing:css.letterSpacing,textAlign:css.textAlign as CSSProperties['textAlign'],
      textTransform:css.textTransform as CSSProperties['textTransform'],textDecoration:css.textDecoration,
      direction:css.direction as CSSProperties['direction'],color:css.color,background:css.background,
      padding:css.padding,border:css.border,borderRadius:css.borderRadius,boxShadow:css.boxShadow,opacity:css.opacity};
    return {page,style:copied,box:{x:(rect.left-pr.left)/scale,y:(rect.top-pr.top)/scale,widthMm:rect.width/scale}};
  },[dimensions.width]);
  useLayoutEffect(()=>{
    const calculate=()=>{
      const next=readLayer();
      if(next)setLayer(previous=>previous?.page===next.page&&JSON.stringify(previous.style)===JSON.stringify(next.style)&&JSON.stringify(previous.box)===JSON.stringify(next.box)?previous:next);
    };
    calculate();document.fonts?.addEventListener('loadingdone',calculate);
    return ()=>document.fonts?.removeEventListener('loadingdone',calculate);
  // Computed typography must follow all existing controls, including scoped CSS.
  },[doc,className,overlay,text,readLayer]);

  const draw=(box:HeroCaptionBox)=>{
    const element=floating.current;if(!element)return;
    element.style.left=`${box.x}mm`;element.style.top=`${box.y}mm`;element.style.width=`${box.widthMm}mm`;
  };
  const save=useCallback((box:HeroCaptionBox)=>update(current=>{current.design[key]={...box};}),[update,key]);
  useEffect(()=>{
    const move=(event:PointerEvent)=>{
      const current=gesture.current;if(!current||event.pointerId!==current.pointer||readOnly)return;
      const dx=event.clientX-current.x,dy=event.clientY-current.y;
      if(!current.moved&&Math.hypot(dx,dy)<3)return;
      event.preventDefault();event.stopPropagation();
      const next=boundedHeroCaption({...current.box,x:current.box.x+dx/current.scale,y:current.box.y+dy/current.scale},dimensions,(floating.current?.offsetHeight??0)/MM);
      if(!current.moved){setDraft(next);current.moved=true;}
      current.next=next;draw(next);
      if(floating.current)floating.current.dataset.captionDragging='true';
    };
    const finish=(event:PointerEvent)=>{
      const current=gesture.current;if(!current||event.pointerId!==current.pointer)return;
      gesture.current=null;
      if(floating.current)delete floating.current.dataset.captionDragging;
      if(event.type==='pointerup'&&current.moved&&!readOnly)save(boundedHeroCaption(current.next,dimensions,(floating.current?.offsetHeight??source.current?.offsetHeight??0)/MM));
      else if(placement)draw(boundedHeroCaption(placement,dimensions,(floating.current?.offsetHeight??0)/MM));
      setDraft(null);
    };
    window.addEventListener('pointermove',move,{capture:true,passive:false});window.addEventListener('pointerup',finish,true);window.addEventListener('pointercancel',finish,true);
    return ()=>{window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',finish,true);window.removeEventListener('pointercancel',finish,true);};
  },[readOnly,placement,dimensions,save]);

  const free=!!layer&&(!!placement||!!draft);
  const box=boundedHeroCaption(draft??placement??layer?.box??{x:0,y:0,widthMm:40},dimensions);
  useLayoutEffect(()=>{
    const element=floating.current;if(!free||!element||gesture.current)return;
    draw(boundedHeroCaption(box,dimensions,element.offsetHeight/MM));
    const rect=element.getBoundingClientRect(),page=layer!.page.getBoundingClientRect();
    const signature=[target,rect.left-page.left,rect.top-page.top,rect.width,rect.height].map(v=>typeof v==='number'?v.toFixed(2):v).join(':');
    if(notification.current!==signature){notification.current=signature;window.dispatchEvent(new Event(HERO_CAPTION_LAYOUT_EVENT));}
  });
  const down=(event:ReactPointerEvent<HTMLElement>)=>{
    if(readOnly||event.button!==0)return;
    const context=readLayer();if(!context)return;
    const page=context.page.getBoundingClientRect(),rect=event.currentTarget.getBoundingClientRect();
    const scale=page.width/dimensions.width;if(!(scale>0))return;
    event.preventDefault();event.stopPropagation();event.currentTarget.focus({preventScroll:true});setLayer(context);
    const current={x:(rect.left-page.left)/scale,y:(rect.top-page.top)/scale,widthMm:rect.width/scale};
    gesture.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,scale,box:current,next:current,moved:false};
  };
  const keyboard=(event:React.KeyboardEvent<HTMLElement>)=>{
    if(readOnly||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    const context=readLayer();if(!context)return;
    event.preventDefault();event.stopPropagation();const current=placement??context.box,step=event.shiftKey?5:1;
    save(boundedHeroCaption({...current,x:current.x+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0),y:current.y+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0)},dimensions,event.currentTarget.offsetHeight/MM));
  };
  const grip=!readOnly&&<button type="button" className="hero-caption-grip" data-editor-only="true" aria-label={cover?'Move cover caption':'Move hero caption'} title="Drag caption freely · arrows move 1 mm · Shift moves 5 mm">
    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2v16M2 10h16M7 5l3-3 3 3M7 15l3 3 3-3M5 7l-3 3 3 3M15 7l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
  </button>;
  if(!text.trim())return null;
  return <>
    <Tag ref={source as React.Ref<never>} className={classes} style={style}
      data-hero-caption-source={target} data-hero-caption-placeholder={free?'true':undefined} aria-hidden={free?true:undefined}
      data-editor-tab="images" data-editor-target={target} data-movable-hero-caption={!readOnly&&!free?'true':undefined}
      tabIndex={!readOnly&&!free?0:undefined} onPointerDown={down} onKeyDown={keyboard}>
      {text}{!free&&grip}
    </Tag>
    {free&&createPortal(<p ref={floating} className="free-hero-caption" data-hero-caption-floating={target} data-callout-obstacle="true"
      data-editor-tab="images" data-editor-target={target} data-movable-hero-caption={!readOnly?'true':undefined}
      tabIndex={!readOnly?0:undefined} onPointerDown={down} onKeyDown={keyboard}
      style={{...layer!.style,left:`${box.x}mm`,top:`${box.y}mm`,width:`${box.widthMm}mm`}}>{text}{grip}</p>,layer!.page)}
  </>;
}
