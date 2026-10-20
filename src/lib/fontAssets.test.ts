// @vitest-environment node
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

describe('bundled TeX Gyre webfonts',()=>{
  const css=readFileSync(resolve('src/styles/fonts.css'),'utf8');
  for(const family of ['schola','pagella'])for(const face of ['regular','italic','bold','bolditalic']){
    it(`ships ${family} ${face} as a valid local WOFF2 face`,()=>{
      const filename=`texgyre${family}-${face}.woff2`;
      const file=readFileSync(resolve('src/assets/fonts/tex-gyre',filename));
      expect(file.toString('ascii',0,4)).toBe('wOF2');
      expect(file.readUInt32BE(8)).toBe(file.length);
      expect(file.length).toBeGreaterThan(30000);
      expect(css).toContain(`url('../assets/fonts/tex-gyre/${filename}')`);
    });
  }
  it('keeps publication fonts separate from the Google Sans interface',()=>{
    const index=readFileSync(resolve('src/index.css'),'utf8');
    expect(index).toContain("@import './styles/fonts.css'");
    expect(index).toContain("font: 14px/1.4 var(--ui-font,'Google Sans',Arial,sans-serif)");
    expect(index).not.toContain('--magazoo-ui-font');
    expect(index).not.toMatch(/\.page\s*\{/);
    for(const path of ['src/styles/admin.css','src/issue/issue.css'])expect(readFileSync(resolve(path),'utf8')).not.toContain('TeX Gyre');
    expect(readFileSync(resolve('src/assets/fonts/tex-gyre/GUST-FONT-LICENSE.txt'),'utf8')).toContain('LaTeX Project Public License');
  });
});
