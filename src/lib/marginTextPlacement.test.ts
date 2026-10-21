import {it,expect} from 'vitest';
import {marginTextPlacement} from './marginTextPlacement';
it('keeps the 22 mm default where no image overlaps',()=>{
 expect(marginTextPlacement(192,268,3,60,10,22,false,[])).toMatchObject({right:false,bottom:22,blocked:false});
});
it('moves above a bleeding photograph on the same edge',()=>{
 const p=marginTextPlacement(192,268,3,60,10,22,false,[{left:0,right:100,top:170,bottom:268}]);
 expect(p).toMatchObject({right:false,blocked:false});expect(p.bottom).toBeGreaterThanOrEqual(100);
});
it('switches edges when one side is covered for its full height',()=>{
 expect(marginTextPlacement(192,268,3,60,10,22,false,[{left:0,right:80,top:0,bottom:268}])).toMatchObject({right:true,bottom:22,blocked:false});
});
it('reports a full-page photograph rather than pretending that a clear slot exists',()=>{
 expect(marginTextPlacement(192,268,3,60,10,22,false,[{left:0,right:192,top:0,bottom:268}])).toMatchObject({blocked:true});
});
it('honours a deliberate vertical position over an image with contrast backing',()=>{
 expect(marginTextPlacement(192,268,3,60,10,35.5,false,[{left:0,right:100,top:170,bottom:268}],false)).toMatchObject({right:false,bottom:35.5,blocked:true});
});
it('keeps manual placement on the chosen edge and clamps only at physical page boundaries',()=>{
 const images=[{left:0,right:80,top:0,bottom:268}];
 expect(marginTextPlacement(192,268,3,60,10,0,false,images,false)).toMatchObject({right:false,bottom:0});
 expect(marginTextPlacement(192,268,3,60,10,999,false,images,false)).toMatchObject({right:false,bottom:208});
});
