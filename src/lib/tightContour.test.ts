import {describe,it,expect} from 'vitest';
import {tightContour,measureContour,contourOpening,offsetContourBands,type ContourBand} from './tightContour';
const triangle:ContourBand={top:20,bottom:100,outline:{points:[{x:0,y:20},{x:80,y:60},{x:0,y:100}],gap:0}};
const vertices=(path:string)=>[...path.matchAll(/([\d.-]+)px ([\d.-]+)px/g)].map(m=>({x:Number(m[1]),y:Number(m[2])}));
describe('line-by-line image boundaries',()=>{
  it.each(['left','right'] as const)('rejects an unreadable %s-side strip while retaining a genuinely readable lane',side=>{
    const band=(edge:number):ContourBand=>({top:20,bottom:100,outline:{points:[{x:0,y:20},{x:edge,y:20},{x:edge,y:100},{x:0,y:100}].map(p=>({x:side==='left'?p.x:160-p.x,y:p.y})),gap:0}});
    // A 64 px remainder in a 160 px column used to be accepted by the 5 em
    // threshold. It now stays empty; the same words continue below the image.
    const narrow=tightContour([band(94)],160,140,12*9)!;
    const rows=vertices(narrow.path).filter(p=>p.y>=30&&p.y<=90);
    expect(rows.every(p=>p.x===(side==='left'?160:0))).toBe(true);
    const readable=tightContour([band(40)],160,140,12*9)!;
    expect(vertices(readable.path).some(p=>p.y===60&&p.x===(side==='left'?42:118))).toBe(true);
  });
  it('isolates a three-line opener above a contour and rebases the remaining outline',()=>{
    const band={...triangle,top:80,bottom:160,outline:{points:triangle.outline!.points.map(p=>({...p,y:p.y+60})),gap:2}};
    expect(contourOpening([band],200,240,45)).toEqual({top:0,bottom:76});
    const shifted=offsetContourBands([band,{top:180,bottom:200}],76);
    expect(shifted[0].top).toBe(4);
    expect(shifted[0].outline!.points[0].y).toBe(4);
    expect(shifted[1]).toEqual({top:104,bottom:124,outline:undefined});
    expect(band.outline.points[0].y).toBe(80);
  });
  it('moves the entire initial past a top image instead of putting lines beneath its glyph',()=>{
    expect(contourOpening([triangle],200,170,45)).toEqual({top:102,bottom:170});
    expect(contourOpening([triangle,{top:110,bottom:160}],200,170,45)).toBeUndefined();
    expect(contourOpening([triangle],200,170,NaN)).toBeUndefined();
    const outside={...triangle,outline:{points:triangle.outline!.points.map(p=>({...p,x:p.x+300})),gap:0}};
    expect(contourOpening([outside],200,170,45)).toEqual({top:0,bottom:170});
  });
  it('reserves different widths at different heights, never a column-sized image band',()=>{
    const shape=tightContour([triangle],200,140)!;
    expect(shape.side).toBe('left');
    const p=vertices(shape.path);
    expect(p.some(p=>p.x===82&&p.y===60)).toBe(true);
    expect(p.some(p=>p.x>40&&p.x<50&&p.y===38)).toBe(true);
    expect(p.every(p=>p.x<=82)).toBe(true);
  });
  it('follows the opposite side and expands by the chosen text clearance',()=>{
    const shape=tightContour([{...triangle,outline:{points:triangle.outline!.points.map(p=>({x:200-p.x,y:p.y})),gap:4}}],200,140)!;
    expect(shape.side).toBe('right');
    expect(Math.min(...vertices(shape.path).map(p=>p.x))).toBe(114);
  });
  it('keeps caption bands clear alongside the exact image shape',()=>{
    const shape=tightContour([triangle,{top:106,bottom:120}],200,140)!;
    expect(vertices(shape.path).some(p=>p.x===200&&p.y===110)).toBe(true);
  });
  it('does not create fake shaped columns for an outline outside this region',()=>{
    expect(tightContour([triangle],0,100)).toBeUndefined();
    expect(tightContour([{top:200,bottom:280,outline:triangle.outline}],200,140)).toBeUndefined();
    expect(tightContour([{...triangle,outline:{points:triangle.outline!.points.map(p=>({x:p.x-300,y:p.y})),gap:0}}],200,140)).toBeUndefined();
    expect(tightContour([{top:0,bottom:10}],200,140)).toBeUndefined();
  });
  it('reserves opposing shapes safely when both occupy the same line',()=>{
    const opposite={...triangle,outline:{points:triangle.outline!.points.map(p=>({x:200-p.x,y:p.y})),gap:0}};
    const shape=tightContour([triangle,opposite],200,140)!;
    expect(vertices(shape.path).some(p=>p.x===200&&p.y===60)).toBe(true);
  });
  it('paints one matching measuring float and prevents atomic figures overlapping it',()=>{
    const host=document.createElement('div');host.innerHTML='<p>Unchanged copy</p><figure>Equation</figure>';
    const shape=tightContour([triangle],200,140)!;
    measureContour(host,shape);measureContour(host,shape);
    expect(host.querySelectorAll('[data-tight-contour]')).toHaveLength(1);
    expect((host.firstElementChild as HTMLElement).style.cssFloat).toBe('left');
    // jsdom's CSS parser does not implement polygon() shape-outside. Its real
    // line geometry is covered by the Chromium preview smoke test.
    expect((host.firstElementChild as HTMLElement).style.height).toBe('100%');
    expect(host.querySelector('p')!.textContent).toBe('Unchanged copy');
    expect(host.querySelector('figure')!.style.clear).toBe('both');
  });
});
