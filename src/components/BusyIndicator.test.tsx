import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {BusyIndicator} from './BusyIndicator';
it('keeps a readable accessible status with decorative motion',()=>{
 const html=renderToStaticMarkup(<BusyIndicator label="Saving…"/>);
 expect(html).toContain('role="status"');expect(html).toContain('aria-hidden="true"');expect(html).toContain('Saving…');
});
it('uses quiet opacity animation, no rotation, and respects reduced motion',()=>{
 const css=readFileSync('src/components/BusyIndicator.css','utf8');
 expect(css).not.toContain('rotate(');expect(css).toContain('prefers-reduced-motion:reduce');expect(css).toContain('animation:none; opacity:.65');
});
