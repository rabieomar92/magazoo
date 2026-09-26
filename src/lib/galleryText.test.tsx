import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { decodeGalleryBreaks, galleryTileText } from './galleryText';
import { GalleryPage } from '../paper/GalleryPage';
import { presetFor } from '../store/presets';

describe('gallery line breaks', () => {
  it('accepts escaped, real and Windows line breaks', () => {
    expect(decodeGalleryBreaks('one\\ntwo\r\nthree\nfour')).toBe('one\ntwo\nthree\nfour');
    expect(galleryTileText('Title\\nLine one\\n\\nLine three')).toEqual({ title: 'Title', desc: 'Line one\n\nLine three' });
  });
  it('allows a literal escaped backslash and leaves math untouched', () => {
    expect(decodeGalleryBreaks(String.raw`Print \\n here`)).toBe(String.raw`Print \n here`);
    const math = String.raw`$\nu = \nabla x$ and $\begin{matrix}a\\b\end{matrix}$`;
    expect(decodeGalleryBreaks(math)).toBe(math);
    expect(decodeGalleryBreaks('$5 alone\\nNext')).toBe('$5 alone\nNext');
  });
  it('keeps escaped title breaks inside the separately authored caption title', () => {
    expect(galleryTileText('**Title\\ncontinued**\nDescription\\nnext', true)).toEqual({
      title: '**Title\ncontinued**', desc: 'Description\nnext',
    });
  });
  it.each(['gallery-1', 'gallery-2', 'gallery-3', 'gallery-4'] as const)('renders formatted hard breaks in text cards and captions in %s', template => {
    const doc = presetFor(template);
    const card = doc.blocks.find(block => block.type === 'paragraph')!;
    card.text = String.raw`Title\n**Bold first\nBold second**\n\n$\nu$`;
    const figure = doc.blocks.find(block => block.type === 'figure')!;
    figure.caption = '**Image title**\n' + String.raw`*Line one\nLine two*\nLiteral \\n`;
    const html = renderToStaticMarkup(<GalleryPage doc={doc} vars={{}} />);
    expect(html).toContain('<strong>Bold first<br/>Bold second</strong><br/><br/>');
    expect(html).toContain('<em>Line one<br/>Line two</em><br/>Literal \\n');
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('katex-error');
    expect(card.text).toContain('\\n'); // Stored source is not rewritten by rendering.
  });
});
