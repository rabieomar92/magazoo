import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('shared GUI dropdown spacing',()=>{
  const css=readFileSync('src/styles/select-controls.css','utf8');
  it('covers admin, editor and compiler, with a reserved chevron area and inset',()=>{
    expect(css).toContain(':is(.admin-page,.app,.studio) select:not([multiple]):not([size])');
    expect(css).toContain('padding-inline-end:38px !important');
    expect(css).toContain('background-position:right 12px center !important');
    expect(css).toContain('background-size:14px 14px !important');
    expect(css).not.toMatch(/(?:^|\n)\s*\.page\b/);
  });
  it('supports RTL, disabled controls and native high-contrast controls',()=>{
    expect(css).toContain(':dir(rtl)');expect(css).toContain('background-position:left 12px center !important');
    expect(css).toContain('select:disabled');expect(css).toContain('@media (forced-colors:active)');expect(css).toContain('appearance:auto');
  });
});
