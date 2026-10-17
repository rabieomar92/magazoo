import { expect, it } from 'vitest';
import { articleLabel,articleCategory, libraryRows, type LibraryProject } from './libraryModel';
const data: LibraryProject[]=[
  {id:'physics',name:'Physics · October',items:[
    {id:'a',name:'AI-takes_on-the-typhoon.json',token:'a',version:1,updated:200},
    {id:'b',name:'Café-science.json',token:'b',version:2,updated:300},
    {id:'c',name:'Cahaya_dan-tenaga.json',token:'c',version:3,updated:100},
  ]},
  {id:'empty',name:'Next issue',items:[]},
];
it.each(['AI takes on the typhoon','ai-takes_on','PHYSICS typhoon','  October AI  '])('finds filename and project tokens for %s',query=>{
  expect(libraryRows(data,query,'','recent').map(r=>r.item?.id)).toEqual(['a']);
});
it('supports accents and Bahasa Melayu names without changing saved filenames',()=>{
  expect(libraryRows(data,'cafe','','recent')[0].item?.name).toBe('Café-science.json');
  expect(libraryRows(data,'cahaya tenaga','','recent')[0].item?.id).toBe('c');
});
it('combines the selected project with every search term',()=>{
  expect(libraryRows(data,'AI','empty','recent')).toHaveLength(0);
  expect(libraryRows(data,'AI missing','','recent')).toHaveLength(0);
  expect(libraryRows(data,'Next issue','','recent')).toEqual([{project:data[1],item:null}]);
});
it('sorts a copy of each project without mutating the original order',()=>{
  const before=JSON.stringify(data);
  expect(libraryRows(data,'','physics','recent').map(r=>r.item?.id)).toEqual(['b','a','c']);
  expect(libraryRows(data,'','physics','oldest').map(r=>r.item?.id)).toEqual(['c','a','b']);
  expect(libraryRows(data,'','physics','name').map(r=>r.item?.id)).toEqual(['a','b','c']);
  expect(JSON.stringify(data)).toBe(before);
});
it('uses readable card labels without losing the original filename',()=>{
  expect(articleLabel('AI-takes_on-the-typhoon.JSON')).toBe('AI takes on the typhoon');
  expect(articleLabel('.json')).toBe('.json');
});
it('labels and searches article categories rather than generic file-format labels',()=>{
  const item={...data[0].items[0],category:'Computational physics',templateId:'paper-8'};
  expect(articleCategory(item)).toBe('Computational physics');expect(libraryRows([{...data[0],items:[item]}],'computational','','recent')).toHaveLength(1);
  expect(articleCategory({...item,category:'',templateId:'gallery-2'})).toBe('Photo essay');
});
