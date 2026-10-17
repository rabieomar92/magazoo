import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {PageFooters} from './PageFooters';
import {presetFor} from '../store/presets';

afterEach(()=>{document.body.replaceChildren();vi.unstubAllGlobals();});
it('adds a non-interactive editor-only footer boundary to every physical sheet',()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const pages=document.createElement('div');pages.innerHTML='<div class="page"></div><div class="page"></div>';document.body.append(pages);
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host),doc=presetFor('paper-1');doc.footer={fontSize:9,bottomOffset:12};
  try{
    act(()=>root.render(<PageFooters doc={doc} root={{current:pages}}/>));
    const guides=pages.querySelectorAll<HTMLElement>('.footer-boundary-guide');expect(guides).toHaveLength(2);
    for(const guide of guides){expect(guide.dataset.editorOnly).toBe('true');expect(guide.getAttribute('aria-hidden')).toBe('true');expect(guide.style.bottom).toBe(guide.parentElement!.querySelector<HTMLElement>('.page-folio')!.style.height);}
    doc.footer={enabled:false};act(()=>root.render(<PageFooters doc={{...doc}} root={{current:pages}}/>));expect(pages.querySelector('.footer-boundary-guide')).toBeNull();
  }finally{act(()=>root.unmount());}
});
