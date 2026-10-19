import {issueError} from './issue.mjs';
export function validateProjectSettings(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||!['a4','b5','jis-b5','vendor-b5','magazine'].includes(value.paperSize))issueError(400,'Choose a supported project paper size.');
 if(!Number.isFinite(value.bleedMm)||value.bleedMm<0||value.bleedMm>10)issueError(400,'Bleed must be between 0 and 10 mm per edge.');
 return {paperSize:value.paperSize,bleedMm:value.bleedMm};
}
export function applyProjectSettings(body,settings){
 if(!settings)return body;
 const doc=JSON.parse(body);
 doc.design={...doc.design,pageFormat:settings.paperSize,bleedMm:settings.bleedMm,bleedCanvas:true,projectLayout:true};
 return JSON.stringify(doc);
}
