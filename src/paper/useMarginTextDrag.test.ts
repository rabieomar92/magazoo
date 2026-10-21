import {it,expect} from 'vitest';
import {marginTextDragPosition} from './useMarginTextDrag';
it('moves vertically while preserving the numeric side offset on either alternating side',()=>{
 expect(marginTextDragPosition(6,20,3,-8,false,257)).toEqual({edgeOffset:6,bottomOffset:28});
 expect(marginTextDragPosition(6,20,3,-8,true,257)).toEqual({edgeOffset:6,bottomOffset:28});
});
it('ignores horizontal-only movement without rounding the authored edge distance',()=>{
 expect(marginTextDragPosition(6.25,20,1000,0,true,257)).toEqual({edgeOffset:6.25,bottomOffset:20});
});
it('clamps the rail to its side margin and available page height',()=>{
 expect(marginTextDragPosition(6,20,-100,100,false,257)).toEqual({edgeOffset:6,bottomOffset:0});
 expect(marginTextDragPosition(6,20,100,-500,false,180)).toEqual({edgeOffset:6,bottomOffset:180});
});
