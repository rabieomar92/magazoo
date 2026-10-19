import {useSyncExternalStore} from 'react';
import {contentsDesignOf,issueHeroChoices,type IssueItem,type IssuePlan} from './model';

type Fit='pending'|'shown'|'omitted'|'overflow';
let fits=new Map<string,Fit>(),overflow=false;
const listeners=new Set<()=>void>();
let observer:MutationObserver|undefined;
function subscribe(listener:()=>void){
 listeners.add(listener);
 const read=()=>{
  fits=new Map();overflow=!!document.querySelector('.issue-proof-pages [data-contents-overflow="true"]');
  document.querySelectorAll<HTMLElement>('.issue-proof-pages .issue-contents-mosaic [data-contents-id]').forEach(card=>{
   if(!card.closest('.issue-mosaic-probe')&&card.closest('.page'))fits.set(card.dataset.contentsId!,card.querySelector('[data-contents-shot]')?'shown':'omitted');
  });
  listeners.forEach(notify=>notify());
 };
 // All cards share one observer; the proof is the source of truth for fit.
 if(listeners.size===1){
  read();observer=new MutationObserver(read);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-contents-overflow']});
 }
 return()=>{listeners.delete(listener);if(!listeners.size){observer?.disconnect();observer=undefined;}};
}

/** Always inline: selecting a picture never opens or expands a card. */
export function ContentsPicturePicker({item,plan,disabled,onChange}:{item:IssueItem;plan:IssuePlan;disabled:boolean;onChange:(plan:IssuePlan)=>void}){
 const choices=issueHeroChoices(item.doc),style=plan.contentsStyle?.[item.id]??{};
 const chosen=style.assetId===null?undefined:style.assetId??choices[0]?.id;
 const fit=useSyncExternalStore(subscribe,()=>overflow?'overflow':fits.get(item.id)??'pending',()=> 'pending' as Fit);
 const update=(patch:typeof style)=>onChange({...plan,contentsStyle:{...plan.contentsStyle,[item.id]:{...style,...patch}}});
 const enabled=style.hero??(contentsDesignOf(plan).pictures!=='none');
 const warning=enabled&&!plan.contentsExcluded.includes(item.id)&&(fit==='overflow'||fit==='omitted');
 const status=!choices.length?'No pictures':plan.contentsExcluded.includes(item.id)?'Not listed in contents':!enabled?'Picture hidden':fit==='shown'?'Picture fits':fit==='overflow'?'Not enough room in contents':fit==='omitted'?'Picture omitted: not enough room':'Checking picture fit…';
 return <section className="issue-picture-picker" aria-label={`Contents picture for ${item.name}`}>
  <div className="issue-picture-inline">
   <select aria-label={`Contents picture for ${item.name}`} disabled={disabled||!choices.length} value={chosen??''} onChange={e=>update({assetId:e.target.value,hero:true,frame:undefined})}>
    {!chosen&&<option value="">Select picture</option>}
    {choices.map((choice,i)=><option key={choice.id} value={choice.id}>{i+1} / {choices.length}</option>)}
   </select>
   <label><input type="checkbox" disabled={disabled||!choices.length} checked={enabled&&!!chosen} onChange={e=>update({hero:e.target.checked,assetId:chosen??choices[0]?.id})}/>Feature</label>
  </div>
  <p role="status" className={warning?'issue-picture-warning':''} title={status}>{status}</p>
 </section>;
}
