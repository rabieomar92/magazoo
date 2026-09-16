import '../styles/wordmark.css';

/**
 * The Magazoo! mark, in one place.
 *
 * It used to be hand-rolled at every surface that needed it — the editor
 * toolbar, the issue studio header, the compile spinner, the placeholder art
 * on a contents spread — and each copy picked its own typeface, weight and
 * colour, so the same name appeared four different ways inside one product.
 * Every surface now renders this component and sets only size and colour, so
 * the letterforms cannot drift apart again.
 *
 * The face is the bundled publication serif: a mark that appears on a printed
 * contents page has to resolve identically in the browser and in the exported
 * PDF, which rules out system fonts (Georgia is absent on many Linux boxes)
 * and unbundled brand fonts alike.
 */
export function Wordmark({ className, name = 'Magazoo!' }: { className?: string; name?: string }) {
  const bang = name.endsWith('!');
  return (
    <span className={['brand-mark', className].filter(Boolean).join(' ')} dir="auto">
      {bang ? name.slice(0, -1) : name}
      {bang && <i>!</i>}
    </span>
  );
}
