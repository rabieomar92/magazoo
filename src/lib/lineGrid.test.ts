import {describe,it,expect} from 'vitest';
import {lineGridUp,lineGridDown} from './lineGrid';
describe('whole-line image clearance',()=>{
  it.each([0,1,7.6,16,23.1,90.3])('keeps arbitrary image position %s on the shared baseline grid',y=>{
    const step=15.84,origin=4.2;
    const up=lineGridUp(y,step,origin),down=lineGridDown(y,step,origin);
    expect(up).toBeGreaterThanOrEqual(y-1e-6);expect(down).toBeLessThanOrEqual(y+1e-6);
    expect((up-origin)/step).toBeCloseTo(Math.round((up-origin)/step));
    expect((down-origin)/step).toBeCloseTo(Math.round((down-origin)/step));
  });
  it('does not add a line because of floating point noise or unavailable layout',()=>{
    expect(lineGridUp(30+1e-9,15)).toBe(30);expect(lineGridDown(30-1e-9,15)).toBe(30);
    expect(lineGridUp(23,NaN)).toBe(23);expect(lineGridDown(23,0)).toBe(23);
  });
});
