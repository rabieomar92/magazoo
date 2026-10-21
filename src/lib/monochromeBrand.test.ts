// @vitest-environment node
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';

it('keeps monochrome ink while preserving smooth edges and source transparency',()=>{
 const html=readFileSync('index.html','utf8');
 expect(html).toContain('id="magazoo-ink"');
 for(const channel of ['R','G','B'])expect(html).toContain(`<feFunc${channel} type="table" tableValues="0 0 0 0 0 1 1 1 1 1"/>`);
 expect(html).toContain('<feFuncA type="identity"/>');
 expect(html).not.toContain('type="discrete"');
 const filmCss=readFileSync('src/components/MagazooLoader.css','utf8');
 expect(filmCss).toContain('object-fit:contain;filter:none');
 expect(filmCss).not.toContain('filter:url(#magazoo-ink)');
 expect(readFileSync('src/admin/welcome.css','utf8')).toContain('.welcome-original-logo{filter:none}');
 expect(readFileSync('src/admin/welcome.css','utf8')).toContain('filter:invert(1)');
 for(const path of ['src/components/Wordmark.tsx','src/components/AnimatedMagazooMark.tsx','src/admin/WelcomePage.tsx','index.html'])expect(readFileSync(path,'utf8')).toContain('magazoo-mark-hd.png');
});
