import type {PlacedImage} from '../schema/document';
import {requestImageOutline} from '../lib/imageCanvas';
import './image-boundary.css';

/** Keep the panel simple; drawing and its draft live on the actual page. */
export function FreeformImageEditor({image}:{image:PlacedImage}) {
  return <div className="image-boundary-editor">
    <button type="button" className="add-btn image-boundary-apply" onClick={()=>requestImageOutline(image.id)}>Draw border on canvas</button>
    <p className="hint">Draw around the subject on the page, then choose Apply border. No points or coordinates to inspect. Text and the caption stay outside the border.</p>
  </div>;
}
