import type {Doc} from '../schema/document';

/** Resolve the project default at the document boundary, before either the
 * editor or compiler lays it out. Explicit custom text (including blank) wins. */
export function withProjectIssueLabel(doc:Doc,projectName?:string):Doc {
  if(!projectName || doc.meta.volumeMode==='custom')return doc;
  return {...doc,meta:{...doc.meta,volume:projectName,volumeMode:'project'}};
}
