/** Only decorative photo fades are composited. Publication text, captions,
 * vectors and sheet geometry remain in the original print DOM. This avoids
 * zoom-dependent PDF soft-mask/shading seams without rasterising the page. */
export function verticalFadeStops(value:string):{bottomUp:boolean;stops:{color:string;offset:number}[]}|null{
  if(!value.startsWith('linear-gradient(')||!value.endsWith(')'))return null;
  const parts:string[]=[];let depth=0,start=0;const inner=value.slice(16,-1);
  for(let i=0;i<inner.length;i++){if(inner[i]==='(')depth++;if(inner[i]===')')depth--;if(inner[i]===','&&depth===0){parts.push(inner.slice(start,i).trim());start=i+1;}}
  parts.push(inner.slice(start).trim());const direction=parts.shift();
  if(!['to top','to bottom','0deg','180deg'].includes(direction??'')||parts.length<2)return null;
  const stops=parts.map((part,index)=>{const match=part.match(/^(.*)\s+([\d.]+)%$/);return {color:match?match[1]:part,offset:match?Number(match[2])/100:index/(parts.length-1)};});
  if(stops.some((stop,index)=>stop.offset<0||stop.offset>1||(index>0&&stop.offset<stops[index-1].offset)))return null;
  return {bottomUp:direction==='to top'||direction==='0deg',stops};
}

export async function compositePrintHeroFades(root:Document):Promise<number>{
  const view=root.defaultView;if(!view)return 0;let count=0;
  for(const frame of root.querySelectorAll<HTMLElement>('.page--paper3 .hero:not(.hero--hidden), .article-hero--fade')){
    const image=frame.querySelector<HTMLImageElement>(':scope > img');
    if(!image||frame.hasAttribute('data-pdf-photo-fade'))continue;
    const overlay=view.getComputedStyle(frame,'::after');
    const fade=verticalFadeStops(overlay.backgroundImage);
    if(!fade||overlay.display==='none'||overlay.content==='none')continue;
    const box=view.getComputedStyle(frame),photo=view.getComputedStyle(image);
    // FramedImage has resolved crop, zoom and free pan to explicit geometry.
    // Do not guess the rendering of custom transforms, masks or rounded frames.
    if(photo.transform!=='none'||photo.objectFit!=='fill'||photo.clipPath!=='none'||box.borderRadius!=='0px'||photo.opacity!=='1'||overlay.opacity!=='1'||box.backgroundImage!=='none')continue;
    const width=parseFloat(box.width),height=parseFloat(box.height);
    const x=parseFloat(photo.left),y=parseFloat(photo.top),photoWidth=parseFloat(photo.width),photoHeight=parseFloat(photo.height);
    const top=parseFloat(overlay.top),bottom=parseFloat(overlay.bottom);
    if(![width,height,x,y,photoWidth,photoHeight,top,bottom].every(Number.isFinite)||width<=0||height<=0)continue;
    const page=frame.closest<HTMLElement>('.page')!;
    // A transparent/panned photo may reveal arbitrary page artwork. Keep that
    // author's layered composition rather than replacing it with a flat fill.
    if(page.querySelector(':scope > .page-artwork')||view.getComputedStyle(page,'::before').backgroundImage!=='none')continue;
    const paper=view.getComputedStyle(page).backgroundColor;
    // 300 dpi at CSS's 96 dpi; cap memory for unusually oversized author CSS.
    const scale=Math.min(300/96,4096/Math.max(width,height));
    const canvas=root.createElement('canvas');canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);
    const context=canvas.getContext('2d',{alpha:false});if(!context)throw Error('Could not prepare the photo fade for PDF export.');
    context.scale(canvas.width/width,canvas.height/height);
    context.fillStyle=paper;context.fillRect(0,0,width,height);
    context.fillStyle=box.backgroundColor;context.fillRect(0,0,width,height);
    context.drawImage(image,x,y,photoWidth,photoHeight);
    const end=height-bottom;
    const gradient=context.createLinearGradient(0,fade.bottomUp?end:top,0,fade.bottomUp?top:end);
    for(const stop of fade.stops)gradient.addColorStop(stop.offset,stop.color);
    context.fillStyle=gradient;context.fillRect(0,top,width,end-top);
    // Paint the explicitly solid terminal band separately. Some canvas
    // implementations round even equal dark gradient stops down one channel.
    const last=fade.stops.at(-1)!,previous=fade.stops.at(-2)!;
    if(last.offset===1&&last.color===previous.color){
      const cap=(end-top)*(1-previous.offset);context.fillStyle=last.color;
      context.fillRect(0,fade.bottomUp?top:end-cap,width,cap);
    }
    let source:string;try{source=canvas.toDataURL('image/png');}catch{throw Error('The hero photograph cannot be prepared securely for print. Import the photo directly and retry.');}
    image.src=source;
    for(const[property,value]of Object.entries({left:'0',top:'0',width:'100%',height:'100%','object-fit':'fill',transform:'none'}))image.style.setProperty(property,value,'important');
    frame.setAttribute('data-pdf-photo-fade','true');
    // Wait on the new PNG before printing: a replaced src is not decoded yet.
    await image.decode();count++;
  }
  if(count){const style=root.createElement('style');style.textContent='[data-pdf-photo-fade]::after{display:none!important}';root.head.append(style);}
  return count;
}
