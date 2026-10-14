import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TagBar } from './TagBar';
import { presetFor, TEMPLATE_META } from '../store/presets';
import { migrate } from '../schema/document';
import { MagazineFrontCover } from './MagazineFrontCover';
import { BackCoverPage } from './BackCoverPage';

describe('top bar visibility in every template',()=>{
  it.each(TEMPLATE_META.map(t=>[t.id]))('supports hide, restore and save/reopen in %s',id=>{
    const doc=presetFor(id);const meta=structuredClone(doc.meta);
    doc.design.showTopBar=false;
    expect(renderToStaticMarkup(<TagBar doc={doc} pageIndex={0}/>)).toBe('');
    expect(migrate(JSON.parse(JSON.stringify(doc))).design.showTopBar).toBe(false);
    doc.design.showTopBar=true;
    expect(renderToStaticMarkup(<TagBar doc={doc} pageIndex={0}/>)).toContain('class="tag-bar');
    expect(doc.meta).toEqual(meta);
  });
  it('dedicated covers stay unchanged by default but support the optional bar',()=>{
    for(const id of ['magazine-4','backcover-1'] as const){
      const doc=presetFor(id);const render=()=>renderToStaticMarkup(id==='magazine-4'?<MagazineFrontCover doc={doc} vars={{}}/>:<BackCoverPage doc={doc} vars={{}}/>);
      expect(render()).not.toContain('class="tag-bar');
      doc.design.showTopBar=true;expect(render()).toContain('class="tag-bar');
      doc.design.showTopBar=false;expect(render()).not.toContain('class="tag-bar');
    }
  });
});
