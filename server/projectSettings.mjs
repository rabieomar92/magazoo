import {issueError} from './issue.mjs';
export function validateProjectSettings(value){
 const custom=typeof value?.paperSize==='string'?/^custom:(\d+(?:\.\d{1,2})?)x(\d+(?:\.\d{1,2})?)$/.exec(value.paperSize):null;
 const validCustom=custom&&custom.slice(1).every(n=>Number(n)>=50&&Number(n)<=480);
 if(!value||typeof value!=='object'||Array.isArray(value)||(!['a4','b5','jis-b5','vendor-b5','magazine'].includes(value.paperSize)&&!validCustom))issueError(400,'Choose a supported project paper size or custom dimensions between 50 and 480 mm.');
 if(!Number.isFinite(value.bleedMm)||value.bleedMm<0||value.bleedMm>10)issueError(400,'Bleed must be between 0 and 10 mm per edge.');
 return {paperSize:value.paperSize,bleedMm:value.bleedMm};
}
export function applyProjectSettings(body,settings){
 if(!settings)return body;
 const doc=JSON.parse(body);
 doc.design={...doc.design,pageFormat:settings.paperSize,bleedMm:settings.bleedMm,bleedCanvas:true,projectLayout:true};
 return JSON.stringify(doc);
}
