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
