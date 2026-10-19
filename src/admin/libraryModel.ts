export interface LibraryItem { id: string; name: string; token: string; version: number; updated: number; category?:string;templateId?:string }
export interface LibraryProject { id: string; name: string; items: LibraryItem[];settings?:import('../lib/projectSettings').ProjectSettings }
export type LibrarySort = 'recent' | 'name' | 'oldest';
const normalized = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Filter the whole library before paging. Private document bodies aren't fetched. */
export function libraryRows(projects: LibraryProject[], query: string, projectId: string, sort: LibrarySort) {
  const terms = normalized(query).split(/\s+/).filter(Boolean);
  const matches = (text: string) => {
    const haystack = normalized(text);
    return terms.every(term => haystack.includes(term));
  };
  return projects.filter(p => !projectId || p.id === projectId).flatMap(project => {
    if (!project.items.length) return matches(project.name) ? [{project, item: null as LibraryItem | null}] : [];
    const items = project.items.filter(item => matches(`${project.name} ${item.name} ${articleCategory(item)}`)).sort((a, b) => {
      const nameOrder = a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'});
      return sort === 'name' ? nameOrder : (sort === 'oldest' ? a.updated - b.updated : b.updated - a.updated) || nameOrder;
    });
    return items.map(item => ({project, item: item as LibraryItem | null}));
  });
}

export function articleLabel(name: string) {
  return name.replace(/\.json$/i, '').replace(/[-_]+/g, ' ').trim() || name;
}
export function articleCategory(item:LibraryItem){
  if(item.category?.trim())return item.category.trim();
  const id=item.templateId??'';
  return id.startsWith('news-')?'News & briefs':id.startsWith('gallery-')?'Photo essay':id==='backcover-1'?'Back cover':id==='frontmatter-board'?'Editorial board':id==='frontmatter-dean'?'Dean’s message':id==='frontmatter-contents'?'Contents':id==='magazine-4'?'Cover':'Article';
}
