import {describe,expect,it} from 'vitest';
import {emptyDoc,migrate} from '../schema/document';
import {wrapHeroIntoPage} from './wrappedHero';
import {normalizeImageFrame} from './imageFrame';

describe('hero text wrapping across article templates',()=>{
  it.each(['paper-1','paper-2','paper-3','paper-4','paper-5','paper-6','paper-7','paper-8','magazine-1','magazine-2'] as const)('%s retains source, crop, caption and authored copy',template=>{
    const doc=emptyDoc();doc.templateId=template;
    doc.assets.photo={src:'data:image/png;base64,test',naturalWidth:1200,naturalHeight:800};
    doc.hero={assetId:'photo',scale:1.3,offsetX:12,offsetY:-9,panX:15};
    doc.meta.heroCaption='Caption';
    const before=structuredClone(doc);
    expect(wrapHeroIntoPage(doc,'wrapped')).toBe(true);
    expect(doc.images.at(-1)).toMatchObject({id:'wrapped',assetId:'photo',caption:'Caption',frame:normalizeImageFrame(before.hero),wrapShape:'polygon',anchor:{page:template==='magazine-1'?2:1}});
    expect(doc.design.showHero).toBe(false);
    expect(doc.design.wrappedHeroImageId).toBe('wrapped');
    expect(doc.hero).toEqual(before.hero);expect(doc.cover).toEqual(before.cover);
    expect(doc.assets).toEqual(before.assets);expect(doc.meta).toEqual(before.meta);expect(doc.blocks).toEqual(before.blocks);
    expect(migrate(JSON.parse(JSON.stringify(doc))).images.at(-1)).toEqual(doc.images.at(-1));
    expect(wrapHeroIntoPage(doc,'duplicate')).toBe(false);
    expect(doc.images).toHaveLength(1);
  });
});
