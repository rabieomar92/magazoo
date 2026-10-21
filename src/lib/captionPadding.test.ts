import {expect,it} from 'vitest';
import {emptyDoc,migrate} from '../schema/document';
import {captionBackgroundSelector,textStylesCss} from './textStyles';
import {clearCaptionPaddingOverrides} from './captionColor';

it.each(['caption','heroCaption','coverCaption','newsCaption','image-caption:photo','gallery-caption:photo','news:story:caption'])('%s supports padded and tight boxes in preview, measurement and print',group=>{
 const doc=emptyDoc();
 for(const captionPadding of ['padded','tight'] as const){
  doc.design.textStyles={[group]:{captionPadding}};
  const css=textStylesCss(doc.design,'test');
  expect(captionBackgroundSelector(group)).toBeTruthy();
  expect(css).toContain(`--caption-padding-block:${captionPadding==='tight'?'0mm':'2.5mm'}`);
  expect(css).toContain(`--caption-padding-inline:${captionPadding==='tight'?'0mm':'3mm'}`);
  expect(migrate(JSON.parse(JSON.stringify(doc))).design.textStyles?.[group]?.captionPadding).toBe(captionPadding);
 }
});
it('an all-caption choice replaces previous spacing overrides but preserves other formatting',()=>{
 const doc=emptyDoc();doc.design.textStyles={heroCaption:{captionPadding:'tight',color:'#123456'},'gallery-caption:photo':{captionPadding:'padded'},'news:story:caption':{captionPadding:'tight'},title:{color:'#abcdef'}};
 clearCaptionPaddingOverrides(doc,'caption');
 expect(doc.design.textStyles.heroCaption).toEqual({color:'#123456'});
 expect(doc.design.textStyles['gallery-caption:photo']).toEqual({});
 expect(doc.design.textStyles['news:story:caption']).toEqual({});
 expect(doc.design.textStyles.title).toEqual({color:'#abcdef'});
});
