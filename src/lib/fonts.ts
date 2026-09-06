/** Font choices shared by every selector. The stack is also shared so a font
 * never resolves differently between the editor, the cover, and PDF export. */
export const ALL_FONTS = [
  'Helvetica',
  'Playfair Display',
  'Bebas Neue',
  'Arial',
  'Avenir Next LT Pro Light',
  'Avenir Next LT Pro',
];

export const SERIF_FONTS = ALL_FONTS;
export const SANS_FONTS = ALL_FONTS;
export const fontOptions = (fonts: string[] = ALL_FONTS) =>
  fonts.map((font) => ({ value: font, label: font }));

const STACKS: Record<string, string> = {
  'Source Serif 4': '"Source Serif 4", Georgia, "Times New Roman", serif',
  'Playfair Display': '"Playfair Display", Georgia, "Times New Roman", serif',
  'Bebas Neue': '"Bebas Neue", "Arial Narrow", Arial, sans-serif',
  'Avenir Next LT Pro Light': '"Avenir Next LT Pro Light", "Avenir Next LT Pro", "Avenir Next", Avenir, "Century Gothic", Arial, sans-serif',
  'Avenir Next LT Pro': '"Avenir Next LT Pro", "Avenir Next", Avenir, "Century Gothic", Arial, sans-serif',
  // Avenir Next is commercial and may not be installed. Century Gothic is a
  // commonly available geometric Windows face and is a much closer fallback
  // than the old, incorrect Georgia serif fallback.
  'Avenir Next':
    '"Avenir Next", "Avenir Next LT Pro", Avenir, "Century Gothic", Futura, Arial, sans-serif',
  Georgia: 'Georgia, "Times New Roman", serif',
  'Times New Roman': '"Times New Roman", Times, serif',
  Palatino: 'Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif',
  'Source Sans 3': '"Source Sans 3", "Segoe UI", Arial, sans-serif',
  Helvetica: 'Helvetica, Arial, sans-serif',
  Arial: 'Arial, Helvetica, sans-serif',
  Verdana: 'Verdana, Geneva, sans-serif',
  'system-ui': 'system-ui, -apple-system, "Segoe UI", sans-serif',
};

export function fontStack(name: string): string {
  if (STACKS[name]) return STACKS[name];
  const safe = name.replace(/["\\]/g, '');
  return `"${safe}", system-ui, sans-serif`;
}
