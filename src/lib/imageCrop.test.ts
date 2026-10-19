import {expect,it} from 'vitest';
import {cropClip,cropPoints,cropPreset} from './imageCrop';
import {normalizeImageFrame} from './imageFrame';
it('keeps the crop fixed in frame space as the photograph pans',()=>{
 const crop={shape:'diamond' as const,points:cropPreset('diamond')};
 expect(cropClip(crop,200,100,-20,10)).toContain('120px -10px');
 expect(cropClip(crop,200,100,30,40)).toContain('70px -40px');
 expect(normalizeImageFrame({crop}).crop).toEqual(crop);
 expect(cropPoints(undefined)).toHaveLength(4);
});
