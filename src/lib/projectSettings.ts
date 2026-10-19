import type {PdfPageSize} from './pdfPageSize';
export interface ProjectSettings{paperSize:PdfPageSize;bleedMm:number}
export function readProjectSettings(value:unknown):ProjectSettings|undefined{
 if(value===undefined)return undefined;
 const settings=value as ProjectSettings;
 if(!settings||!['a4','b5','jis-b5','vendor-b5','magazine'].includes(settings.paperSize)||!Number.isFinite(settings.bleedMm)||settings.bleedMm<0||settings.bleedMm>10)throw new Error('The backup has invalid project format settings.');
 return {paperSize:settings.paperSize,bleedMm:settings.bleedMm};
}
