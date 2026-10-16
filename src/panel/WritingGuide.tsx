import { memo, useDeferredValue, useMemo, useState, type RefObject } from 'react';
import { checkWriting, type WritingLanguage } from '../lib/writingCheck';
import {requestBlockEditorFocus} from '../lib/editorNavigation';
import './writing-guide.css';

/** Advisory only: no automatic replacements and no network requests. */
export const WritingGuide=memo(function WritingGuide({text,editorId,editorRef,onFormat,formatBlockId,label='Paragraph'}:{text:string;editorId?:string;editorRef?:RefObject<HTMLTextAreaElement|null>;onFormat?:()=>void;formatBlockId?:string;label?:string}) {
 const [language,setLanguage]=useState<WritingLanguage>('auto');const deferred=useDeferredValue(text);
 const result=useMemo(()=>checkWriting(deferred,language),[deferred,language]);
 const paragraphs=useMemo(()=>deferred.split(/\n\s*\n/).filter(p=>p.trim()).map(p=>checkWriting(p,language)),[deferred,language]);
 const pending=deferred!==text;
 const [ignored,setIgnored]=useState<Set<string>>(new Set());
 const key=(index:number)=>`${deferred}:${result.issues[index].start}:${result.issues[index].message}`;
 const issues=result.issues.map((issue,index)=>({...issue,index})).filter(issue=>!ignored.has(key(issue.index)));
 const locate=(start:number,end:number)=>{
  const target=editorId?document.getElementById(editorId):null;
  const editor=editorRef?.current??(target instanceof HTMLTextAreaElement?target:target?.querySelector('textarea'));
  if(!editor||editor.value!==deferred)return;editor.focus();editor.setSelectionRange(start,end);editor.scrollIntoView({block:'nearest'});
 };
 const short=result.words<12;
 return <div className="writing-guide" aria-label={`${label} writing guide`}>
  <div className="writing-guide-summary">
   <span className={`writing-pace${!short&&result.average<=20?' is-comfortable':''}`} title="An editorial sentence-length guide, not a reading-age or grammar grade.">{short?'Short sample':result.longSentences?'Try a shorter sentence':result.average<=20?'Comfortable sentence length':'Consider shorter sentences'}</span>
   {(onFormat||formatBlockId)&&<button type="button" className="writing-format" onClick={onFormat??(()=>requestBlockEditorFocus(formatBlockId!))}>Format text ↗</button>}
  </div>
  <div className="writing-metrics"><span>{result.words} words</span><span>{result.sentences} sentences</span><span>{result.average.toFixed(1)} words / sentence</span></div>
  <details className="writing-review">
   <summary>{pending?'Checking…':`${issues.length} ${issues.length===1?'suggestion':'suggestions'} to review`}<span> · Writing coach</span></summary>
   <label className="writing-language">Check language<select className="select-control" aria-label={`${label} check language`} value={language} onChange={e=>setLanguage(e.target.value as WritingLanguage)}><option value="auto">Auto · {result.language==='ms'?'Bahasa Melayu':'English'}</option><option value="en">English</option><option value="ms">Bahasa Melayu</option></select></label>
   {paragraphs.length>1&&<div className="writing-paragraph-metrics" aria-label="Readability by paragraph">{paragraphs.map((p,i)=><p key={i}><strong>Paragraph {i+1}</strong> · {p.words} words · {p.average.toFixed(1)} words / sentence · {p.words<12?'Short sample':p.longSentences?'Try splitting a long sentence':p.average<=20?'Comfortable sentence length':'Consider shorter sentences'}</p>)}</div>}
   <p className="writing-coach-note">Aim for one idea per sentence and roughly 15–20 words on average. Explain scientific terms with a familiar example; keep the science accurate. This is a guide for high-school readers, not a reading-age test.</p>
   {!short&&<p className="writing-metric-detail">{result.shortPercent}% of sentences have 20 words or fewer.</p>}
   <ul>{issues.slice(0,12).map(issue=><li key={key(issue.index)}>
    <span className={`writing-kind writing-kind--${issue.kind}`}>{issue.kind}</span>
    <p>{issue.message}</p>
    <button className="writing-excerpt" type="button" disabled={pending} onClick={()=>locate(issue.start,issue.end)} title="Select this passage in your text">
     {issue.start>35?'…':''}{deferred.slice(Math.max(0,issue.start-35),issue.start)}<mark>{deferred.slice(issue.start,Math.min(issue.end,issue.start+140))}{issue.end-issue.start>140?'…':''}</mark>{deferred.slice(issue.end,issue.end+35)}{issue.end+35<deferred.length?'…':''}
    </button>
    {issue.suggestion&&<p className="writing-suggestion">Consider: <strong>{issue.suggestion}</strong></p>}
    <button className="writing-dismiss" type="button" onClick={()=>setIgnored(current=>new Set([...current,key(issue.index)]))}>Ignore for this text</button>
   </li>)}</ul>
   {issues.length>12&&<p>Showing 12 suggestions. Review these first, then check again.</p>}
   {!issues.length&&<p>No issues found by these rules. Still check meaning, facts and context.</p>}
   <p className="writing-limits">Private, on-device checks for common punctuation, formatting and grammar patterns. Not comprehensive grammar or spelling checking. Malay and English use separate rules; choose the language manually for mixed-language text. Nothing is changed automatically.</p>
  </details>
 </div>;
});
