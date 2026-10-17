import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {FramedImage} from './FramedImage';

afterEach(()=>vi.unstubAllGlobals());
it('does not remeasure photos or reconnect observers on unrelated text renders',()=>{
  const observe=vi.fn(),disconnect=vi.fn();
  vi.stubGlobal('ResizeObserver',class {observe=observe;disconnect=disconnect;});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const asset={src:'data:image/png;base64,test',naturalWidth:200,naturalHeight:100};
  const render=(x:number)=>act(()=>root.render(<div style={{position:'relative',width:100,height:60}}><FramedImage asset={{...asset}} frame={{offsetX:x,offsetY:0,scale:1}}/></div>));
  try{
    render(0);expect(observe).toHaveBeenCalledTimes(1);
    render(0);expect(observe).toHaveBeenCalledTimes(1);expect(disconnect).not.toHaveBeenCalled();
    render(10);expect(observe).toHaveBeenCalledTimes(2);expect(disconnect).toHaveBeenCalledTimes(1);
  }finally{act(()=>root.unmount());host.remove();}
});
it('translates the bitmap without changing its size or its frame',()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const asset={src:'data:image/png;base64,test',naturalWidth:200,naturalHeight:100};
  const render=(panX?:number,panY?:number)=>act(()=>root.render(<div style={{position:'relative',width:100,height:60}}><FramedImage asset={asset} frame={{scale:1,offsetX:0,offsetY:0,panX,panY}}/></div>));
  try{
    render();const img=host.querySelector('img')!;const width=img.style.width,height=img.style.height;
    expect(img.dataset.imageFreePan).toBeUndefined();expect(img.style.left).toBe('-10px');
    render(50,-100);expect(img.style.width).toBe(width);expect(img.style.height).toBe(height);
    expect(img.style.left).toBe('40px');expect(img.style.top).toBe('-60px');expect(img.dataset.imageFreePan).toBe('true');
    render();expect(img.dataset.imageFreePan).toBeUndefined();expect(img.style.left).toBe('-10px');
  }finally{act(()=>root.unmount());host.remove();}
});
