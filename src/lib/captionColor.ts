import type {Doc} from '../schema/document';

/** An explicit shared caption colour edit replaces old per-caption colours.
 * Other typography and any later individual colour edits remain independent. */
export function clearCaptionColorOverrides(doc:Doc,group:string){
 const styles=doc.design.textStyles;
 if(!styles)return;
 for(const [key,style] of Object.entries(styles)){
  const all=group==='caption'&&(key==='heroCaption'||key==='coverCaption'||key==='newsCaption'||key.startsWith('image-caption:')||key.startsWith('gallery-caption:')||/^news:.*:caption$/.test(key));
  const news=group==='newsCaption'&&/^news:.*:caption$/.test(key);
  if(all||news)delete style.color;
 }
}
