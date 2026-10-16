import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {FreeformImageEditor} from './FreeformImageEditor';
import {DRAW_IMAGE_OUTLINE_EVENT} from '../lib/imageCanvas';
import type {PlacedImage} from '../schema/document';
beforeEach(()=>vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true));
afterEach(()=>vi.unstubAllGlobals());

describe('simple image-outline controls',()=>{
  it('opens canvas drawing without exposing points or modifying the document',()=>{
    const host=document.createElement('div'),root=createRoot(host),open=vi.fn();
    const image:PlacedImage={id:'outline',assetId:'a',widthCols:2,caption:'Caption',anchor:{page:1,column:0,y:100}};
    window.addEventListener(DRAW_IMAGE_OUTLINE_EVENT,open);
    act(()=>root.render(<FreeformImageEditor image={image}/>));
    expect(host.querySelectorAll('input,select,svg')).toHaveLength(0);
    act(()=>host.querySelector('button')!.click());
    expect(open).toHaveBeenCalledTimes(1);
    expect((open.mock.calls[0][0] as CustomEvent).detail).toEqual({imageId:'outline'});
    expect(image.wrapPolygon).toBeUndefined();
    window.removeEventListener(DRAW_IMAGE_OUTLINE_EVENT,open);act(()=>root.unmount());
  });
});
