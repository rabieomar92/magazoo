import { openMarkers } from './richtext';

export interface FrontMatterUnit {
  id: string;
  text: string;
  title?: string;
  page?: string;
  continued?: boolean;
  fontSize?: number;
  color?: string;
  topPadding?: number;
  indent?: boolean;
}

/** Fill physical columns in reading order, measuring the exact render markup.
 * Keep cards together when possible; split only a card larger than a column.
 * There is no font shrinking, altered leading, or discarded overflow text. */
export function packFrontMatter(units: FrontMatterUnit[], capacity: number,
  measure: (unit: FrontMatterUnit) => number, gap: number) {
  const columns: FrontMatterUnit[][] = [[]];
  let used = 0;
  let overflow = false;
  const next = () => { columns.push([]); used = 0; };
  for (const original of units) {
    let unit = { ...original };
    while (true) {
      const height = measure(unit);
      const spacing = used ? gap : 0;
      if (height + used + spacing <= capacity) {
        columns.at(-1)!.push(unit); used += height + spacing; break;
      }
      if (used) { next(); continue; }
      const words = unit.text.split(/\s+/).filter(Boolean);
      let lo = 0, hi = words.length;
      while (lo < hi) {
        const middle = Math.ceil((lo + hi) / 2);
        const candidate = words.slice(0,middle).join(' ');
        const closed = candidate + openMarkers(candidate).reverse().join('');
        if (measure({...unit,text:closed}) <= capacity) lo = middle; else hi = middle - 1;
      }
      if (lo === 0 || lo === words.length) {
        // An extreme heading/word cannot fit. Surface the error; never drop it.
        columns.at(-1)!.push(unit); overflow = true; used += height; break;
      }
      const first = words.slice(0,lo).join(' ');
      const markers = openMarkers(first);
      columns.at(-1)!.push({...unit,text:first + [...markers].reverse().join('')});
      unit = {...unit,text:markers.join('') + words.slice(lo).join(' '),continued:true,topPadding:0};
      next();
    }
  }
  return {columns,overflow};
}
