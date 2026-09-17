import '../styles/wordmark.css';

// A single bundled PNG (public/magazoo-mark.png), not a Vite-imported module:
// every surface that shows the brand — including the raw index.html splash,
// which paints before any JS module has loaded — needs the exact same file
// at a stable URL, so this lives in `public/` and is referenced by path
// rather than imported. `BASE_URL` keeps it correct under the GitHub Pages
// subpath build (see vite.config.ts) the same way every other root-relative
// reference in this app already does.
const MAGAZOO_MARK_SRC = `${import.meta.env.BASE_URL}magazoo-mark.png`;

/**
 * The Magazoo! mark, in one place.
 *
 * It used to be hand-rolled at every surface that needed it — the editor
 * toolbar, the issue studio header, the compile spinner, the placeholder art
 * on a contents spread — and each copy picked its own typeface, weight and
 * colour, so the same name appeared four different ways inside one product.
 * Every surface now renders this component and sets only size (via
 * `font-size`, which the image mark scales against just like the old
 * letterforms did) and, for the text fallback, colour.
 *
 * The default name ('Magazoo!') renders the actual illustrated logo — the
 * app's own brand. A caller passing a *different* name (the contents spread's
 * empty-state placeholder art, which shows whatever the real issue is
 * called) still gets the styled text mark: that placeholder has to read as
 * "the current magazine's name", not as an ad for this software, and it
 * would be wrong to stamp somebody else's newsletter with Magazoo's own
 * cartoon-animal artwork just because they had no photo for a slot.
 */
export function Wordmark({ className, name = 'Magazoo!' }: { className?: string; name?: string }) {
  if (name === 'Magazoo!') {
    return <img className={['brand-mark', 'brand-mark-img', className].filter(Boolean).join(' ')} src={MAGAZOO_MARK_SRC} alt="Magazoo!" />;
  }
  const bang = name.endsWith('!');
  return (
    <span className={['brand-mark', className].filter(Boolean).join(' ')} dir="auto">
      {bang ? name.slice(0, -1) : name}
      {bang && <i>!</i>}
    </span>
  );
}
