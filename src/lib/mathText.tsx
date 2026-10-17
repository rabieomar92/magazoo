import {createElement, type ReactNode} from 'react';
import {mathSpans,renderTex} from './richtext';

/** Pure rendering only: never changes authored strings or live DOM. Attributes,
 * URLs, input values and existing rendered math are deliberately untouched. */
export function mathTextChildren(value:ReactNode):ReactNode {
  if(Array.isArray(value))return value.map(mathTextChildren);
  if(typeof value!=='string'||!/[\\$]/.test(value))return value;
  const children:ReactNode[]=[];let end=0;
  for(const span of mathSpans(value)){
    if(span.start>end)children.push(value.slice(end,span.start));
    children.push(createElement('span',{key:`math-${span.start}`,className:'tex',dangerouslySetInnerHTML:{__html:renderTex(span.tex)}}));
    end=span.end;
  }
  if(!children.length)return value;
  if(end<value.length)children.push(value.slice(end));
  return children;
}
