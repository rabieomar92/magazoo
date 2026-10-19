/** Every selected output size is also the native canvas trim. */
export type PdfPageSize = 'a4' | 'b5' | 'jis-b5' | 'vendor-b5' | 'magazine';
export const PDF_PAGE_SIZES = {
  a4: { label: 'A4', width: 210, height: 297 },
  b5: { label: 'B5 (ISO)', width: 176, height: 250 },
  'jis-b5': { label: 'JIS B5', width: 182, height: 257 },
  'vendor-b5': { label: 'Vendor B5', width: 182, height: 258 },
  magazine: { label: 'Magazine', width: 203, height: 267 },
} as const;

function checkedDimension(value: string | undefined, fallback: number, name: string) {
  const dimension = value === undefined ? fallback : Number(value);
  // Page metadata is internal, but do not turn a corrupt/imported value into
  // an enormous print surface or silently clip it onto a different page size.
  if (!Number.isFinite(dimension) || dimension < 50 || dimension > 500) {
    throw new Error(`The preview has an invalid page ${name}. Reload it before exporting.`);
  }
  return dimension;
}

/** Dimensions belong to the measured preview, not to the chosen output sheet. */
export function pdfPageDimensions(page: HTMLElement) {
  return {
    width: checkedDimension(page.dataset.pageWidthMm, 210, 'width'),
    height: checkedDimension(page.dataset.pageHeightMm, 297, 'height'),
  };
}

export function pdfSheetGeometry(size: PdfPageSize, sourceHeight = 297, sourceWidth = 210) {
  checkedDimension(String(sourceWidth), 210, 'width');
  checkedDimension(String(sourceHeight), 297, 'height');
  const { width, height } = PDF_PAGE_SIZES[size];
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  return { width, height, scale, left: Math.max(0, (width - sourceWidth * scale) / 2), top: Math.max(0, (height - sourceHeight * scale) / 2) };
}

/** Called only on the print clone, after author styles have loaded. Never
 * change editor geometry, pagination, source images, or the compiled proof. */
export function fitPdfSheets(doc: Document, size: PdfPageSize, bleedMm = 0, cropMarks = false) {
  if(!Number.isFinite(bleedMm)||bleedMm<0||bleedMm>10)throw new Error('Bleed must be between 0 and 10 mm per edge.');
  const pages = Array.from(doc.querySelectorAll<HTMLElement>('.pdf-export-page'));
  if (!pages.length) return;
  const dimensions = pages.map(pdfPageDimensions);
  const sourceBleeds=pages.map(page=>{const bleed=Number(page.dataset.canvasBleedMm??0);if(!Number.isFinite(bleed)||bleed<0||bleed>10)throw new Error('The canvas bleed is invalid.');return bleed;});
  const expected = PDF_PAGE_SIZES[size];
  if (dimensions.some((page,i) => Math.abs(page.width-2*sourceBleeds[i]-expected.width)>.001 || Math.abs(page.height-2*sourceBleeds[i]-expected.height)>.001)) {
    throw new Error(`The ${expected.label} preview is not ready at ${expected.width} × ${expected.height} mm. Wait for the layout to update and try again; exporting a different canvas size would add borders or change its scale.`);
  }
  if (!bleedMm && !cropMarks && !sourceBleeds.some(Boolean) && size === 'a4' && dimensions.every(page => page.width === 210 && page.height === 297)) return;
  // Marks live within the requested bleed, never in an extra output border.
  const slug=0,offset=bleedMm;
  const width=expected.width+2*offset,height=expected.height+2*offset;
  const css = doc.createElement('style');
  css.textContent = `
    @page { size: ${width}mm ${height}mm; margin: 0; }
    html, body { width: ${width}mm !important; min-width: ${width}mm !important; }
    .pdf-export-sheet { position: relative !important; box-sizing: border-box !important;
      width: ${width}mm !important; height: ${height}mm !important; margin: 0 !important;
      padding: 0 !important; overflow: hidden !important;
      break-inside: avoid !important; page-break-inside: avoid !important;
      print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
    .pdf-export-sheet > .pdf-export-page { position: absolute !important;
      left: var(--pdf-fit-left) !important; top: var(--pdf-fit-top) !important; right: auto !important; bottom: auto !important;
      transform: scale(var(--pdf-fit-scale)) !important; transform-origin: top left !important;
      break-after: auto !important; page-break-after: auto !important; }
    .pdf-bleed-artwork, .pdf-bleed-artwork * { color: transparent !important; text-shadow: none !important; }
    .pdf-bleed-artwork::before,.pdf-bleed-artwork::after,.pdf-bleed-artwork *::before,.pdf-bleed-artwork *::after { color: transparent !important; text-shadow:none !important; }
  `;
  doc.head.appendChild(css);
  doc.querySelectorAll<HTMLElement>('.pdf-export-pages').forEach(container => {
    container.style.setProperty('width', `${width}mm`, 'important');
    container.style.setProperty('min-width', `${width}mm`, 'important');
  });
  pages.forEach((page, index) => {
    const source = dimensions[index];
    const fit = {width:expected.width,height:expected.height,scale:1,left:0,top:0};
    // Bottom-bleed artwork must meet the output trim as well as its source
    // trim. Move any aspect-fit allowance above this opt-in sheet instead of
    // introducing a blank strip below its photograph. Scale/crop stay intact.
    const top = page.classList.contains('page--hero-bottom-bleed')
      ? Math.max(0, fit.height - source.height * fit.scale) : fit.top;
    page.style.setProperty('--pdf-fit-left', `${fit.left+offset-sourceBleeds[index]}mm`);
    page.style.setProperty('--pdf-fit-top', `${top+offset-sourceBleeds[index]}mm`);
    page.style.setProperty('--pdf-fit-scale', String(fit.scale));
    const sheet = doc.createElement('div');
    sheet.className = 'pdf-export-sheet';
    sheet.dataset.paperSize = size;
    // Any aspect-ratio allowance should match dark/coloured paper too.
    sheet.style.backgroundColor = doc.defaultView?.getComputedStyle(page).backgroundColor ?? '#fff';
    if(cropMarks){
      const background=doc.createElement('div');
      Object.assign(background.style,{position:'absolute',left:`${slug}mm`,top:`${slug}mm`,width:`${expected.width+2*bleedMm}mm`,height:`${expected.height+2*bleedMm}mm`,backgroundColor:sheet.style.backgroundColor});
      sheet.style.backgroundColor='#fff';sheet.append(background);
    }
    sheet.style.setProperty('break-after', index === pages.length - 1 ? 'auto' : 'page', 'important');
    sheet.style.setProperty('page-break-after', index === pages.length - 1 ? 'auto' : 'always', 'important');
    page.before(sheet);
    if(bleedMm&&!sourceBleeds[index]){
      // A separate artwork-only layer extends behind the unchanged trim page.
      // Never enlarge text, move margins or repaginate the source document.
      const artwork=page.cloneNode(true) as HTMLElement;
      artwork.classList.remove('pdf-export-page');artwork.classList.add('pdf-bleed-artwork');
      artwork.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));artwork.removeAttribute('id');
      artwork.querySelectorAll('svg,canvas,[data-editor-only]').forEach(el=>el.remove());
      // Keep text metrics in this layer: deleting copy collapses flowing
      // figures and moves their artwork away from the real trim edge.
      // visibility:hidden retains layout while excluding the duplicate text
      // from painting, selection and the printed PDF's searchable content.
      const walker=doc.createTreeWalker(artwork,4);const text:Node[]=[];while(walker.nextNode())text.push(walker.currentNode);
      text.forEach(node=>{if(!node.textContent?.trim())return;const hidden=doc.createElement('span');hidden.style.setProperty('visibility','hidden','important');hidden.setAttribute('aria-hidden','true');node.parentNode?.replaceChild(hidden,node);hidden.appendChild(node);});
      artwork.style.setProperty('position','absolute','important');
      artwork.style.setProperty('left','0','important');artwork.style.setProperty('top','0','important');
      artwork.style.setProperty('transform','none','important');
      artwork.style.setProperty('transform-origin','top left','important');
      artwork.style.setProperty('break-after','auto','important');artwork.style.setProperty('page-break-after','auto','important');
      artwork.style.setProperty('pointer-events','none');artwork.setAttribute('aria-hidden','true');
      // Extrude a narrow strip from each actual trim edge. Scaling a whole
      // background copy would move colour/image boundaries along the edge.
      const sample=.2,w=expected.width,h=expected.height,b=bleedMm;
      const regions=[
        {x:b,y:0,sw:w,sh:sample,sx:0,sy:0,scaleX:1,scaleY:b/sample},
        {x:b,y:b+h,sw:w,sh:sample,sx:0,sy:h-sample,scaleX:1,scaleY:b/sample},
        {x:0,y:b,sw:sample,sh:h,sx:0,sy:0,scaleX:b/sample,scaleY:1},
        {x:b+w,y:b,sw:sample,sh:h,sx:w-sample,sy:0,scaleX:b/sample,scaleY:1},
        ...[0,w-sample].flatMap((sx,i)=>[0,h-sample].map((sy,j)=>({x:i?b+w:0,y:j?b+h:0,sw:sample,sh:sample,sx,sy,scaleX:b/sample,scaleY:b/sample}))),
      ];
      for(const region of regions){
        const strip=doc.createElement('div');strip.className='pdf-bleed-strip';strip.setAttribute('aria-hidden','true');
        Object.assign(strip.style,{position:'absolute',left:`${region.x+slug}mm`,top:`${region.y+slug}mm`,width:`${region.sw}mm`,height:`${region.sh}mm`,overflow:'hidden',transformOrigin:'top left',transform:`scale(${region.scaleX},${region.scaleY})`,contain:'paint',pointerEvents:'none'});
        const edge=artwork.cloneNode(true) as HTMLElement;
        edge.style.setProperty('left',`${-region.sx}mm`,'important');edge.style.setProperty('top',`${-region.sy}mm`,'important');
        strip.appendChild(edge);sheet.appendChild(strip);
      }
    }
    sheet.appendChild(page);
    if(cropMarks&&bleedMm>0){
      const marks=doc.createElementNS('http://www.w3.org/2000/svg','svg');
      marks.classList.add('pdf-crop-marks');marks.setAttribute('aria-hidden','true');
      marks.setAttribute('viewBox',`0 0 ${width} ${height}`);
      Object.assign(marks.style,{position:'absolute',inset:'0',width:`${width}mm`,height:`${height}mm`,pointerEvents:'none'});
      const segments=cropMarkSegments(expected.width,expected.height,bleedMm);
      for(const [x1,y1,x2,y2] of segments){const line=doc.createElementNS(marks.namespaceURI,'line');for(const [key,value]of Object.entries({x1,y1,x2,y2,stroke:'#000','stroke-width':.0882}))line.setAttribute(key,String(value));marks.append(line);}
      sheet.append(marks);
    }
    page.style.setProperty('box-sizing', 'border-box', 'important');
    page.style.setProperty('break-after', 'auto', 'important');
    page.style.setProperty('page-break-after', 'auto', 'important');
  });
  return css;
}

/** Eight corner-only cut ticks, contained entirely in the bleed band. */
export function cropMarkSegments(trimWidth:number,trimHeight:number,bleed:number){
 if(bleed<=0)return [];
 const width=trimWidth+2*bleed,height=trimHeight+2*bleed,inset=Math.min(.25,bleed*.1),end=bleed-Math.min(.5,bleed*.25),segments:number[][]=[];
 for(const x of [bleed,bleed+trimWidth])segments.push([x,inset,x,end],[x,height-end,x,height-inset]);
 for(const y of [bleed,bleed+trimHeight])segments.push([inset,y,end,y],[width-end,y,width-inset,y]);
 return segments;
}
