import {Fragment,jsxDEV as reactJsxDEV} from 'react/jsx-dev-runtime';
import {mathTextChildren} from '../mathText';
export {Fragment} from 'react/jsx-dev-runtime';
export type {JSX} from 'react/jsx-dev-runtime';
export const jsxDEV:typeof reactJsxDEV=(type,props,key,isStaticChildren,source,self)=>reactJsxDEV(type,
  (type===Fragment||typeof type==='string'&&!['input','textarea','select','option','script','style','svg','title'].includes(type))&&props&&typeof props==='object'&&'children' in props
    ?{...props,children:mathTextChildren(props.children as import('react').ReactNode)}:props,key,isStaticChildren,source,self);
