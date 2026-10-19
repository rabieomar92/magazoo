import {it,expect} from 'vitest';
import {marginTextDragPosition} from './useMarginTextDrag';
it('moves the credit in physical millimetres on either alternating side',()=>{
 expect(marginTextDragPosition(6,20,3,-8,false,257)).toEqual({edgeOffset:9,bottomOffset:28});
 expect(marginTextDragPosition(6,20,3,-8,true,257)).toEqual({edgeOffset:3,bottomOffset:28});
});
it('clamps the rail to its side margin and available page height',()=>{
 expect(marginTextDragPosition(6,20,-100,100,false,257)).toEqual({edgeOffset:2,bottomOffset:0});
 expect(marginTextDragPosition(6,20,100,-500,false,180)).toEqual({edgeOffset:30,bottomOffset:180});
});
