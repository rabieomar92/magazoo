import {act} from 'react';import {createRoot} from 'react-dom/client';import {expect,it,vi} from 'vitest';
import {ImageDeck,REVEAL_IMAGE_CONTROL} from './ImageDeck';
it('shows one image at a time, preserves field nodes and reveals a canvas-selected image',()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{act(()=>root.render(<ImageDeck label="Page image" names={['One','Two']}><input key="a" aria-label="First image"/><div key="b" id="editor-target-article-image-b"><input aria-label="Second image"/></div></ImageDeck>));
    const items=host.querySelectorAll<HTMLElement>('.image-deck-item'),input=items[0].querySelector('input');expect(items[0].hidden).toBe(false);expect(items[1].hidden).toBe(true);
    act(()=>window.dispatchEvent(new CustomEvent(REVEAL_IMAGE_CONTROL,{detail:{target:'article-image-b'}})));
    expect(items[0].hidden).toBe(true);expect(items[1].hidden).toBe(false);expect(items[0].querySelector('input')).toBe(input);
    act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Previous page image"]')!.click());expect(items[0].hidden).toBe(false);
  }finally{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
