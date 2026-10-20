/** @jsxImportSource ../lib/mathJsx */
import {
  useLayoutEffect,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {DEFAULT_TOP_BAR_OFFSET,type Asset, type Design, type Doc, type PlacedImage } from '../schema/document';
import { PAGE_H, grid } from '../lib/geometry';
import {PhotoToolIcon} from '../components/PhotoToolIcon';
import { pageDimensions } from '../lib/pageFormat';
import {imageCaptionObstacle,safeCaptionPosition,type CaptionBox,type CaptionObstacle} from '../lib/imageCaption';
import {footerBottomMargin} from '../lib/pageFooter';
import {TOP_BAR_HEIGHT_MM} from '../lib/topBar';
import { placedImageGeometry, snapImageColumn } from '../lib/placedImage';
import {cropPoints} from '../lib/imageCrop';
import { defaultPlacedHighlights, placedHighlightsGeometry, highlightAvoidingTop } from '../lib/placedHighlights';
import { articleGridDesign, isReferenceArticle } from '../lib/articleLayouts';
import { useDoc } from '../store/useDoc';
import { HighlightsBody } from './Sidebar';
import { FramedImage } from '../components/FramedImage';
import {SpreadPhotoImage} from '../components/SpreadPhotoImage';
import {linkedSpreadPhoto} from '../lib/linkedSpread';
import { usePreviewReadOnly, usePreserveSourceAnchors } from './PreviewReadOnly';
import {DRAW_IMAGE_OUTLINE_EVENT,requestImageOutline} from '../lib/imageCanvas';
import {CanvasImageOutline} from './CanvasImageOutline';

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startLeft: number;
  startTop: number;
  pxPerMm: number;
  column: number;
  top: number;
  moved?: boolean;
  originalStyle?: string;
}

interface HighlightDragState extends DragState {
  height: number;
}

/** Find the nearest vertical slot which does not overlap an image sharing the
 * selected physical columns. Coordinates are unscaled page millimetres. */
function imageAvoidingTop(
  page: HTMLElement,
  desiredTop: number,
  left: number,
  width: number,
  height: number,
  pxPerMm: number,
  gap: number,
  pageHeight = PAGE_H,
): number {
  const clamped = Math.min(Math.max(0, desiredTop), Math.max(0, pageHeight - height));
  if (pxPerMm <= 0 || height <= 0) return clamped;
  const pageRect = page.getBoundingClientRect();
  const right = left + width;
  const bands = Array.from(page.querySelectorAll<HTMLElement>('.placed-image, [data-callout-obstacle]'))
    .map((image) => image.getBoundingClientRect())
    .filter((rect) => {
      const imageLeft = (rect.left - pageRect.left) / pxPerMm;
      const imageRight = (rect.right - pageRect.left) / pxPerMm;
      return Math.min(right, imageRight) - Math.max(left, imageLeft) > 0.2;
    })
    .map((rect) => ({
      top: Math.max(0, (rect.top - pageRect.top) / pxPerMm - gap),
      bottom: Math.min(pageHeight, (rect.bottom - pageRect.top) / pxPerMm + gap),
    }))
    .sort((a, b) => a.top - b.top);
  return highlightAvoidingTop(clamped, height, pageHeight, bands);
}

function PlacedImageItem({
  image,
  asset,
  design,
  pageHeight,
  readOnly,
  doc,
}: {
  image: PlacedImage;
  asset: Asset;
  design: Design;
  pageHeight: number;
  readOnly: boolean;
  doc:Doc;
}) {
  const update = useDoc((state) => state.update);
  const drag = useRef<DragState | null>(null);
  const figureRef=useRef<HTMLElement>(null);
  const [outlineEditing,setOutlineEditing]=useState(false);
  const closeOutline=useCallback(()=>setOutlineEditing(false),[]);
  useEffect(()=>{if(readOnly)closeOutline();},[readOnly,closeOutline]);
  useEffect(()=>{
    const draw=(event:Event)=>{
      const requested=(event as CustomEvent<{imageId:string}>).detail?.imageId===image.id;
      setOutlineEditing(requested&&!readOnly);
      if(requested&&!readOnly)figureRef.current?.scrollIntoView?.({block:'center',inline:'nearest',behavior:'smooth'});
    };
    window.addEventListener(DRAW_IMAGE_OUTLINE_EVENT,draw);
    return ()=>window.removeEventListener(DRAW_IMAGE_OUTLINE_EVENT,draw);
  },[image.id,readOnly]);
  const geometry = placedImageGeometry(image, asset, design, pageHeight);
  const linkedPhoto=linkedSpreadPhoto(doc,image,design,pageHeight);
  const captionRef=useRef<HTMLElement>(null);
  const captionDrag=useRef<{pointer:number;startX:number;startY:number;box:CaptionBox;scale:number;resolved:CaptionBox;originalStyle:string;originalFit?:string;moved?:boolean}|null>(null);
  const captionResize=useRef<{pointer:number;startX:number;box:CaptionBox;scale:number;side:'left'|'right';resolved:CaptionBox;originalStyle:string;originalFit?:string;moved?:boolean}|null>(null);
  const freeCaption=!!image.captionPlacement||image.wrapShape==='polygon';
  const captionWidth=Math.max(5,Math.min(pageDimensions(design).width,Number.isFinite(image.captionPlacement?.widthMm)?image.captionPlacement!.widthMm:geometry.width));
  const captionObstacles=useMemo(()=>{
    const obstacles=(doc.images??[]).filter(i=>i.anchor.page===image.anchor.page&&doc.assets[i.assetId])
      .map(i=>imageCaptionObstacle(i,doc.assets[i.assetId],design,pageHeight));
    const rectangle=(top:number,bottom:number):CaptionObstacle=>({gap:0,points:[{x:0,y:top},{x:pageDimensions(design).width,y:top},{x:pageDimensions(design).width,y:bottom},{x:0,y:bottom}]});
    const top=design.showTopBar===false?design.margin:Math.max(design.margin,(design.topBarOffset??DEFAULT_TOP_BAR_OFFSET)+TOP_BAR_HEIGHT_MM+1);
    obstacles.push(rectangle(0,Math.max(1,top)),rectangle(pageHeight-footerBottomMargin(doc),pageHeight));
    return obstacles;
  },[doc,design,image.anchor.page,pageHeight]);
  const positionCaption=useCallback((element:HTMLElement,desired:CaptionBox,manual=!!image.captionPlacement)=>{
    const obstacles=[...captionObstacles];
    const page=element.closest<HTMLElement>('.page,[data-article-image-page]');
    if(page&&!manual){
      const pageRect=page.getBoundingClientRect(),scale=pageRect.width/pageDimensions(design).width;
      if(scale>0){
        const captions=Array.from(page.querySelectorAll<HTMLElement>('.placed-image > figcaption'));
        const index=captions.indexOf(element);
        for(const other of captions.filter((c,i)=>c!==element&&(i<index||!c.parentElement?.classList.contains('placed-image--free-caption')))){
          const box=other.getBoundingClientRect();if(!box.width||!box.height)continue;
          const left=(box.left-pageRect.left)/scale,right=(box.right-pageRect.left)/scale,top=(box.top-pageRect.top)/scale,bottom=(box.bottom-pageRect.top)/scale;
          obstacles.push({gap:.8,points:[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}]});
        }
      }
    }
    // Explicit coordinates and canvas gestures belong to the author. Keep
    // them on the sheet, but never snap them out of an image or another box.
    const resolved=safeCaptionPosition(desired,pageDimensions(design).width,pageHeight,manual?[]:obstacles);
    element.style.position='absolute';element.style.left=`${resolved.x-geometry.visualLeft}mm`;
    element.style.top=`${resolved.y-geometry.visualTop}mm`;element.style.bottom='auto';
    element.style.width=`${resolved.width}mm`;element.style.marginLeft='0';element.style.transform='none';
    element.dataset.captionUnplaced=String(!resolved.fits);
    return resolved;
  },[captionObstacles,design,pageHeight,geometry.visualLeft,geometry.visualTop,image.captionPlacement]);
  useLayoutEffect(()=>{
    if(!freeCaption||!captionRef.current)return;
    const element=captionRef.current;
    const calculate=()=>{
      if(captionDrag.current||captionResize.current)return;
      const bottom=geometry.visualTop+geometry.visualHeight*Math.max(...cropPoints(image.frame?.crop).map(p=>p.y))/100;
      positionCaption(element,{x:Number.isFinite(image.captionPlacement?.x)?image.captionPlacement!.x:geometry.left,
        y:Number.isFinite(image.captionPlacement?.y)?image.captionPlacement!.y:bottom+1,width:captionWidth,height:element.offsetHeight/(96/25.4)});
    };
    calculate();document.fonts?.addEventListener('loadingdone',calculate);
    return ()=>document.fonts?.removeEventListener('loadingdone',calculate);
  },[image,asset,design,pageHeight,doc.images,doc.assets,captionWidth,freeCaption,positionCaption,geometry.visualTop,geometry.left,geometry.visualHeight]);
  const startCaptionDrag=(event:ReactPointerEvent<HTMLElement>)=>{
    if(readOnly||event.button!==0)return;
    const page=event.currentTarget.closest<HTMLElement>('.page');if(!page)return;
    event.preventDefault();event.stopPropagation();
    const scale=page.getBoundingClientRect().width/pageDimensions(design).width;if(scale<=0)return;
    const pageRect=page.getBoundingClientRect(),box=event.currentTarget.getBoundingClientRect();
    const placement={x:(box.left-pageRect.left)/scale,y:(box.top-pageRect.top)/scale,width:box.width/scale,height:box.height/scale};
    captionDrag.current={pointer:event.pointerId,startX:event.clientX,startY:event.clientY,box:placement,scale,resolved:placement,originalStyle:event.currentTarget.getAttribute('style')??'',originalFit:event.currentTarget.dataset.captionUnplaced};
    event.currentTarget.dataset.captionDragging='true';
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveCaption=(event:ReactPointerEvent<HTMLElement>)=>{
    const state=captionDrag.current;if(!state||state.pointer!==event.pointerId)return;
    event.stopPropagation();
    if(!state.moved&&Math.hypot(event.clientX-state.startX,event.clientY-state.startY)<2)return;
    state.moved=true;
    state.resolved=positionCaption(event.currentTarget,{...state.box,x:state.box.x+(event.clientX-state.startX)/state.scale,y:state.box.y+(event.clientY-state.startY)/state.scale},true);
  };
  const finishCaption=(event:ReactPointerEvent<HTMLElement>)=>{
    const state=captionDrag.current;if(!state||state.pointer!==event.pointerId)return;
    event.stopPropagation();captionDrag.current=null;
    delete event.currentTarget.dataset.captionDragging;
    if(state.moved)update(current=>{const i=current.images?.find(i=>i.id===image.id);if(i)i.captionPlacement={x:Math.round(state.resolved.x*100)/100,y:Math.round(state.resolved.y*100)/100,widthMm:Math.round(state.resolved.width*100)/100};});
    if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const cancelCaption=(event:ReactPointerEvent<HTMLElement>)=>{
    const state=captionDrag.current;if(!state||state.pointer!==event.pointerId)return;
    event.stopPropagation();captionDrag.current=null;event.currentTarget.setAttribute('style',state.originalStyle);
    delete event.currentTarget.dataset.captionDragging;
    if(state.originalFit===undefined)delete event.currentTarget.dataset.captionUnplaced;
    else event.currentTarget.dataset.captionUnplaced=state.originalFit;
  };

  const captionBox=(element:HTMLElement)=>{
    const page=element.closest<HTMLElement>('.page');if(!page)return;
    const pageRect=page.getBoundingClientRect(),rect=element.getBoundingClientRect(),scale=pageRect.width/pageDimensions(design).width;
    if(!(scale>0))return;
    return {scale,box:{x:(rect.left-pageRect.left)/scale,y:(rect.top-pageRect.top)/scale,width:rect.width/scale,height:rect.height/scale}};
  };
  const resizeCaption=(element:HTMLElement,box:CaptionBox,width:number,side:'left'|'right')=>{
    const pageWidth=pageDimensions(design).width;
    const bounded=Math.max(5,Math.min(side==='left'?box.x+box.width:pageWidth-box.x,width));
    element.style.width=`${bounded}mm`;
    return positionCaption(element,{...box,x:side==='left'?box.x+box.width-bounded:box.x,width:bounded,height:element.offsetHeight/(96/25.4)},true);
  };
  const saveCaption=(box:CaptionBox)=>update(current=>{
    const source=current.images?.find(i=>i.id===image.id);
    if(source)source.captionPlacement={x:Math.round(box.x*100)/100,y:Math.round(box.y*100)/100,widthMm:Math.round(box.width*100)/100};
  });
  const startResize=(event:ReactPointerEvent<HTMLButtonElement>,side:'left'|'right')=>{
    if(readOnly||event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    const element=captionRef.current;if(!element)return;
    const start=captionBox(element);if(!start)return;
    captionResize.current={pointer:event.pointerId,startX:event.clientX,...start,side,resolved:start.box,originalStyle:element.getAttribute('style')??'',originalFit:element.dataset.captionUnplaced};
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveResize=(event:ReactPointerEvent<HTMLButtonElement>)=>{
    const state=captionResize.current,element=captionRef.current;if(!state||!element||state.pointer!==event.pointerId)return;
    event.stopPropagation();const dx=event.clientX-state.startX;
    if(!state.moved&&Math.abs(dx)<3)return;
    state.moved=true;
    state.resolved=resizeCaption(element,state.box,state.box.width+(state.side==='left'?-dx:dx)/state.scale,state.side);
  };
  const finishResize=(event:ReactPointerEvent<HTMLButtonElement>,cancel=false)=>{
    const state=captionResize.current,element=captionRef.current;if(!state||!element||state.pointer!==event.pointerId)return;
    event.stopPropagation();captionResize.current=null;
    if(cancel){
      element.setAttribute('style',state.originalStyle);
      if(state.originalFit===undefined)delete element.dataset.captionUnplaced;
      else element.dataset.captionUnplaced=state.originalFit;
    }
    else if(state.moved)saveCaption(state.resolved);
    if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const applyGeometry = (element: HTMLElement, next: typeof geometry) => {
    element.style.left = `${next.visualLeft}mm`;
    element.style.top = `${next.visualTop}mm`;
    element.style.width = `${next.visualWidth}mm`;
    element.style.setProperty('--placed-image-h', `${next.visualHeight}mm`);
    element.style.setProperty('--placed-caption-left', `${next.captionLeft}mm`);
    element.style.setProperty('--placed-caption-width', `${next.width}mm`);
    element.style.setProperty('--placed-caption-space', `${Math.max(0, pageHeight - next.visualTop - next.visualHeight)}mm`);
    element.style.setProperty('--placed-polygon-tail', `${next.visualHeight*(1-Math.max(...cropPoints(image.frame?.crop).map(point=>point.y))/100)}mm`);
  };

  const commitAnchor = (column: number, y: number) =>
    update((doc) => {
      const current = doc.images?.find((candidate) => candidate.id === image.id);
      if (!current) return;
      current.anchor.column = column;
      current.anchor.y = y;
    });

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (readOnly || outlineEditing || event.button !== 0) return;
    const page = event.currentTarget.closest<HTMLElement>('.page');
    if (!page) return;
    const pageRect = page.getBoundingClientRect();
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    delete event.currentTarget.dataset.dragMoved;
    drag.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: geometry.left,
      startTop: geometry.top,
      pxPerMm: pageRect.width / pageDimensions(design).width,
      column: geometry.column,
      top: geometry.top,
      originalStyle: event.currentTarget.getAttribute('style') ?? '',
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId || state.pxPerMm <= 0) return;
    if(!state.moved&&Math.hypot(event.clientX-state.startClientX,event.clientY-state.startClientY)<3)return;
    state.moved=true;
    event.currentTarget.dataset.dragging='true';
    event.currentTarget.dataset.dragMoved='true';
    const nextLeft = state.startLeft + (event.clientX - state.startClientX) / state.pxPerMm;
    const nextTop = state.startTop + (event.clientY - state.startClientY) / state.pxPerMm;
    const column = snapImageColumn(nextLeft, geometry.widthCols, design);
    const y = Math.min(geometry.maxTop, Math.max(0, nextTop));
    const roundedTop = Math.round(y * 10) / 10;
    state.column = column;
    state.top = roundedTop;

    // Dragging is a visual preview only. Updating the document here used to
    // structured-clone every embedded image and re-paginate the whole article
    // for every pointer event, which made the handle feel several frames
    // behind the cursor. Commit once on release instead.
    const nextGeometry = placedImageGeometry(
      { ...image, anchor: { ...image.anchor, column, y: roundedTop } },
      asset,
      design,
      pageHeight,
    );
    applyGeometry(event.currentTarget, nextGeometry);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    const state = drag.current;
    drag.current = null;
    delete event.currentTarget.dataset.dragging;
    if(state.moved)commitAnchor(state.column, state.top);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const cancelDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const state=drag.current;if(!state||state.pointerId!==event.pointerId)return;
    drag.current=null;
    event.currentTarget.setAttribute('style',state.originalStyle??'');
    delete event.currentTarget.dataset.dragging;
    delete event.currentTarget.dataset.dragMoved;
  };

  const style = {
    left: `${geometry.visualLeft}mm`,
    top: `${geometry.visualTop}mm`,
    width: `${geometry.visualWidth}mm`,
    '--placed-image-h': `${geometry.visualHeight}mm`,
    '--placed-caption-left': `${geometry.captionLeft}mm`,
    '--placed-caption-width': `${geometry.width}mm`,
    '--placed-caption-space': `${Math.max(0, pageHeight - geometry.visualTop - geometry.visualHeight)}mm`,
    '--placed-polygon-tail': `${geometry.visualHeight * (1-Math.max(...cropPoints(image.frame?.crop).map(point=>point.y))/100)}mm`,
  } as CSSProperties;
  const hasBleed = Boolean(
    image.bleed?.left || image.bleed?.right || image.bleed?.top || image.bleed?.bottom,
  );

  return (
    <figure
      ref={figureRef}
      className={`placed-image${hasBleed ? ' placed-image--bleed' : ''}${
        image.wrapShape === 'contour' || image.wrapShape === 'polygon' ? ' placed-image--contour' : ''
      }${image.wrapShape === 'polygon' ? ' placed-image--polygon' : ''}${
        image.bleed?.bottom ? ' placed-image--caption-overlay' : ''
      }${freeCaption?' placed-image--free-caption':''}`}
      style={style}
      data-image-id={image.id}
      data-image-readonly={readOnly ? 'true' : undefined}
      data-outline-editing={outlineEditing&&!readOnly ? 'true' : undefined}
      data-editor-tab="images"
      data-editor-target={`article-image-${image.id}`}
      aria-label={`Placed image, ${geometry.widthCols} columns wide`}
      title={readOnly ? undefined : 'Drag to position · horizontal movement snaps to columns'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={cancelDrag}
      onLostPointerCapture={cancelDrag}
    >
      <div className="placed-image-frame">
        {linkedPhoto?<SpreadPhotoImage asset={linkedPhoto.asset} geometry={linkedPhoto.geometry} frame={linkedPhoto.frame} region={linkedPhoto}/>:<FramedImage asset={asset} frame={image.frame} />}
      </div>
      {!readOnly && !outlineEditing && <div className="placed-image-tools" data-editor-only="true"><button type="button" className="placed-image-move" data-editor-only="true"
        aria-label="Move image" title="Move image" aria-description="Drag to position. Arrow keys move one column or 1 mm; Shift with up or down moves 5 mm."
        onKeyDown={event=>{
          if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
          event.preventDefault();event.stopPropagation();
          const step=event.shiftKey?5:1;
          const column=event.key==='ArrowLeft'?geometry.column-1:event.key==='ArrowRight'?geometry.column+1:geometry.column;
          const y=event.key==='ArrowUp'?geometry.top-step:event.key==='ArrowDown'?geometry.top+step:geometry.top;
          commitAnchor(Math.max(0,Math.min(column,grid(design).totalCols-geometry.widthCols)),Math.max(0,Math.min(y,geometry.maxTop)));
        }}>
        <PhotoToolIcon name="move"/>
      </button><button type="button" className="placed-image-draw" aria-label="Edit wrap points" title="Edit text-wrap boundary" onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();requestImageOutline(image.id);}}><PhotoToolIcon name="wrap"/></button></div>}
      {!readOnly&&outlineEditing&&<CanvasImageOutline image={image} asset={asset} onCancel={closeOutline}
        onApply={(points,smoothing,gap)=>{
          update(current=>{const source=current.images?.find(i=>i.id===image.id);if(source){source.wrapShape='polygon';source.wrapPolygon=points;source.wrapSmoothing=smoothing;source.wrapGapMm=gap;}});
          closeOutline();
        }}/>}
      {image.caption.trim() && (
        <figcaption
          ref={captionRef}
          data-editor-tab="images"
          data-editor-target={`article-caption-${image.id}`}
          dir={design.textDirection ?? 'ltr'}
          style={{ textAlign: image.align ?? 'left',...(freeCaption?{width:`${captionWidth}mm`}:{}) }}
          title={readOnly?undefined:'Drag caption anywhere on the page, including over the image'}
          onPointerDown={startCaptionDrag} onPointerMove={moveCaption} onPointerUp={finishCaption}
          onPointerCancel={cancelCaption} onLostPointerCapture={cancelCaption}
        >
          <span className="placed-caption-text">{image.caption}</span>
          {!readOnly&&!outlineEditing&&(['left','right'] as const).map(side=><button type="button" key={side}
            className={`caption-resize caption-resize--${side}`} data-editor-only="true" aria-label={`Resize caption from ${side}`} title="Drag to resize caption · arrows adjust width"
            onPointerDown={event=>startResize(event,side)} onPointerMove={moveResize}
            onPointerUp={event=>finishResize(event)} onPointerCancel={event=>finishResize(event,true)} onLostPointerCapture={event=>finishResize(event,true)}
            onClick={event=>event.stopPropagation()}
            onKeyDown={event=>{
              if(!['ArrowLeft','ArrowRight'].includes(event.key)||!captionRef.current)return;
              event.preventDefault();event.stopPropagation();const start=captionBox(captionRef.current);if(!start)return;
              const delta=(event.key==='ArrowRight'?1:-1)*(side==='left'?-1:1)*(event.shiftKey?5:1);
              saveCaption(resizeCaption(captionRef.current,start.box,start.box.width+delta,side));
            }}/>)}
        </figcaption>
      )}
    </figure>
  );
}

function PlacedHighlightsItem({ doc, design, pageHeight, readOnly }: { doc: Doc; design: Design; pageHeight: number; readOnly: boolean }) {
  const update = useDoc((state) => state.update);
  const preserveSourceAnchors = usePreserveSourceAnchors();
  const elementRef = useRef<HTMLElement>(null);
  const drag = useRef<HighlightDragState | null>(null);
  const placement = doc.highlightBox ?? defaultPlacedHighlights(design, pageHeight);
  const geometry = placedHighlightsGeometry(placement, design, 0, pageHeight);

  const commitAnchor = useCallback((column: number, y: number) =>
    update((currentDoc) => {
      currentDoc.highlightBox ??= defaultPlacedHighlights(design, pageHeight);
      currentDoc.highlightBox.anchor.page = placement.anchor.page;
      currentDoc.highlightBox.anchor.column = column;
      currentDoc.highlightBox.anchor.y = y;
    }), [update, design, pageHeight, placement.anchor.page]);

  // Content/font/image changes can alter the callout's real height. Keep the
  // stored anchor valid and move it to the nearest image-free slot when one is
  // available, so a newly enlarged box cannot silently cover a photograph.
  useLayoutEffect(() => {
    const element = elementRef.current;
    const page = element?.closest<HTMLElement>('.page');
    if (!element || !page) return;
    // ArticlePages already chose a safe position and paginated around that
    // exact box. Relocating it again here invalidates its text exclusions.
    if(isReferenceArticle(doc.templateId))return;
    // Persist the design default even while the preview is hidden or has not
    // received a measurable width yet. Without this early commit, a loaded
    // free-placement document could be autosaved before its first layout and
    // lose the box's position on the next open.
    const canCommit = !readOnly && !preserveSourceAnchors && !design.pageFormat && !element.closest('[inert]');
    if (canCommit && !doc.highlightBox) commitAnchor(placement.anchor.column, placement.anchor.y);
    if (!page.offsetWidth) return;
    const pxPerMm = page.getBoundingClientRect().width / pageDimensions(design).width;
    const height = element.getBoundingClientRect().height / pxPerMm;
    const measured = placedHighlightsGeometry(placement, design, height, pageHeight);
    const safeTop = imageAvoidingTop(
      page,
      measured.top,
      measured.left,
      measured.width,
      height,
      pxPerMm,
      Math.max(3, doc.design.gutter * 0.6),
      pageHeight,
    );
    const rounded = Math.round(safeTop * 10) / 10;
    element.style.top = `${rounded}mm`;
    // Materialise the default placement as soon as the free box is rendered.
    // Without this, a box that had never been dragged existed only as a
    // computed fallback and could disappear or move after an autosave/reload.
    if (canCommit && (!doc.highlightBox || Math.abs(rounded - placement.anchor.y) > 0.05)) commitAnchor(measured.column, rounded);
  }, [commitAnchor, doc.assets, doc.design, doc.templateId, doc.highlightBox, doc.highlights, doc.images, doc.references, placement, design, pageHeight, readOnly, preserveSourceAnchors]);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (readOnly || event.button !== 0) return;
    const page = event.currentTarget.closest<HTMLElement>('.page');
    if (!page) return;
    const pxPerMm = page.getBoundingClientRect().width / pageDimensions(design).width;
    if (pxPerMm <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startTop = parseFloat(event.currentTarget.style.top) || geometry.top;
    drag.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: geometry.left,
      startTop,
      pxPerMm,
      column: geometry.column,
      top: startTop,
      height: event.currentTarget.getBoundingClientRect().height / pxPerMm,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const page = event.currentTarget.closest<HTMLElement>('.page');
    if (!page) return;
    const nextLeft = state.startLeft + (event.clientX - state.startClientX) / state.pxPerMm;
    const desiredTop = state.startTop + (event.clientY - state.startClientY) / state.pxPerMm;
    const column = snapImageColumn(nextLeft, geometry.widthCols, design);
    const candidate = placedHighlightsGeometry(
      { ...placement, anchor: { ...placement.anchor, column, y: desiredTop } },
      design,
      state.height,
      pageHeight,
    );
    const top = imageAvoidingTop(
      page,
      candidate.top,
      candidate.left,
      candidate.width,
      state.height,
      state.pxPerMm,
      Math.max(3, doc.design.gutter * 0.6),
      pageHeight,
    );
    const rounded = Math.round(top * 10) / 10;
    state.column = column;
    state.top = rounded;
    event.currentTarget.style.left = `${candidate.left}mm`;
    event.currentTarget.style.top = `${rounded}mm`;
  };

  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    const state = drag.current;
    drag.current = null;
    commitAnchor(state.column, state.top);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <aside
      ref={elementRef}
      className="placed-highlights"
      data-editor-tab="highlights"
      data-editor-target="highlights"
      style={{ left: `${geometry.left}mm`, top: `${geometry.top}mm`, width: `${geometry.width}mm` }}
      dir={doc.design.textDirection ?? 'ltr'}
      aria-label={`Highlights box, ${geometry.widthCols} columns wide`}
      title={readOnly ? undefined : 'Drag to position · horizontal movement snaps to columns'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
    >
      <HighlightsBody doc={doc} />
    </aside>
  );
}

/** Absolute image overlay for one physical sheet. */
export function PlacedImages({ doc, pageIndex, pageHeight = pageDimensions(doc.design).height, readOnly = false, includeHighlights = true }: { doc: Doc; pageIndex: number; pageHeight?: number; readOnly?: boolean; includeHighlights?: boolean }) {
  const inheritedReadOnly = usePreviewReadOnly();
  readOnly = readOnly || inheritedReadOnly;
  const design = isReferenceArticle(doc.templateId) ? articleGridDesign(doc.design) : doc.design;
  const images = (doc.images ?? []).filter((image) => image.anchor.page === pageIndex + 1);
  const showHighlights =
    includeHighlights && doc.design.sidebar &&
    doc.design.highlightsPlacement === 'free' &&
    (doc.highlights.some((item) => item.trim()) || doc.references.length > 0) &&
    (doc.highlightBox ?? defaultPlacedHighlights(design, pageHeight)).anchor.page === pageIndex + 1;
  if (!images.length && !showHighlights) return null;

  return (
    <div className="placed-images" aria-label={`Images on page ${pageIndex + 1}`}>
      {images.map((image) => {
        const asset = doc.assets[image.assetId];
        return asset ? (
          <PlacedImageItem key={image.id} image={image} asset={asset} design={design} pageHeight={pageHeight} readOnly={readOnly} doc={doc}/>
        ) : null;
      })}
      {showHighlights && <PlacedHighlightsItem doc={doc} design={design} pageHeight={pageHeight} readOnly={readOnly}/>}
    </div>
  );
}
