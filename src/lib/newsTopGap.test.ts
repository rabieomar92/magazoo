import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';

it('keeps news stories four millimetres below the masthead rather than adding a second margin',()=>{
 const css=readFileSync('src/styles/news.css','utf8');
 expect(css).toContain('padding-top: max(0mm, calc(var(--topbar-offset) + 10mm - var(--margin)))');
 expect(css).not.toContain('padding-top: max(13mm');
});
