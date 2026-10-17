import {Fragment,jsx as reactJsx,jsxs as reactJsxs} from 'react/jsx-runtime';
import {mathTextChildren} from '../mathText';
export {Fragment} from 'react/jsx-runtime';
export type {JSX} from 'react/jsx-runtime';

// Paper-only JSX entry point. Rendering math here covers every text leaf in
// every template, including measuring copies, without DOM post-processing.
function propsFor(type:unknown,props:unknown){
  return (type===Fragment||typeof type==='string'&&!['input','textarea','select','option','script','style','svg','title'].includes(type))&&props&&typeof props==='object'&&'children' in props
    ?{...props,children:mathTextChildren(props.children as import('react').ReactNode)}:props;
}
export const jsx:typeof reactJsx=(type,props,key)=>reactJsx(type,propsFor(type,props),key);
export const jsxs:typeof reactJsxs=(type,props,key)=>reactJsxs(type,propsFor(type,props),key);
