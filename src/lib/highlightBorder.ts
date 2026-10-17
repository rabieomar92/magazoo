import type {Design,TemplateId} from '../schema/document';

export function highlightBorderEnabled(design:Design,template?:TemplateId){
  return design.highlightBorder ?? template!=='magazine-2';
}

/** Transparent paint keeps the exact same measured box and text width when
 * hiding an existing border. It must not create a new pagination difference. */
export function highlightBorderVars(design:Design):Record<string,string>{
  const color=/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(design.highlightBorderColor??'')?design.highlightBorderColor!:'var(--accent)';
  return {
    '--hl-border-color':design.highlightBorder===false?'transparent':color,
    '--mag2-hl-border':design.highlightBorder===true?`1px solid ${color}`:'0 solid transparent',
  };
}
