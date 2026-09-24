/** Preserve whitespace in controlled inputs, including unfinished words. */
export function splitCaption(caption: string): { title: string; desc: string } {
  const nl = caption.indexOf('\n');
  const head = nl === -1 ? caption : caption.slice(0, nl);
  return { title: head.replace(/^\*\*/, '').replace(/\*\*$/, ''), desc: nl === -1 ? '' : caption.slice(nl + 1) };
}
export function joinCaption(title: string, desc: string): string {
  if (!title && !desc) return '';
  return `${title ? `**${title}**` : ''}\n${desc}`;
}
