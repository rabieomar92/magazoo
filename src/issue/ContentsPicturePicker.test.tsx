import {act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {ContentsPicturePicker} from './ContentsPicturePicker';
import {defaultIssuePlan} from './model';
import {emptyDoc} from '../schema/document';
it('selects an article asset and saves the same per-entry visibility override',()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const doc=emptyDoc();doc.assets={one:{src:'one.png',naturalWidth:100,naturalHeight:100},two:{src:'two.png',naturalWidth:200,naturalHeight:100}};
 const item={id:'test',name:'Article',doc,version:1,updated:0};const plan=defaultIssuePlan([item]);
 const save=vi.fn();function Fixture(){const [value,setValue]=useState(plan);return <ContentsPicturePicker item={item} plan={value} disabled={false} onChange={next=>{save(next);setValue(next);}}/>;}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  act(()=>root.render(<Fixture/>));act(()=>{const select=host.querySelector('select')!;select.value='two';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(host.querySelector('button')).toBeNull();
  expect(save.mock.lastCall?.[0].contentsStyle.test).toMatchObject({assetId:'two',hero:true});
  act(()=>host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
  expect(save.mock.lastCall?.[0].contentsStyle.test.hero).toBe(false);
  expect(plan.contentsStyle).toBeUndefined();
 }finally{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
it('warns when the measured contents overflow, even if the entry could not be placed',()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const proof=document.createElement('div');proof.className='issue-proof-pages';proof.innerHTML='<div data-contents-overflow="true"></div>';document.body.append(proof);
 const item={id:'test',name:'Article',doc:emptyDoc(),version:1,updated:0};item.doc.assets={one:{src:'photo.png',naturalWidth:100,naturalHeight:100}};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{act(()=>root.render(<ContentsPicturePicker item={item} plan={defaultIssuePlan([item])} disabled={false} onChange={()=>{}}/>));expect(host.textContent).toContain('Not enough room');}
 finally{act(()=>root.unmount());host.remove();proof.remove();vi.unstubAllGlobals();}
});
