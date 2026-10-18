import './BusyIndicator.css';

/** Small wait indicator for controls and thumbnails; never appears on paper. */
export function BusyIndicator({label}:{label:string}) {
  return <span className="busy-indicator" role="status" aria-live="polite"><span className="busy-indicator-ring" aria-hidden="true"/>{label}</span>;
}
