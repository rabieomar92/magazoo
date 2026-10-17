import type { Asset } from '../schema/document';
import { FramedImage } from '../components/FramedImage';
import { normalizeImageFrame, type ImageFrame } from '../lib/imageFrame';
import { ImagePanControls, ImagePanPreview } from '../panel/ImagePanControls';

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Use the same real frame geometry and lightweight free-pan gesture as the
 * article editor. The aspect comes from the measured contents slot. */
export function HeroCropEditor({ asset, frame, aspect, disabled, onChange }: {
  asset: Asset;
  frame?: ImageFrame;
  aspect: number;
  disabled?: boolean;
  onChange: (frame: ImageFrame) => void;
}) {
  const resolved=normalizeImageFrame(frame);
  const centred=!resolved.offsetX&&!resolved.offsetY&&!resolved.panX&&!resolved.panY&&resolved.scale===1;
  return <div className="crop-editor">
    <ImagePanPreview frame={resolved} aspectRatio={aspect} disabled={disabled}
      label="Drag to reposition this picture inside its slot" onChange={pan=>onChange({...resolved,...pan})}>
      {preview=><><FramedImage asset={asset} frame={preview} fit="cover"/><span className="crop-guides" aria-hidden="true"/></>}
    </ImagePanPreview>
    <ImagePanControls frame={resolved} disabled={disabled} onChange={pan=>onChange({...resolved,...pan})}/>
    <div className="crop-controls">
      <label className="crop-zoom"><span>Zoom</span><input type="range" min={.5} max={3} step={.02}
        value={clamp(resolved.scale,.5,3)} disabled={disabled}
        onChange={event=>onChange({...resolved,scale:clamp(event.target.valueAsNumber,.5,3)})}/>
        <b>{Math.round(clamp(resolved.scale,.5,3)*100)}%</b>
      </label>
      <button type="button" className="ghost" disabled={disabled||centred} onClick={()=>onChange({scale:1,offsetX:0,offsetY:0})}>Recentre</button>
    </div>
  </div>;
}
