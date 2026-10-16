import type {TightContour} from '../lib/tightContour';

export function ContourFloat({contour}:{contour:TightContour}) {
  return <span aria-hidden="true" data-tight-contour="true" style={{display:'block',float:contour.side,width:'100%',height:'100%',shapeOutside:contour.path,pointerEvents:'none'}}/>;
}
