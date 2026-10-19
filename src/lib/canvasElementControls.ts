import type {Doc} from '../schema/document';
import {TEXT_SELECTORS,extraTextGroups,textStyleSelector} from './textStyles';
import {footerBottomOffset} from './pageFooter';
import {DEFAULT_TOP_BAR_OFFSET} from '../schema/document';
import {backCoverLayout} from './backCoverDesign';
import {pageDimensions} from './pageFormat';
import type {FrontCoverTextRole} from '../schema/document';
import {articleGeometry} from './articleLayouts';

export interface ElementControl {
 id:string;label:string;axis:'x'|'y';value:number;min:number;max:number;step:number;unit:string;
 paint?:'moveY'|'width';
 element?:HTMLElement;
 direction?:1|-1;
 save:(doc:Doc,value:number)=>void;
}
export function canvasTextTarget(doc:Doc,element:Element):{element:HTMLElement;key:string}|undefined{
 const keys=[...doc.blocks.map(b=>b.type==='figure'?`gallery-caption:${b.id}`:`block:${b.id}`),
  ...extraTextGroups(doc).map(g=>g.group),...Object.keys(TEXT_SELECTORS).reverse()];
 let best:{element:HTMLElement;key:string}|undefined;
 for(const key of keys){
  const selector=textStyleSelector(key);if(!selector)continue;
  const match=element.closest<HTMLElement>(selector);
  if(match&&(!best||best.element!==match&&best.element.contains(match)))best={element:match,key};
 }
 return best;
}
/** Reuse saved layout fields, never invent free coordinates for flowing copy. */
export function canvasElementControls(doc:Doc,element:HTMLElement,_key?:string):ElementControl[]{
 const controls:ElementControl[]=[],css=getComputedStyle(element),mm=96/25.4;
 const add=(id:string,label:string,axis:'x'|'y',value:number,min:number,max:number,save:ElementControl['save'],paint?:ElementControl['paint'],step=.1,unit='mm')=>controls.push({id,label,axis,value,min,max,save,paint,step,unit});

 const owner=(selector:string)=>element.closest<HTMLElement>(selector);
 if(doc.templateId==='paper-4'&&doc.design.showHero!==false&&doc.design.heroHeight>0&&owner('.article-header-position,.article-hero')){
  const base=articleGeometry('paper-4',{...doc.design,heroImmersionMm:0});
  const page=owner('.page'),caption=page?.querySelector<HTMLElement>('.article-hero-caption');
  const scale=page?page.getBoundingClientRect().width/base.width:0;
  const captionHeight=caption&&scale>0?caption.getBoundingClientRect().height/scale:0;
  const limit=doc.design.heroAtBottom?Math.max(0,base.image.height-captionHeight-base.gutter-4):Math.min(base.image.height,base.titleTop-base.contentTop);
  add('immersion','Hero immersion','y',Math.min(limit,doc.design.heroImmersionMm??0),0,limit,(d,v)=>{d.design.heroImmersionMm=v;});
  controls[controls.length-1].direction=doc.design.heroAtBottom?1:-1;
 }
 const onOwner=(selector:string)=>{controls[controls.length-1].element=owner(selector)??element;};
 if(owner('.tag-bar')){add('bar','Top bar position','y',doc.design.topBarOffset??DEFAULT_TOP_BAR_OFFSET,0,40,(d,v)=>{d.design.topBarOffset=v;},'moveY');onOwner('.tag-bar');}
 if(owner('.page-folio')){add('footer','Footer position','y',footerBottomOffset(doc),0,40,(d,v)=>{d.footer={...d.footer,bottomOffset:v};},'moveY');onOwner('.page-folio');}
 const heading=owner('.header,.article-header-position');
 if(heading&& !['magazine-2','magazine-3','magazine-4','frontmatter-dean'].includes(doc.templateId??'')){
  const page=heading.closest<HTMLElement>('.page');const top=page?(heading.getBoundingClientRect().top-page.getBoundingClientRect().top)/(page.getBoundingClientRect().width/(parseFloat(getComputedStyle(page).width)/mm)):0;
  add('heading','Heading position','y',doc.design.firstPageTopMargin||top,0,250,(d,v)=>{d.design.firstPageTopMargin=v;},'moveY');
  controls[controls.length-1].element=heading;
 }
 const card=element.closest<HTMLElement>('.g-card[data-source-block-id]');
 if(card){const id=card.dataset.sourceBlockId,block=doc.blocks.find(b=>b.id===id);if(block?.type==='paragraph')add('card','Text card position','y',block.cardVerticalPosition??50,0,100,(d,v)=>{const b=d.blocks.find(b=>b.id===id);if(b?.type==='paragraph')b.cardVerticalPosition=v;},undefined,1,'%');}
 if(element.closest('.back-cover-brand-block')){
  const layout=backCoverLayout(doc.design);
  add('brandTop','Brand block position','y',layout.brandTop,28,170,(d,v)=>{d.design.backCover={...d.design.backCover,brandTop:v};},'moveY');onOwner('.back-cover-brand-block');
  add('brandWidth','Brand block width','x',layout.brandWidth,45,150,(d,v)=>{d.design.backCover={...d.design.backCover,brandWidth:v};});
 }
 const target=element.closest<HTMLElement>('[data-editor-target]')?.dataset.editorTarget;
 if(target==='image-backcover-qr')add('qrSize','QR size','x',backCoverLayout(doc.design).qrSize,12,55,(d,v)=>{d.design.backCover={...d.design.backCover,qrSize:v};});
 if(target==='image-backcover-logo'){
  const layout=backCoverLayout(doc.design);
  add('logoWidth','Logo width','x',layout.logoWidth,10,80,(d,v)=>{d.design.backCover={...d.design.backCover,logoWidth:v};});
  add('logoHeight','Logo height','y',layout.logoHeight,5,42,(d,v)=>{d.design.backCover={...d.design.backCover,logoHeight:v};});
 }
 if(target==='image-logo'||target==='image-signature'){
  const signature=target==='image-signature',field=signature?'signatureWidth':'logoWidth';
  add(field,signature?'Signature width':'Logo width','x',doc.frontMatter?.[field]??parseFloat(css.width)/mm,signature?10:8,signature?80:40,(d,v)=>{if(d.frontMatter)d.frontMatter[field]=v;},'width');
 }
 const coverText=owner('.cover-text-object');
 if(coverText){const role=coverText.dataset.editorTarget?.replace('front-cover-style-','') as FrontCoverTextRole;
  if(role){add('coverInset','Text inset','x',doc.design.frontCover?.text?.[role]?.inset??0,0,40,(d,v)=>{d.design.frontCover={...d.design.frontCover,text:{...d.design.frontCover?.text,[role]:{...d.design.frontCover?.text?.[role],inset:v}}};});}
 }
 if(owner('.front-cover-story'))add('storyWidth','Story width','x',doc.design.frontCover?.storyWidth??88,40,100,(d,v)=>{d.design.frontCover={...d.design.frontCover,storyWidth:v};},undefined,1,'%');
 const gate=owner('.mag-gate-mid');
 if(gate){const field=gate.dataset.editorTarget==='gate-text-position'?'gateText':'gateTitle',dims=pageDimensions(doc.design),page=gate.closest<HTMLElement>('.page'),scale=page?page.getBoundingClientRect().width/dims.width:1,rect=gate.getBoundingClientRect();
  add('gateWidth','Text block width','x',doc.design[field]?.width??rect.width/scale,50,dims.width-(doc.design[field]?.inset??doc.design.margin)-8,(d,v)=>{d.design[field]={...d.design[field],width:v};});
  add('gateInset','Text block inset','x',doc.design[field]?.inset??doc.design.margin,8,dims.width-58,(d,v)=>{d.design[field]={...d.design[field],inset:v};});
 }
 const caption=owner('[data-editor-target^="gallery-caption-"]');
 if(caption){const id=caption.dataset.editorTarget!.slice('gallery-caption-'.length),block=doc.blocks.find(b=>b.id===id);if(block?.type==='figure')add('captionPosition','Caption position','y',block.captionVerticalPosition??100,0,100,(d,v)=>{const b=d.blocks.find(b=>b.id===id);if(b?.type==='figure')b.captionVerticalPosition=v;},undefined,1,'%');}
 return controls;
}
