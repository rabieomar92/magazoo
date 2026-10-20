import {useEffect,useState,type CSSProperties,type ReactNode} from 'react';
import './MagazooLoader.css';
import './BusyIndicator.css';

export interface MagazooLoaderProps {
  label?: ReactNode;
  detail?: ReactNode;
  className?: string;
  variant?: 'card' | 'banner' | 'inline';
  tone?: 'light' | 'dark';
  value?: number;
  max?: number;
}

/** No audio, no player controls and no animation for reduced-motion readers. */
function LoadingFilm(){
  const [animate,setAnimate]=useState(false),[failed,setFailed]=useState(false);
  useEffect(()=>{
    const preference=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const sync=()=>setAnimate(!!preference&&!preference.matches);
    sync();preference?.addEventListener('change',sync);
    return()=>preference?.removeEventListener('change',sync);
  },[]);
  const base=import.meta.env.BASE_URL;
  return <span className="magazoo-loader-film" aria-hidden="true">{animate&&!failed
    ? <video autoPlay muted loop playsInline preload="metadata" poster={`${base}magazoo-loading-mono.webp`} width={752} height={416} onError={()=>setFailed(true)}>
        <source src={`${base}magazoo-loading-mono.mp4`} type="video/mp4"/>
      </video>
    : <img src={`${base}magazoo-loading-mono.webp`} width={752} height={416} alt=""/>}</span>;
}


/**
 * Quiet monochrome film for waiting panels; small controls keep a simple ring.
 */
export function MagazooLoader({
  label = 'Loading Magazoo…', detail, className, variant = 'card', tone = 'light', value, max,
}: MagazooLoaderProps) {
  const determinate = Number.isFinite(value) && Number.isFinite(max) && Number(max) > 0;
  const ratio = determinate ? Math.max(0, Math.min(1, Number(value) / Number(max))) : 0;
  const style = determinate ? ({ '--magazoo-progress': `${ratio * 100}%` } as CSSProperties) : undefined;

  return (
    <div
      className={['magazoo-loader', `is-${variant}`, `is-${tone}`, className].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {variant==='inline'?<span className="busy-indicator-ring magazoo-loader-ring" aria-hidden="true" />:<LoadingFilm/>}
      <span className="magazoo-loader-copy">
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
        {determinate && variant !== 'inline' && <span
          className={`magazoo-loader-track${determinate ? ' is-determinate' : ''}`}
          role="progressbar"
          aria-valuemin={determinate ? 0 : undefined}
          aria-valuemax={determinate ? Number(max) : undefined}
          aria-valuenow={ratio * Number(max)}
          aria-label={typeof label === 'string' ? label : 'Progress'}
          style={style}
        ><i /></span>}
      </span>
    </div>
  );
}
