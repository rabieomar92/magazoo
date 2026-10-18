import { expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { assignIssuePages, defaultIssuePlan, type ExternalIssuePdf, type IssueItem } from './model';
import { withExternalPdfItems } from './externalPdfModel';
import { buildPrintBrief } from './printBrief';

it('includes the whole issue in the vendor order, even entries omitted from the contents',()=>{
  const articles:IssueItem[]=['front','story','back'].map(id=>({id,name:id,version:1,updated:0,doc:{...emptyDoc(),templateId:id==='front'?'magazine-4':id==='back'?'backcover-1':'paper-1'}}));
  const pdf:ExternalIssuePdf={id:'pdf-test',name:'insert.pdf',src:'data:application/pdf;base64,JVBERi0=',thumbnail:'',pageCount:3};
  const items=withExternalPdfItems(articles,[pdf]);
  const plan={...defaultIssuePlan(items),order:['front','__contents__','story',pdf.id,'back'],contentsExcluded:items.map(item=>item.id),externalPdfs:[pdf],printSettings:{binding:'perfect' as const,perfectMultiple:4 as const,spineMm:3,coverGsm:250,innerGsm:120}};
  const assignments=assignIssuePages(plan,items,{front:1,story:5,[pdf.id]:3,back:1});
  const brief=buildPrintBrief('Issue',plan,items,assignments,'magazine');
  expect(brief.pages).toEqual({total:12,interior:10,cover:2});
  expect(brief.padding).toBe(2);
  expect(brief.order.map(row=>row.physical)).toEqual(['1','2–3','4–8','9–11','12']);
  expect(brief.order[3].kind).toBe('Imported PDF');
  expect(brief.closed).toBe('203 × 267 mm');
  expect(brief.open).toBe('406 × 267 mm');
  expect(brief.coverOpen).toBe('409 × 267 mm');
  const jis=buildPrintBrief('Issue',plan,items,assignments,'jis-b5');
  expect(jis.closed).toBe('182 × 257 mm');
  expect(jis.open).toBe('364 × 257 mm');
  expect(jis.coverOpen).toBe('367 × 257 mm');
});
