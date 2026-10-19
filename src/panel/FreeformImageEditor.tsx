import type {PlacedImage} from '../schema/document';
import {requestImageOutline} from '../lib/imageCanvas';
import './image-boundary.css';

/** Keep the panel simple; drawing and its draft live on the actual page. */
export function FreeformImageEditor({image}:{image:PlacedImage}) {
  return <div className="image-boundary-editor">
    <button type="button" className="add-btn image-boundary-apply" onClick={()=>requestImageOutline(image.id)}>Edit wrap points on canvas</button>
    <p className="hint">Move polygon points, click an edge to add one, or double-click a point to remove it. This changes text wrapping only; use Crop photo to change the visible image.</p>
  </div>;
}
