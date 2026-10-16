import {describe,it,expect} from 'vitest';
import {shareUnchanged} from './structuralSharing';

describe('unchanged document branches',()=>{
  it('reuses sibling rows and embedded image data without changing past snapshots',()=>{
    const before={blocks:[{id:'a',text:'Before'},{id:'b',text:'Other'}],assets:{photo:{src:'x'.repeat(100000),width:50}}};
    const draft=structuredClone(before);draft.blocks[0].text='After';
    const after=shareUnchanged(before,draft);
    expect(after).not.toBe(before);expect(after.blocks[0]).not.toBe(before.blocks[0]);
    expect(after.blocks[1]).toBe(before.blocks[1]);expect(after.assets).toBe(before.assets);
    expect(before.blocks[0].text).toBe('Before');
  });
  it('retains additions, deletions, array reordering and explicit undefined fields',()=>{
    expect(shareUnchanged({a:1},{a:1,b:undefined})).toHaveProperty('b');
    expect(shareUnchanged({a:1,b:2},{a:1})).not.toHaveProperty('b');
    const before=[{id:1},{id:2}];expect(shareUnchanged(before,[before[1],before[0]])).toEqual([{id:2},{id:1}]);
    expect(shareUnchanged([1,2],[1])).toEqual([1]);
    expect(shareUnchanged(new Array(2),[])).toHaveLength(0);
  });
  it('returns the same root for no-ops and compares non-finite numbers safely',()=>{
    const before={a:[{n:NaN}],b:null};expect(shareUnchanged(before,{a:[{n:NaN}],b:null})).toBe(before);
    expect(shareUnchanged(0,-0)).toBe(-0);
  });
});
