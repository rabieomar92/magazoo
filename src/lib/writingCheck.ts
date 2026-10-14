export type WritingLanguage='auto'|'en'|'ms';
export interface WritingIssue {start:number;end:number;kind:'punctuation'|'grammar'|'formatting'|'clarity';message:string;suggestion?:string;}
const words=(text:string)=>text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)??[];
const blank=(s:string)=>s.replace(/[^\n]/g,' ');
/** Preserve source offsets so review highlights select the original textarea. */
function protectedText(text:string){return text.replace(/`[^`]*`|\$\$[\s\S]*?\$\$|\$[^$\n]+\$|https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,blank);}
function prose(text:string){return protectedText(text).replace(/\*\*|__|(?<!\*)\*(?!\*)/g,blank).replace(/\\n/g,'\n ');}
function detect(text:string):'en'|'ms'{
 const list=words(text.toLowerCase());
 const ms=list.filter(w=>['yang','dan','ialah','adalah','untuk','dengan','daripada','ini','itu','boleh','tidak','dalam','cahaya','zarah'].includes(w)).length;
 const en=list.filter(w=>['the','and','is','are','that','with','this','these','from','can','not','which'].includes(w)).length;
 return ms>=2&&ms>en?'ms':'en';
}
export function checkWriting(text:string, preference:WritingLanguage='auto') {
 const clean=prose(text),language=preference==='auto'?detect(clean):preference;
 const issues:WritingIssue[]=[];
 const add=(start:number,end:number,kind:WritingIssue['kind'],message:string,suggestion?:string)=>{if(issues.length<60)issues.push({start,end,kind,message,suggestion});};
 const scan=(regex:RegExp,kind:WritingIssue['kind'],message:string,suggestion?:string|((m:RegExpMatchArray)=>string))=>{
  for(const m of clean.matchAll(regex))if(text.slice(m.index!,m.index!+m[0].length)===m[0])add(m.index!,m.index!+m[0].length,kind,message,typeof suggestion==='function'?suggestion(m):suggestion);
 };
 scan(/[ \t]+[,;:!?]/g,'punctuation','Remove the space before this punctuation mark.',m=>m[0].trim());
 scan(/[,;:!?](?=\p{L})/gu,'punctuation','Usually add a space after this punctuation mark. Check scientific notation before changing it.',m=>m[0]+' ');
 scan(/([,;:])\1+|[!?]{2,}/g,'punctuation','Repeated punctuation: one mark is usually enough in an article.');
 scan(/(?<=\p{L})[ \t]{2,}(?=\p{L})/gu,'formatting','Use one space between words.');
 scan(/\b([\p{L}]+)[ \t]+\1\b/giu,'grammar',language==='ms'?'Semak perkataan berulang. Kata ganda biasanya menggunakan tanda sempang.':'Repeated word: check whether one copy can be removed.');
 const pairs:Record<string,string>={'(':')','[':']','“':'”'};const stack:{char:string;at:number}[]=[];
 for(let i=0;i<clean.length;i++){
  const c=clean[i];if(pairs[c])stack.push({char:c,at:i});
  else if(Object.values(pairs).includes(c)){if(stack.length&&pairs[stack.at(-1)!.char]===c)stack.pop();else add(i,i+1,'punctuation','Check this closing bracket or quotation mark.');}
 }
 for(const p of stack)add(p.at,p.at+1,'punctuation','This opening bracket or quotation mark has no matching close in this paragraph.');
 const quotes=[...clean.matchAll(/"/g)];if(quotes.length%2)add(quotes.at(-1)!.index!,quotes.at(-1)!.index!+1,'punctuation','Check the paired quotation marks in this paragraph.');
 for(const token of ['**','__']){const hits=[...protectedText(text).matchAll(token==='**'?/\*\*/g:/__/g)];if(hits.length%2)add(hits.at(-1)!.index!,hits.at(-1)!.index!+2,'formatting',`Close the ${token} formatting marker.`);}
 if(language==='en'){
  scan(/\b(?:they|we|you)\s+(?:is|was|has)\b|\b(?:he|she|it)\s+(?:are|have)\b|\bI\s+(?:is|are|has)\b/gi,'grammar','Check subject–verb agreement (for example, “they are” or “she has”).');
  scan(/\b(?:could|should|would|must)\s+of\b/gi,'grammar','Did you mean “have” after this modal verb?',m=>m[0].replace(/of$/i,'have'));
  scan(/\ba\s+(?:apple|electron|atom|experiment|image|example|idea|instrument|hour|honest)\b/gi,'grammar','This word normally takes “an”.',m=>m[0].replace(/^a\b/i,'an'));
  scan(/\ban\s+(?:university|unit|user|one|unique|European)\b/gi,'grammar','This word starts with a consonant sound and normally takes “a”.',m=>m[0].replace(/^an\b/i,'a'));
  const simpler:Record<string,string>={'in order to':'to','due to the fact that':'because','utilise':'use','utilize':'use','commence':'start','subsequently':'then'};
  scan(/\b(?:in order to|due to the fact that|utilise|utilize|commence|subsequently)\b/gi,'clarity','A familiar expression may help a younger reader. Keep the original if the meaning needs it.',m=>simpler[m[0].toLowerCase()]);
 } else {
  scan(/\bdi\s+(?:lakukan|gunakan|hasilkan|jalankan|bina|ukur|kaji|temui|lihat|baca|tulis|ambil|anggap)\b/gi,'grammar','Imbuhan pasif “di-” dirapatkan dengan kata kerja.',m=>m[0].replace(/\s+/,''));
  scan(/\b(?:dirumah|disekolah|dimakmal|didalam|diluar|diatas|dibawah|dihadapan|dibelakang)\b/gi,'grammar','Kata sendi “di” yang menunjukkan tempat ditulis berasingan.',m=>m[0].slice(0,2)+' '+m[0].slice(2));
  scan(/\badalah\s+merupakan\b/gi,'grammar','Elakkan bentuk lewah ini; semak sama ada “merupakan” sahaja mencukupi.','merupakan');
  scan(/\bbagi tujuan\b/gi,'clarity','Pertimbangkan ungkapan yang lebih ringkas jika maknanya sama.','untuk');
 }
 // Protect decimal points and common abbreviations before splitting sentences.
 const sentenceText=clean.replace(/\b(?:Dr|Prof|Mr|Mrs|Ms|Assoc|Ir|Ts|Sr|No|Fig|vs|dll|dsb|Sdn|Bhd)\.|\b(?:e\.g|i\.e)\./gi,m=>m.replace(/\./g,' ')).replace(/(?<=\d)\.(?=\d)|(?<=\b[A-Z])\.(?=\s*[A-Z])/g,' ');
 const sentences=[...sentenceText.matchAll(/[^.!?\n]+(?:[.!?]+|(?=\n|$))/g)].map(m=>({start:m.index!,end:m.index!+m[0].length,words:words(m[0]).length})).filter(s=>s.words>0);
 const wordCount=words(clean).length,average=sentences.length?wordCount/sentences.length:0;
 for(const s of sentences)if(s.words>30)add(s.start,s.end,'clarity',language==='ms'?`Ayat ini mempunyai kira-kira ${s.words} perkataan. Cuba pecahkan pada perubahan idea.`:`This sentence has about ${s.words} words. Try splitting it where the idea changes.`);
 if(wordCount>=12&&sentences.length===1&&!/[.!?:;”"\])]\s*$/.test(clean)&&!clean.includes('\n'))add(Math.max(0,text.trimEnd().length-1),text.trimEnd().length,'punctuation','If this is a complete sentence, check its ending punctuation.');
 issues.sort((a,b)=>a.start-b.start||a.end-b.end);
 return {language,words:wordCount,sentences:sentences.length,average,shortPercent:sentences.length?Math.round(100*sentences.filter(s=>s.words<=20).length/sentences.length):0,longSentences:sentences.filter(s=>s.words>30).length,issues};
}
