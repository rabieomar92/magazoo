import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {CanvasImagePanning} from './CanvasImagePanning';
import type {Doc} from '../schema/document';

const state=vi.hoisted(()=>({update:vi.fn(),session:1}));
vi.mock('../store/useDoc',()=>({currentDocumentSession:()=>state.session,useDoc:{getState:()=>({update:state.update})}}));
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);state.update.mockReset();state.session=1;});
afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();vi.unstubAllGlobals();});
function fixture(spread=false){
  const page=document.createElement('div');page.innerHTML='<div class="page"><figure data-editor-target="image-hero"><div style="width:400px;height:200px"><img class="framed-image" style="left:10px;top:20px"></div></figure></div>';
  document.body.append(page);const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  if(spread)page.querySelector('img')!.className='spread-photo-image';
  const doc={hero:{panX:0,panY:0},images:[],templateId:spread?'magazine-2':'paper-1',design:{pageFormat:'a4'}} as unknown as Doc;
  act(()=>root.render(<CanvasImagePanning doc={doc} root={{current:page}}/>));
  act(()=>page.querySelector<HTMLButtonElement>('button')!.click());
  const surface=page.querySelector<HTMLElement>('[role="group"]')!,image=page.querySelector('img')!;
  vi.spyOn(surface,'getBoundingClientRect').mockReturnValue({width:200,height:100,left:0,top:0,right:200,bottom:100,x:0,y:0,toJSON:()=>({})});
  const pointer=(type:string,x:number,y:number)=>act(()=>surface.dispatchEvent(Object.assign(new Event(type,{bubbles:true}),{button:0,pointerId:1,clientX:x,clientY:y})));
  const apply=()=>act(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Apply position')!.click());
  return{root,doc,image,pointer,apply};
}
it('drags at canvas zoom without saving each move, then commits one crop',()=>{
  const f=fixture();try{
    f.pointer('pointerdown',0,0);f.pointer('pointermove',50,25);f.pointer('pointerup',50,25);
    expect(f.image.style.left).toBe('110px');expect(f.image.style.top).toBe('70px');expect(state.update).not.toHaveBeenCalled();
    f.apply();expect(state.update).toHaveBeenCalledTimes(1);state.update.mock.calls[0][0](f.doc);expect(f.doc.hero).toMatchObject({panX:25,panY:25});
  }finally{act(()=>f.root.unmount());}
});
it('Escape restores the original pixels and does not save',()=>{
  const f=fixture();try{f.pointer('pointerdown',0,0);f.pointer('pointermove',50,25);act(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})));expect(f.image.style.left).toBe('10px');expect(f.image.hasAttribute('data-image-free-pan')).toBe(false);expect(state.update).not.toHaveBeenCalled();}finally{act(()=>f.root.unmount());}
});
it('does not apply a crop to a different document session',()=>{
  const f=fixture();try{f.pointer('pointerdown',0,0);f.pointer('pointerup',50,25);state.session++;f.apply();expect(state.update).not.toHaveBeenCalled();}finally{act(()=>f.root.unmount());}
});
it('uses the full spread width when panning the Particle Feature strip',()=>{
  const f=fixture(true);try{f.pointer('pointerdown',0,0);f.pointer('pointerup',50,25);f.apply();state.update.mock.calls[0][0](f.doc);expect(f.doc.hero.panX).toBeCloseTo(100/(255*96/25.4)*100);expect(f.doc.hero.panY).toBeCloseTo(50/(297*96/25.4)*100);}finally{act(()=>f.root.unmount());}
});
it('reattaches crop and pan actions when wrap editing replaces the image toolbar',async()=>{
 const page=document.createElement('div');page.innerHTML='<div class="page"><figure data-image-id="photo"><div><img class="framed-image"></div><div class="placed-image-tools"></div></figure></div>';document.body.append(page);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const doc={hero:{},images:[{id:'photo'}],templateId:'paper-1',design:{}} as unknown as Doc;
 try{
  await act(async()=>root.render(<CanvasImagePanning doc={doc} root={{current:page}}/>));
  expect(page.querySelectorAll('.placed-image-tools button')).toHaveLength(2);
  await act(async()=>{const tools=document.createElement('div');tools.className='placed-image-tools';page.querySelector('.placed-image-tools')!.replaceWith(tools);});
  expect(page.querySelectorAll('.placed-image-tools button')).toHaveLength(2);
  expect(page.querySelector('.canvas-crop-trigger')!.textContent).toBe('Crop photo');
 }finally{act(()=>root.unmount());}
});

it('previews both linked photographs during dragging, restores both on Escape',()=>{
 const page=document.createElement('div');page.innerHTML=['a','b'].map((id,i)=>`<div class="page"><figure data-image-id="${id}"><div style="width:400px;height:200px"><img class="spread-photo-image" data-spread-region-width="700" data-spread-region-height="200" style="left:${10-i*300}px;top:20px"></div><div class="placed-image-tools"></div></figure></div>`).join('');document.body.append(page);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const doc={hero:{},images:[{id:'a',spreadLink:'pair'},{id:'b',spreadLink:'pair'}],templateId:'paper-8',design:{pageFormat:'a4'}} as unknown as Doc;
 try{
  act(()=>root.render(<CanvasImagePanning doc={doc} root={{current:page}}/>));
  act(()=>page.querySelector<HTMLButtonElement>('button')!.click());
  const surface=page.querySelector<HTMLElement>('[role="group"]')!;
  vi.spyOn(surface,'getBoundingClientRect').mockReturnValue({width:200,height:100,left:0,top:0,right:200,bottom:100,x:0,y:0,toJSON:()=>({})});
  for(const [type,x] of [['pointerdown',0],['pointermove',50]] as const)act(()=>surface.dispatchEvent(Object.assign(new Event(type,{bubbles:true}),{button:0,pointerId:1,clientX:x,clientY:0})));
  const images=page.querySelectorAll('img');expect(images[0].style.left).toBe('110px');expect(images[1].style.left).toBe('-190px');
  expect(state.update).not.toHaveBeenCalled();act(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})));
  expect(images[0].style.left).toBe('10px');expect(images[1].style.left).toBe('-290px');
 }finally{act(()=>root.unmount());}
});
