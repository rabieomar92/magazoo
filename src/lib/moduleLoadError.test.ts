import {expect,it} from 'vitest';
import {moduleLoadErrorMessage} from './moduleLoadError';
import {readFileSync} from 'node:fs';
it('explains stale module failures without automatic reload or lost work',()=>{
 expect(moduleLoadErrorMessage('Failed to fetch dynamically imported module: http://127.0.0.1:8787/assets/pdf-old.js')).toContain('Save any open edits');
 expect(moduleLoadErrorMessage('Document is locked')).toBe('Document is locked');
});
it('retains versioned files for open tabs and consistently desaturates the brand artwork',()=>{
 expect(readFileSync('vite.config.ts','utf8')).toContain('emptyOutDir: false');
 expect(readFileSync('src/styles/wordmark.css','utf8')).toContain('img[src$="/magazoo-mark.png"] { filter:grayscale(1)');
 expect(readFileSync('index.html','utf8')).toContain('filter:grayscale(1)');
});
