import {describe,expect,it} from 'vitest';
import {isCanvasOutlineValid} from './imageCanvas';
describe('canvas stroke validation',()=>{
  it('rejects straight strokes with pointer rounding noise, not actual closed borders',()=>{
    expect(isCanvasOutlineValid([{x:10,y:10},{x:40,y:40.02},{x:70,y:70}])).toBe(false);
    expect(isCanvasOutlineValid([{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}])).toBe(true);
    expect(isCanvasOutlineValid([{x:0,y:0},{x:100,y:100},{x:0,y:100},{x:100,y:0}])).toBe(true);
    expect(isCanvasOutlineValid([{x:0,y:0}])).toBe(false);
  });
});
