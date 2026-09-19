import type { CSSProperties, ReactNode } from 'react';
import './MagazooLoader.css';
import { AnimatedMagazooMark } from './AnimatedMagazooMark';

export interface MagazooLoaderProps {
  label?: ReactNode;
  detail?: ReactNode;
  className?: string;
  variant?: 'card' | 'banner' | 'inline';
  tone?: 'light' | 'dark';
  value?: number;
  max?: number;
}

/**
 * The single branded wait state used throughout Magazoo.
 *
 * Only the original wordmark and its animals animate. Actual progress is
 * shown when available, without a decorative sweep or indeterminate track.
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
      <span className="magazoo-loader-art" aria-hidden="true">
        <AnimatedMagazooMark />
      </span>
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
