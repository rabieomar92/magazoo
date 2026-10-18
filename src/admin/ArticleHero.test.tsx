import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {ArticleHero} from './ArticleHero';

it('shows loading, clears it on success/error, and retries a new image version',()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const item={id:'a',name:'Article',token:'token',version:1,updated:0};
 try{
  act(()=>root.render(<ArticleHero item={item} href="#editor"/>));
  expect(host.querySelector('[role=status]')?.textContent).toBe('Loading preview…');
  act(()=>host.querySelector('img')!.dispatchEvent(new Event('error')));
  expect(host.querySelector('[role=status]')).toBeNull();expect(host.textContent).toContain('No hero image');
  act(()=>root.render(<ArticleHero item={{...item,version:2}} href="#editor"/>));
  expect(host.querySelector('[role=status]')).not.toBeNull();
  const image=host.querySelector('img')!;Object.defineProperty(image,'naturalWidth',{value:600});
  act(()=>image.dispatchEvent(new Event('load')));
  expect(host.querySelector('[role=status]')).toBeNull();
 }finally{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
