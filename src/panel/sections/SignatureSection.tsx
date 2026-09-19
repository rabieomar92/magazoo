import { useState } from 'react';
import { useDoc } from '../../store/useDoc';
import { emptyFrontMatter } from '../../store/frontMatter';
import { detectSignatureCrop, signatureGeometry } from '../../lib/signature';
import { SignatureImage } from '../../components/SignatureImage';
import { MagazooLoader } from '../../components/MagazooLoader';
import { LabeledNumber, SegmentField, Toggle } from '../Field';
import { ImagePicker } from './HeroSection';
import './SignatureSection.css';

export function SignatureSection() {
  const doc = useDoc(s => s.doc);
  const update = useDoc(s => s.update);
  const content = doc.frontMatter ?? emptyFrontMatter();
  const assetId = content.signature?.assetId;
  const asset = assetId ? doc.assets[assetId] : null;
  const geometry = signatureGeometry(asset, content, doc.design.margin);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const trim = async () => {
    if (!asset) return;
    setBusy(true); setNotice('');
    try {
      const crop = await detectSignatureCrop(asset.src);
      const current = useDoc.getState().doc;
      if (current !== doc) {
        setNotice('The document changed while checking margins. Please try trimming again.');
        return;
      }
      if (crop) {
        update(d => { d.frontMatter!.signatureCrop = crop; });
        setNotice('Blank margins trimmed. The original image is unchanged.');
      } else setNotice('No dark signature was detected. The image has not been changed.');
    } catch {
      setNotice('Could not detect the margins. The image is unchanged; try a PNG with a white or transparent background.');
    } finally { setBusy(false); }
  };
  return <ImagePicker slot="frontmatter-signature" title="Dean’s signature" framing={false}
    blurb="Optional. Placed after the closing message with the sign-off and dean’s name. Width sets the printed size; height follows the image proportions."
    renderPreview={image => <div className="signature-preview" dir={doc.design.textDirection ?? 'ltr'} style={{ background: doc.design.paperBg ?? '#fff' }}>
      <div className={`signature-preview-image is-${geometry.align}`} style={{ width: `${geometry.width / geometry.columnWidth * 100}%` }}>
        <SignatureImage asset={image} crop={content.signatureCrop} blend={content.signatureBlend !== false} />
      </div>
    </div>}>
    <LabeledNumber label="Signature width" unit="mm" min={10} max={80} step={.5} value={geometry.requestedWidth}
      onChange={value => update(d => { d.frontMatter ??= emptyFrontMatter(); d.frontMatter.signatureWidth = value; })} />
    <p className="hint">Print size: {geometry.width.toFixed(1)} × {geometry.height.toFixed(1)} mm.
      {geometry.width < geometry.requestedWidth - .05 ? ' Limited to the column width or 55 mm height. Trim blank margins if the signature looks too small.' : ' Preview shows its size relative to the text column.'}</p>
    <SegmentField<'start' | 'center' | 'end'> label="Signature alignment" value={geometry.align}
      options={[{ value: 'start', label: 'Start' }, { value: 'center', label: 'Centre' }, { value: 'end', label: 'End' }]}
      onChange={value => update(d => { d.frontMatter!.signatureAlign = value; })} />
    <LabeledNumber label="Space above signature" unit="mm" min={0} max={20} step={.5} value={geometry.gap}
      onChange={value => update(d => { d.frontMatter!.signatureGap = value; })} />
    <Toggle label="Blend white background" checked={content.signatureBlend !== false}
      onChange={value => update(d => { d.frontMatter!.signatureBlend = value; })} />
    <p className="hint">Blending suits dark ink on light paper. Turn it off for light signatures on dark paper or to keep the original colours.</p>
    <div className="signature-actions">
      <button type="button" className="add-btn" disabled={busy} onClick={trim}>
        {busy ? <MagazooLoader variant="inline" label="Checking margins…" /> : 'Trim blank margins'}
      </button>
      {content.signatureCrop && <button type="button" className="add-btn" disabled={busy}
        onClick={() => { update(d => { delete d.frontMatter!.signatureCrop; }); setNotice('Full image restored.'); }}>Restore full image</button>}
      <button type="button" className="add-btn" disabled={busy} onClick={() => {
        update(d => { d.frontMatter!.signatureWidth = 34; d.frontMatter!.signatureAlign = 'start'; d.frontMatter!.signatureGap = 2; });
      }}>Reset size & spacing</button>
    </div>
    <p className="hint">For scanned signatures on white or transparent backgrounds, trim empty margins first, then set the width. Trimming is reversible.</p>
    {notice && <p className="hint" role="status">{notice}</p>}
  </ImagePicker>;
}
