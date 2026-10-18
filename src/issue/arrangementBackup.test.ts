import {expect,it} from 'vitest';
import {restoreArrangement} from './arrangementBackup';
const plan={order:['old-b','__contents__','old-a'],contentsExcluded:['old-a'],contentsStyle:{'old-b':{title:'Edited title'}},contentsDesign:{mosaicSalt:7},startNumber:3,countCovers:true,contentsTitle:'Contents',contentsSubtitle:'',direction:'ltr'};
const backup={plan,items:[{id:'old-a',name:'a.json'},{id:'old-b',name:'b.json'}]};
it('restores order, exclusions and custom contents by filename after reupload',()=>{
 const restored=restoreArrangement(backup,[{id:'new-a',name:'a.json'},{id:'new-b',name:'b.json'}]);
 expect(restored).toEqual({...plan,order:['new-b','__contents__','new-a'],contentsExcluded:['new-a'],contentsStyle:{'new-b':{title:'Edited title'}}});
 expect(backup.plan.order[0]).toBe('old-b');
});
it('refuses missing articles and duplicate slots instead of silently losing settings',()=>{
 expect(()=>restoreArrangement(backup,[{id:'new-a',name:'a.json'}])).toThrow();
 expect(()=>restoreArrangement({...backup,plan:{...plan,order:['old-a','old-a','__contents__']}},backup.items)).toThrow();
});
it('restores original PDF bytes and vendor settings with stable PDF ids',()=>{
 const pdf={id:'pdf-kept',name:'insert.pdf',src:'data:application/pdf;base64,JVBERi0=',thumbnail:'',pageCount:2};
 const saved={...backup,plan:{...plan,externalPdfs:[pdf],order:['old-b',pdf.id,'__contents__','old-a'],printSettings:{binding:'perfect',perfectMultiple:4,coverGsm:250}}};
 const restored=restoreArrangement(saved,[{id:'new-a',name:'a.json'},{id:'new-b',name:'b.json'}]);
 expect(restored.externalPdfs).toEqual([pdf]);
 expect(restored.order).toEqual(['new-b',pdf.id,'__contents__','new-a']);
 expect(restored.printSettings).toEqual(saved.plan.printSettings);
});
