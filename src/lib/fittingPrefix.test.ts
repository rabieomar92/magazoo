import {describe,it,expect} from 'vitest';
import {fittingPrefix} from './fittingPrefix';
describe('single-column fitting prefix',()=>{
  it.each([0,1,9,34,99])('finds %s fitting paragraphs with logarithmic measurements',fit=>{
    let calls=0;expect(fittingPrefix(100,n=>{calls++;return n<=fit;})).toBe(fit);expect(calls).toBeLessThanOrEqual(9);
  });
  it('falls back when a previously fitting answer is invalidated',()=>{
    const seen=new Map<number,number>();
    expect(fittingPrefix(10,n=>{const count=(seen.get(n)??0)+1;seen.set(n,count);return n<=4&&(n!==4||count===1);})).toBe(3);
  });
});
