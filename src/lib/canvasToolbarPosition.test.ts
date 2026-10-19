import {describe,it,expect} from 'vitest';
import {canvasToolbarPosition} from './canvasToolbarPosition';
describe('contextual toolbar placement',()=>{
 it('flips above the selection and stays inside the right edge',()=>{
  expect(canvasToolbarPosition({left:950,top:600,bottom:650},400,80,1024,700)).toEqual({left:612,top:512});
 });
 it('clamps a partially offscreen selection',()=>{
  expect(canvasToolbarPosition({left:-30,top:-20,bottom:20},300,80,400,300)).toEqual({left:12,top:28});
 });
});
