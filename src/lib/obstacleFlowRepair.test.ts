import {expect,it} from 'vitest';import {hasObstacleColumns} from './physicalFlowPages';import type {Piece} from './paginate';
it('prevents a neighbouring text tail from shifting pre-paginated obstacle columns',()=>{
  const text:Piece={kind:'text',sourceId:'p',text:'Keep all authored text',cont:false};
  const grid:Piece={kind:'image-columns',height:700,columns:[{segments:[{order:0,top:0,bottom:400,pieces:[text]}]}]};
  expect(hasObstacleColumns([[text],[grid]])).toBe(true);expect(hasObstacleColumns([[grid],[text]])).toBe(true);
  expect(hasObstacleColumns([[text],[text]])).toBe(false);expect(hasObstacleColumns([])).toBe(false);
});
