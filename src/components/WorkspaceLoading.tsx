import type {CSSProperties,ReactNode} from 'react';
import {paperSize,type PdfPageSize} from '../lib/pdfPageSize';
import './WorkspaceLoading.css';

/** Match destination chrome; never invent article cards, page counts or copy
 * before the response arrives. Known paper dimensions reserve the real ratio. */
export function WorkspaceLoading({destination,children,canvasOnly=false,showToolbar=true,pageSize,panelWidth=380}:{destination:'editor'|'issue'|'library';children:ReactNode;canvasOnly?:boolean;showToolbar?:boolean;pageSize?:PdfPageSize;panelWidth?:number}){
 const size=pageSize?paperSize(pageSize):undefined;
 const style={'--loading-panel':`${panelWidth}px`,...(size?{'--loading-paper-ratio':`${size.width} / ${size.height}`}:{})} as CSSProperties;
 return <div className={`workspace-loading workspace-loading--${destination}${canvasOnly?' is-canvas-only':''}`} style={style} data-loading-destination={destination}>
  {!canvasOnly&&showToolbar&&<div className="workspace-loading-toolbar" aria-hidden="true"><i/><span/><span/><span/></div>}
  <div className="workspace-loading-layout">
   {!canvasOnly&&destination!=='library'&&<div className="workspace-loading-inspector" aria-hidden="true"><div className="workspace-loading-tabs"><i/><i/><i/></div><div className="workspace-loading-field"/><div className="workspace-loading-field"/><div className="workspace-loading-field is-tall"/></div>}
   <div className="workspace-loading-content">
    {destination==='library'&&<div className="workspace-loading-filters" aria-hidden="true"><i/><i/><i/></div>}
    <div className={`workspace-loading-canvas${size?' has-paper-size':''}`}>
     {size&&<div className="workspace-loading-paper" aria-hidden="true"/>}
     <div className="workspace-loading-status">{children}</div>
    </div>
   </div>
  </div>
 </div>;
}
