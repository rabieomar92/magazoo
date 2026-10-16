import {describe,it,expect} from 'vitest';
import {safeCaptionPosition,imageCaptionObstacle,type CaptionObstacle} from './imageCaption';
import {emptyDoc,type PlacedImage} from '../schema/document';
const rect=(left:number,top:number,right:number,bottom:number,gap=0):CaptionObstacle=>({gap,points:[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}]});
describe('independent image captions',()=>{
  it('keeps an already-safe requested position, free of column snapping',()=>{
    const desired={x:12.3,y:43.7,width:25,height:10};
    expect(safeCaptionPosition(desired,203,267,[rect(50,60,150,180)])).toEqual({...desired,fits:true});
  });
  it('moves an overlapping caption to the nearest image-free slot',()=>{
    const result=safeCaptionPosition({x:40,y:70,width:30,height:10},203,267,[rect(40,60,120,100,1)]);
    expect(result.fits).toBe(true);expect(result.y).toBe(49);expect(result.x).toBe(40);
  });
  it('uses empty contour pockets, not the original rectangular image frame',()=>{
    const crescent:CaptionObstacle={gap:.8,points:[{x:20,y:30},{x:120,y:30},{x:120,y:50},{x:40,y:50},{x:40,y:150},{x:120,y:150},{x:120,y:170},{x:20,y:170}]};
    const desired={x:60,y:80,width:40,height:15};
    expect(safeCaptionPosition(desired,203,267,[crescent])).toEqual({...desired,fits:true});
  });
  it('reports impossible captions explicitly and stays within trim when possible',()=>{
    expect(safeCaptionPosition({x:0,y:0,width:50,height:10},203,267,[rect(0,0,203,267)]).fits).toBe(false);
    expect(safeCaptionPosition({x:0,y:0,width:50,height:400},203,267,[]).fits).toBe(false);
    expect(safeCaptionPosition({x:900,y:900,width:500,height:10},203,267,[])).toEqual({x:0,y:257,width:203,height:10,fits:true});
    const result=safeCaptionPosition({x:NaN,y:Infinity,width:NaN,height:10},203,267,[]);
    expect(result).toEqual({x:0,y:0,width:40,height:10,fits:true});
  });
  it('projects the same smoothed/bleeding artwork as the visible image',()=>{
    const d=emptyDoc().design;
    const i:PlacedImage={id:'x',assetId:'a',widthCols:2,caption:'Copy',heightMm:100,anchor:{page:1,column:0,y:140},bleed:{bottom:true},wrapShape:'polygon',wrapSmoothing:1,wrapPolygon:[{x:50,y:10},{x:90,y:50},{x:50,y:90},{x:10,y:50}]};
    const outline=imageCaptionObstacle(i,{src:'',naturalWidth:600,naturalHeight:600},d,267);
    expect(outline.points).toHaveLength(256);
    expect(Math.max(...outline.points.map(p=>p.y))).toBeCloseTo(254.3);
    expect(i.anchor.y).toBe(140);
  });
  it('never overlaps rectangular images across a matrix of sizes, positions and captions',()=>{
    for(const [w,h] of [[176,250],[203,267],[210,297]])for(const x of [0,20,w-60])for(const y of [0,70,h-90])for(const width of [12,40,100])for(const height of [4,20,60]){
      const obstacle=rect(x,y,Math.min(w,x+60),Math.min(h,y+90),.8);
      const r=safeCaptionPosition({x:x+5,y:y+10,width,height},w,h,[obstacle]);
      if(!r.fits)continue;
      expect(r.x>=0&&r.y>=0&&r.x+r.width<=w+.001&&r.y+r.height<=h+.001).toBe(true);
      const crosses=r.x<Math.min(w,x+60)+.79&&r.x+r.width>x-.79&&r.y<Math.min(h,y+90)+.79&&r.y+r.height>y-.79;
      expect(crosses).toBe(false);
    }
  });
});
