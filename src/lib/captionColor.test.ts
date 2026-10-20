import {expect,it} from 'vitest';
import {presetFor,TEMPLATES} from '../store/presets';
import {clearCaptionColorOverrides} from './captionColor';
import {textStylesCss,textStyleSelector} from './textStyles';

it.each(TEMPLATES.map(t=>t.id))('%s allows shared caption colour changes without erasing other typography',id=>{
 const doc=presetFor(id);
 doc.design.textStyles={caption:{color:'#aa2200'},heroCaption:{color:'#888888',fontSize:8},coverCaption:{color:'#888888'},newsCaption:{color:'#888888'},'image-caption:one':{color:'#888888',align:'right'},'gallery-caption:two':{color:'#888888'},'news:three:caption':{color:'#888888'},body:{color:'#123456'}};
 clearCaptionColorOverrides(doc,'caption');
 for(const [key,style] of Object.entries(doc.design.textStyles))if(key!=='caption'&&key!=='body')expect(style.color).toBeUndefined();
 expect(doc.design.textStyles.heroCaption.fontSize).toBe(8);
 expect(doc.design.textStyles['image-caption:one'].align).toBe('right');
 expect(doc.design.textStyles.body.color).toBe('#123456');
 expect(textStylesCss(doc.design,'check')).toContain('color:#aa2200 !important');
 // A subsequent individual edit stays local and wins over the shared default.
 doc.design.textStyles['image-caption:one'].color='#00aa22';
 const css=textStylesCss(doc.design,'check');
 expect(css.indexOf('color:#00aa22')).toBeGreaterThan(css.indexOf('color:#aa2200'));
 doc.design.textStyles={heroCaption:{color:'#abcdef'},caption:{color:'#aa2200'}};
 const reordered=textStylesCss(doc.design,'check');
 expect(reordered.indexOf('color:#abcdef')).toBeGreaterThan(reordered.indexOf('color:#aa2200'));
 expect(reordered.split('\n').find(line=>line.includes('color:#abcdef'))).toContain('[data-tracking-scope="check"][data-tracking-scope]');
});
it('the all-caption selector reaches every caption family, including movable layers',()=>{
 const host=document.createElement('div');
 host.innerHTML='<figure class="placed-image"><figcaption></figcaption></figure><p data-editor-target="meta-hero-caption"></p><p data-editor-target="meta-cover-caption"></p><article class="news-story"><figcaption></figcaption></article><figure class="g-img"><figcaption><p class="g-title"></p><p class="g-desc"></p></figcaption></figure>';
 expect(host.querySelectorAll(textStyleSelector('caption')!)).toHaveLength(6);
});
it('story-caption edits leave non-news individual captions alone',()=>{
 const doc=presetFor('news-briefs');doc.design.textStyles={'news:a:caption':{color:'#333333'},'image-caption:b':{color:'#444444'}};
 clearCaptionColorOverrides(doc,'newsCaption');
 expect(doc.design.textStyles['news:a:caption'].color).toBeUndefined();
 expect(doc.design.textStyles['image-caption:b'].color).toBe('#444444');
});
