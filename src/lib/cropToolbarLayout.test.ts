// @vitest-environment node
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
it('reserves stable space for three-digit crop zoom percentages',()=>{
 const css=readFileSync('src/styles/image-canvas.css','utf8');
 expect(css).toContain('grid-template-columns:auto minmax(0,1fr) 4ch');
 expect(css).toContain('font-variant-numeric:tabular-nums');
 expect(css).toContain('.canvas-crop-zoom input[type="range"]{width:100%;min-width:0');
 expect(css).toContain('@media(max-width:440px)');
});
