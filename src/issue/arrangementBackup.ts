import { CONTENTS_ID, type IssuePlan } from './model';
import {decodeIssuePdf} from './externalPdfData';

/** Restore by filename: uploading articles creates new database identifiers. */
export function restoreArrangement(value: unknown, current: readonly {id:string;name:string}[]): IssuePlan {
  const saved = value as {plan?:IssuePlan;items?:{id:string;name:string}[]};
  if (!saved?.plan || !Array.isArray(saved.items) || !Array.isArray(saved.plan.order) || !Array.isArray(saved.plan.contentsExcluded)) throw new Error('This file does not contain a saved issue arrangement.');
  if(saved.plan.externalPdfs!==undefined&&!Array.isArray(saved.plan.externalPdfs))throw new Error('The backup has an invalid imported PDF list.');
  for(const pdf of saved.plan.externalPdfs??[])decodeIssuePdf(pdf?.src);
  const pdfIds = new Set((saved.plan.externalPdfs??[]).map(pdf=>pdf.id));
  const articles = current.filter(item=>!item.id.startsWith('pdf-'));
  const savedArticles = saved.items.filter(item=>!pdfIds.has(item.id));
  if (savedArticles.length !== articles.length || new Set(articles.map(item=>item.name)).size !== articles.length || new Set(savedArticles.map(item=>item.name)).size !== savedArticles.length) throw new Error('Restore the same articles first; filenames must be unique and match the backup.');
  const names = new Map(articles.map(item=>[item.name,item.id]));
  const ids = new Map(savedArticles.map(item=>[item.id,names.get(item.name)]));
  const map = (id:string) => {
    if(id===CONTENTS_ID||pdfIds.has(id))return id;
    const next=ids.get(id);if(!next)throw new Error('An article in the arrangement is missing from this project.');return next;
  };
  const plan = {...saved.plan,order:saved.plan.order.map(map),contentsExcluded:saved.plan.contentsExcluded.map(map),
    ...(saved.plan.contentsStyle ? {contentsStyle:Object.fromEntries(Object.entries(saved.plan.contentsStyle).map(([id,style])=>[map(id),style]))}:{}),
  };
  if(plan.order.length!==articles.length+pdfIds.size+1 || new Set(plan.order).size!==plan.order.length || !plan.order.includes(CONTENTS_ID))throw new Error('The backup must contain each article exactly once and one contents spread.');
  return plan;
}
