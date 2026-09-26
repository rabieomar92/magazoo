/** Gallery-only escapes. Keep $...$ formulas verbatim, including TeX's \nu and
 *  \\ line separator. A doubled backslash outside math escapes a literal slash. */
export function decodeGalleryBreaks(text: string): string {
  return text.replace(/\$[^$]*\$|\\\\|\\n|\r\n?/g, token => {
    if (token.startsWith('$')) return token;
    return token === '\\\\' ? '\\' : '\n';
  });
}

/** Captions have separate title/description inputs joined with a real newline.
 *  Decode each field separately so a typed \n in the title stays in the title.
 *  Text cards accept either Enter or \n as their title/description boundary. */
export function galleryTileText(text: string, caption = false): { title: string; desc: string } {
  const source = caption ? text.replace(/\r\n?/g, '\n') : decodeGalleryBreaks(text);
  const nl = source.indexOf('\n');
  const title = nl === -1 ? source : source.slice(0, nl);
  const desc = nl === -1 ? '' : source.slice(nl + 1);
  return {
    title: (caption ? decodeGalleryBreaks(title) : title).trim(),
    desc: (caption ? decodeGalleryBreaks(desc) : desc).trim(),
  };
}
