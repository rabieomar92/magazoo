import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
it('keeps photo actions content-sized in a compact responsive inspector',()=>{
 const css=readFileSync('src/styles/canvas-image-pan.css','utf8');
 const source=readFileSync('src/paper/CanvasImagePanning.tsx','utf8');
 expect(source).toContain('className="canvas-pan-actions"');
 expect(css).toContain('width:min(440px,calc(100vw - 24px))');
 expect(css).toContain('display:flex;justify-content:flex-end;gap:8px');
 expect(css).toContain('flex:0 0 auto;width:auto;min-width:76px');
 expect(css).not.toContain('grid-template-columns:1fr auto');
});
