import {test} from 'node:test';import assert from 'node:assert/strict';
import {openStorage} from './storage.mjs';
test('project format applies to new, imported, updated and existing documents without altering content',()=>{
 const storage=openStorage(':memory:');try{
  const settings={paperSize:'jis-b5',bleedMm:5},p=storage.createProject('Issue',settings);
  const source={meta:{title:'Keep'},design:{fontSize:8.8},blocks:[{text:'Original'}],future:{untouched:true}};
  const a=storage.createDocument(p.id,'a.json',JSON.stringify(source));
  const stored=JSON.parse(storage.read(a.token).body);assert.deepEqual(stored.blocks,source.blocks);assert.equal(stored.design.bleedMm,5);assert.equal(stored.design.pageFormat,'jis-b5');assert.equal(stored.design.bleedCanvas,true);
  assert.deepEqual(storage.list()[0].settings,settings);
  const lease='12345678-1234-1234-1234-123456789012';storage.editLease(a.token,'acquire',lease);
  assert.throws(()=>storage.updateProjectSettings(p.id,{paperSize:'a4',bleedMm:3},settings),/edit|reserved|open/i);
  assert.deepEqual(storage.list()[0].settings,settings);
  storage.editLease(a.token,'release',lease);
  storage.updateProjectSettings(p.id,{paperSize:'a4',bleedMm:3},settings);
  const updated=JSON.parse(storage.read(a.token).body);assert.equal(updated.design.bleedMm,3);assert.equal(updated.design.pageFormat,'a4');assert.deepEqual(updated.future,source.future);assert.equal(storage.read(a.token).version,2);
  assert.throws(()=>storage.updateProjectSettings(p.id,settings,settings),/another session/);
  assert.throws(()=>storage.createProject('Invalid',{paperSize:'unknown',bleedMm:5}),/paper size/);
  assert.throws(()=>storage.createProject('Invalid',{paperSize:'jis-b5',bleedMm:NaN}),/Bleed/);
 }finally{storage.close();}
});
