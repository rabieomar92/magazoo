import {expect,it} from 'vitest';
import {presetFor,TEMPLATES} from '../store/presets';
import {migrate} from '../schema/document';
import {captionBackgroundSelector,textStylesCss} from './textStyles';
it.each(TEMPLATES.map(t=>t.id))('%s preserves independent caption-background alpha through save/reload',id=>{
 const doc=presetFor(id);doc.design.textStyles={heroCaption:{backgroundOpacity:25,color:'#ffffff'},'image-caption:a':{backgroundOpacity:0},'gallery-caption:b':{backgroundOpacity:75},'news:c:caption':{backgroundOpacity:100}};
 const copy=migrate(JSON.parse(JSON.stringify(doc)));
 expect(copy.design.textStyles).toEqual(doc.design.textStyles);
 const css=textStylesCss(copy.design,'alpha');
 for(const alpha of [0,.25,.75,1])expect(css).toContain(`background:rgba(0,0,0,${alpha}) !important`);
 expect(css).not.toContain('opacity:');expect(css).toContain('color:#ffffff !important');
});
it('paints only the gallery caption text box, not its full-photo position frame',()=>{
 expect(captionBackgroundSelector('gallery-caption:b')).toBe('[data-editor-target="gallery-caption-b"] .g-cap');
 expect(captionBackgroundSelector('body')).toBeUndefined();
 const d=presetFor('paper-4').design;d.textStyles={heroCaption:{backgroundOpacity:NaN},coverCaption:{backgroundOpacity:500}};
 const css=textStylesCss(d,'alpha');expect(css).not.toContain('NaN');expect(css).toContain('background:rgba(0,0,0,1)');
});
