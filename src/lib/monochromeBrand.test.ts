// @vitest-environment node
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';

it('thresholds all illustrated brand channels to binary ink, not grayscale',()=>{
 const html=readFileSync('index.html','utf8');
 expect(html).toContain('id="magazoo-ink"');
 for(const channel of ['R','G','B','A'])expect(html).toContain(`<feFunc${channel} type="discrete" tableValues="0 1"/>`);
 for(const path of ['src/styles/wordmark.css','src/components/MagazooLoader.css','src/admin/welcome.css'])expect(readFileSync(path,'utf8')).toContain('filter:url(#magazoo-ink)');
 expect(readFileSync('src/admin/welcome.css','utf8')).toContain('filter:url(#magazoo-ink) invert(1)');
});
