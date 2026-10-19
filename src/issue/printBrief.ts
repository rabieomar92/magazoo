import { bindingPadding, bindingPageCounts } from './binding';
import { CONTENTS_ID, issueDocumentLabel, issuePlainText, type IssueAssignment, type IssueItem, type IssuePlan } from './model';
import { PDF_PAGE_SIZES, type PdfPageSize } from '../lib/pdfPageSize';

export function buildPrintBrief(title:string,plan:IssuePlan,items:readonly IssueItem[],assignments:readonly IssueAssignment[],size:PdfPageSize) {
  const settings=plan.printSettings??{binding:'saddle-stitch',perfectMultiple:2};
  const pages=bindingPageCounts(items,assignments);
  const trim=PDF_PAGE_SIZES[size];
  const perfect=settings.binding==='perfect';
  const basis=perfect?pages.interior:pages.total;
  const padding=bindingPadding(basis,perfect?settings.perfectMultiple:4);
  let physical=1;
  const order=plan.order.map(id=>{
    const row=assignments.find(value=>value.id===id);
    if(!row)throw new Error('Compile every document before generating the printer brief.');
    const item=items.find(value=>value.id===id);
    const label=id===CONTENTS_ID?plan.contentsTitle||'Contents':issuePlainText(item?.doc.meta.title)||item?.name||'Untitled';
    const result={id,title:label,kind:id===CONTENTS_ID?'Generated contents':item?.externalPdf?'Imported PDF':item?issueDocumentLabel(item.doc):'Document',
      physical:row.pageCount===1?String(physical):`${physical}–${physical+row.pageCount-1}`,
      folio:item?.externalPdf?'Source PDF':row.counted?(row.pageCount===1?String(row.startNumber):`${row.startNumber}–${row.startNumber+row.pageCount-1}`):'Cover'};
    physical+=row.pageCount;return result;
  });
  return {title,settings,pages,trim,padding,basis,perfect,order,
    bleedMm:settings.bleedMm??0,
    output:`${trim.width+2*(settings.bleedMm??0)} × ${trim.height+2*(settings.bleedMm??0)} mm`,
    closed:`${trim.width} × ${trim.height} mm`,
    open:`${trim.width*2} × ${trim.height} mm`,
    coverOpen:perfect?(settings.spineMm===undefined?`${trim.width*2} + spine × ${trim.height} mm`:`${trim.width*2+settings.spineMm} × ${trim.height} mm`):`${trim.width*2} × ${trim.height} mm`,
    hasImported:items.some(item=>item.externalPdf),
  };
}
