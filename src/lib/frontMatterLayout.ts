import { openMarkers } from './richtext';

export interface FrontMatterUnit {
  id: string;
  text: string;
  kind?: 'signature';
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
  // A Dean's signature is a closing block, never a freestanding editorial
  // card. Move the final paragraph with it; if that pair is taller than a
  // column, carry a substantial closing fragment instead. Other front-matter
  // layouts do not use signature units and retain their card packing.
  const last = columns.at(-1)!;
  const previous = columns.at(-2);
  if (last.length === 1 && last[0].kind === 'signature' && previous?.length) {
    const closing = last[0];
    const paragraph = previous.at(-1)!;
    if (!paragraph.kind && paragraph.text.trim()) {
      const available = capacity - measure(closing) - gap;
      if (measure(paragraph) <= available) {
        previous.pop(); last.unshift(paragraph);
        if (!previous.length) columns.splice(columns.length - 2, 1);
      } else {
        const words = paragraph.text.split(/\s+/).filter(Boolean);
        // Keep at least two words on each side; try half the paragraph first,
        // then a shorter tail if the closing block takes more room.
        for (let split = Math.max(2, Math.floor(words.length / 2)); split <= words.length - 2; split++) {
          const first = words.slice(0, split).join(' ');
          const markers = openMarkers(first);
          const head = { ...paragraph, text: first + [...markers].reverse().join('') };
          const tail = { ...paragraph, text: markers.join('') + words.slice(split).join(' '), continued: true, topPadding: 0 };
          if (measure(tail) <= available && measure(head) <= capacity) {
            previous[previous.length - 1] = head;
            last.unshift(tail);
            break;
          }
        }
      }
    }
  }
  return {columns,overflow};
}
