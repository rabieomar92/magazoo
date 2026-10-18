import { useEffect, useState } from 'react';
import { renderIssuePdf } from './externalPdf';
import type { ExternalIssuePdf } from './model';
import { pageDimensions } from '../lib/pageFormat';
import type { PdfPageSize } from '../lib/pdfPageSize';
import { BusyIndicator } from '../components/BusyIndicator';

export function externalPdfSheet(src: string, size: PdfPageSize): HTMLElement {
  const dimensions = pageDimensions({pageFormat:size});
  const sheet = document.createElement('div');
  sheet.className='page issue-external-pdf-page';
  sheet.dataset.pageWidthMm=String(dimensions.width);sheet.dataset.pageHeightMm=String(dimensions.height);
  sheet.style.cssText=`width:${dimensions.width}mm;height:${dimensions.height}mm;position:relative;padding:0;background:#fff;overflow:hidden;`;
  const image=document.createElement('img');image.src=src;image.alt='Imported PDF page';
  image.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;';
  sheet.append(image); return sheet;
}

export function ExternalPdfPages({ pdf, size }: {pdf:ExternalIssuePdf;size:PdfPageSize}) {
  const [state,setState]=useState<{urls:string[];error:string}>({urls:[],error:''});
  useEffect(()=>{
    let alive=true;
    setState({urls:[],error:''});
    void renderIssuePdf(pdf).then(urls=>{if(alive)setState({urls,error:''});}).catch(error=>{if(alive)setState({urls:[],error:error instanceof Error?error.message:'Could not prepare the PDF.'});});
    return ()=>{alive=false;};
  },[pdf]);
  const dimensions=pageDimensions({pageFormat:size});
  return <div className="pages issue-external-pdf-pages" data-preview-pending={!state.urls.length&&!state.error?'true':undefined}>
    {state.error && <div role="alert" data-layout-overflow="true" className="page">{state.error}</div>}
    {!state.urls.length&&!state.error&&<div className="issue-external-pdf-loading"><BusyIndicator label={`Preparing ${pdf.name}…`} /></div>}
    {state.urls.map((src,index)=><div key={src} className="page issue-external-pdf-page" data-page-width-mm={dimensions.width} data-page-height-mm={dimensions.height} style={{width:`${dimensions.width}mm`,height:`${dimensions.height}mm`,position:'relative',padding:0,background:'#fff',overflow:'hidden'}}><img src={src} alt={`${pdf.name}, page ${index+1}`} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain'}} /></div>)}
  </div>;
}
