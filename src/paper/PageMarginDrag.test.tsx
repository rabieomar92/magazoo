import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {TEMPLATES,presetFor} from '../store/presets';
import {useDoc} from '../store/useDoc';
import {PageMarginText} from './PageMarginText';
import {PreviewReadOnly} from './PreviewReadOnly';

it.each(TEMPLATES.map(t=>t.id))('%s saves a side-text drag correctly at 50 percent preview zoom',template=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const doc=presetFor(template);doc.design.pageFormat='jis-b5';doc.design.barSide='left';doc.marginText={enabled:true,mode:'all',text:'Credit',edgeOffset:6,bottomOffset:20};useDoc.getState().load(doc);
 const page=document.createElement('div');page.className='page';page.style.width='687.874px';document.body.append(page);
 page.getBoundingClientRect=()=>({width:343.937,height:485.669,top:0,left:0,right:343.937,bottom:485.669,x:0,y:0,toJSON:()=>({})});
 const root=createRoot(page);
 const pointer=(type:string,x:number,y:number)=>Object.assign(new Event(type,{bubbles:true}),{button:0,pointerId:1,clientX:x,clientY:y});
 try{
  act(()=>root.render(<PageMarginText doc={doc} index={0}/>));const text=page.querySelector<HTMLElement>('.page-margin-text')!;
  text.getBoundingClientRect=()=>({width:5,height:60,top:0,left:0,right:5,bottom:60,x:0,y:0,toJSON:()=>({})});
  act(()=>text.dispatchEvent(pointer('pointerdown',20,100)));act(()=>window.dispatchEvent(pointer('pointermove',30,80)));
  expect(useDoc.getState().doc.marginText?.edgeOffset).toBe(6);
  act(()=>window.dispatchEvent(pointer('pointerup',30,80)));
  expect(useDoc.getState().doc.marginText).toMatchObject({edgeOffset:11.3,bottomOffset:30.6});
 }finally{act(()=>root.unmount());page.remove();vi.unstubAllGlobals();}
});
it('never changes the saved margin text in compiled/read-only previews',()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const doc=presetFor('paper-8');doc.marginText={enabled:true,mode:'all',text:'Credit',edgeOffset:6};useDoc.getState().load(doc);
 const page=document.createElement('div');page.className='page';document.body.append(page);const root=createRoot(page);
 const before=useDoc.getState().doc;
 try{act(()=>root.render(<PreviewReadOnly.Provider value={true}><PageMarginText doc={doc} index={0}/></PreviewReadOnly.Provider>));
  act(()=>page.querySelector('.page-margin-text')!.dispatchEvent(Object.assign(new Event('pointerdown',{bubbles:true}),{button:0,pointerId:1,clientX:10,clientY:10})));
  act(()=>window.dispatchEvent(Object.assign(new Event('pointerup'),{pointerId:1,clientX:50,clientY:50})));
  expect(useDoc.getState().doc).toBe(before);
 }finally{act(()=>root.unmount());page.remove();vi.unstubAllGlobals();}
});
