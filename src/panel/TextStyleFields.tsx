import { useEffect, useState } from 'react';
import type { Doc, TextStyle, GateTextRole } from '../schema/document';
import { useDoc } from '../store/useDoc';
import { ALL_FONTS, fontOptions } from '../lib/fonts';
import { textStyleSelector,captionBackgroundSelector } from '../lib/textStyles';
import { LabeledSelect, LabeledNumber } from './Field';
import { LetterSpacingField } from './LetterSpacingField';
import {gateTypography} from '../lib/gateTypography';
import {trackingRoleSupported} from '../lib/textTracking';
import {clearCaptionColorOverrides,clearCaptionPaddingOverrides} from '../lib/captionColor';

type Property = keyof TextStyle | 'tracking';
const ORDER: Record<Property, number> = {fontFamily:10,fontSize:20,fontWeight:30,italic:31,underline:32,color:40,backgroundOpacity:42,captionPadding:43,tracking:45,lineHeight:48,align:50};

function OptionalNumber({label,value,onChange,min,max,step,placeholder}: {label:string;value?:number;onChange:(n?:number)=>void;min:number;max:number;step:number;placeholder:string}) {
  const [draft,setDraft] = useState<string|null>(null);
  const commit = (text:string,blur=false) => {
    if (!text.trim()) { onChange(undefined); return; }
    const n = Number(text);
    if (Number.isFinite(n) && (blur || n>=min && n<=max)) onChange(Math.max(min,Math.min(max,n)));
  };
  return <label className="field field--inline"><span className="field-label">{label}</span>
    <input className="field-input field-input--num" aria-label={label} type="number" min={min} max={max} step={step}
      placeholder={placeholder} value={draft ?? value ?? ''}
      onChange={e=>{setDraft(e.target.value);commit(e.target.value);}}
      onBlur={e=>{commit(e.target.value,true);setDraft(null);}}
      onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} />
  </label>;
}

/** Add only missing capabilities. Original controls keep their own handlers.
 * A saved per-component override takes precedence after a template switch. */
export function TextStyleFields({group,existing,doc}: {group:string;existing:Property[];doc:Doc}) {
  const update = useDoc(s=>s.update);
  const style = doc.design.textStyles?.[group] ?? {};
  const gateRole=doc.templateId==='magazine-3'&&['title','kicker','subtitle','quote','attribution','author','photoCredit'].includes(group)?group as GateTextRole:undefined;
  const [baseline,setBaseline] = useState({weight:400,italic:false,underline:false,size:'Template',line:'Template',color:'#111418'});
  useEffect(()=>{
    const selector=textStyleSelector(group);
    const preview=document.querySelector<HTMLElement>('.paper-scroll:not([inert])');
    if (!selector || !preview) return;
    const read=()=>{
      const node=preview.querySelector<HTMLElement>(`.pages :is(${selector})`);
      if (!node) return;
      const css=getComputedStyle(node);
      const rgb=css.color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
      const line=parseFloat(css.lineHeight)/parseFloat(css.fontSize);
      const next={weight:Number(css.fontWeight)||400,italic:css.fontStyle==='italic',underline:css.textDecorationLine.includes('underline'),
        size:`${(parseFloat(css.fontSize)*.75).toFixed(1)} pt`,line:Number.isFinite(line)?line.toFixed(2):'Normal',
        color:rgb ? '#'+rgb.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join('') : '#111418'};
      setBaseline(previous=>Object.keys(next).every(key=>previous[key as keyof typeof next]===next[key as keyof typeof next])?previous:next);
    };
    read();
    // Pagination is deferred: refresh pressed states after the new preview lands.
    let frame=0;
    const observer=new MutationObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(read);});
    observer.observe(preview,{subtree:true,childList:true,attributes:true,characterData:true});
    return()=>{observer.disconnect();cancelAnimationFrame(frame);};
  },[group,doc]);
  const set = <K extends keyof TextStyle>(key:K,value:TextStyle[K]) => update(d=>{
    if(key==='color'&&value!==undefined)clearCaptionColorOverrides(d,group);
    if(key==='captionPadding'&&value!==undefined)clearCaptionPaddingOverrides(d,group);
    d.design.textStyles ??= {};
    const next={...d.design.textStyles[group]};
    if(value===undefined)delete next[key];else next[key]=value;
    if(Object.keys(next).length)d.design.textStyles[group]=next;else delete d.design.textStyles[group];
  });
  const needed = (key:Property) => !existing.includes(key) || (key!=='tracking' && style[key]!==undefined);
  const wrap = (key:Property,node:React.ReactNode) => needed(key) ? <div key={key} className="typography-control" data-complete-property={key} style={{order:ORDER[key]}}>{node}</div> : null;
  const boolean = (key:'italic'|'underline',label:string,current:boolean) => <button type="button" className={`tool-btn${current?' is-active':''}`} aria-label={label} aria-pressed={current} onClick={()=>set(key,!current)}>{label==='Italic'?<i>I</i>:<u>U</u>}</button>;
  return <>
    {wrap('fontFamily',<LabeledSelect label="Font" value={style.fontFamily ?? ''} options={[{value:'',label:'Template font'},...fontOptions([...new Set(['Georgia',...ALL_FONTS,style.fontFamily].filter((f):f is string=>!!f))])]} onChange={v=>set('fontFamily',v||undefined)} />)}
    {wrap('fontSize',<OptionalNumber label="Size (pt)" value={style.fontSize} min={4} max={120} step={.5} placeholder={baseline.size} onChange={v=>set('fontSize',v)} />)}
    {wrap('fontWeight',<><LabeledSelect label="Weight" value={style.fontWeight===undefined?'':String(style.fontWeight)} options={[{value:'',label:'Template weight'},...[[300,'Light'],[400,'Regular'],[500,'Medium'],[600,'Semibold'],[700,'Bold'],[800,'Extra bold'],[900,'Black']].map(([value,label])=>({value:String(value),label:String(label)}))]} onChange={v=>set('fontWeight',v?Number(v):undefined)} /><button className="tool-btn" type="button" aria-label="Bold" aria-pressed={(style.fontWeight??baseline.weight)>=700} onClick={()=>set('fontWeight',(style.fontWeight??baseline.weight)>=700?400:700)}><b>B</b></button></>)}
    {wrap('italic',boolean('italic','Italic',style.italic??baseline.italic))}
    {wrap('underline',boolean('underline','Underline',style.underline??baseline.underline))}
    {wrap('color',<label className="field field--inline"><span className="field-label">Text colour</span><span className="color-input"><input aria-label="Text colour" type="color" value={style.color??baseline.color} onInput={e=>set('color',e.currentTarget.value)} onChange={e=>{if(useDoc.getState().doc.design.textStyles?.[group]?.color!==e.target.value)set('color',e.target.value);}} /><button type="button" className="style-reset-btn" title="Use template colour" onClick={()=>set('color',undefined)}>↺</button></span></label>)}
    {captionBackgroundSelector(group)&&wrap('backgroundOpacity',<OptionalNumber label="Background opacity (%)" value={style.backgroundOpacity} min={0} max={100} step={5} placeholder="Template" onChange={v=>set('backgroundOpacity',v)}/>)}
    {captionBackgroundSelector(group)&&wrap('captionPadding',<LabeledSelect label="Caption spacing" value={style.captionPadding??''} options={[{value:'',label:'Template default'},{value:'padded',label:'With padding'},{value:'tight',label:'Tight'}]} onChange={v=>set('captionPadding',(v||undefined) as TextStyle['captionPadding'])}/>)}
    {gateRole ? doc.design.textDirection!=='rtl'&&wrap('tracking',<LabeledNumber label="Letter spacing" unit="px" value={gateTypography(doc.design,gateRole).letterSpacing} min={-3} max={12} step={.1} onChange={value=>update(d=>{d.design.gateTypography??={};d.design.gateTypography[gateRole]={...d.design.gateTypography[gateRole],letterSpacing:Math.max(-3,Math.min(12,value))};})}/>)
      : trackingRoleSupported(doc.templateId,group)&&wrap('tracking',<LetterSpacingField value={doc.design.textTracking?.[group]} onChange={value=>update(d=>{d.design.textTracking ??= {};if(value===undefined)delete d.design.textTracking[group];else d.design.textTracking[group]=value;})} />)}
    {wrap('lineHeight',<OptionalNumber label="Line spacing" value={style.lineHeight} min={.8} max={3} step={.05} placeholder={baseline.line} onChange={v=>set('lineHeight',v)} />)}
    {wrap('align',<LabeledSelect label="Text alignment" value={style.align??''} options={[{value:'',label:'Template alignment'},...['left','center','right','justify'].map(value=>({value,label:value[0].toUpperCase()+value.slice(1)}))]} onChange={v=>set('align',(v||undefined) as TextStyle['align'])} />)}
    {Object.keys(style).length>0 && <div className="typography-control" style={{order:91}}><button type="button" className="style-reset-btn text-style-reset" onClick={()=>update(d=>{delete d.design.textStyles?.[group];})}>Reset added styling</button></div>}
  </>;
}
