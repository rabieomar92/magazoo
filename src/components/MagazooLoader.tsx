import type { CSSProperties, ReactNode } from 'react';
import './MagazooLoader.css';

const MARK_SRC = `${import.meta.env.BASE_URL}magazoo-mark.png`;

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
 * The animal layers are clipped replicas of the canonical bundled mark, so
 * the animation never substitutes, redraws, or approximates the logo. The
 * full mark remains underneath to keep the artwork crisp between frames.
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
        <img className="magazoo-loader-base" src={MARK_SRC} alt="" />
        {['monkey', 'cat', 'panda', 'koala', 'squirrel', 'kitten'].map(animal => (
          <span className={`magazoo-loader-animal is-${animal}`} key={animal}>
            <img src={MARK_SRC} alt="" />
          </span>
        ))}
        <span className="magazoo-loader-shine" />
      </span>
      <span className="magazoo-loader-copy">
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
        {variant !== 'inline' && <span
          className={`magazoo-loader-track${determinate ? ' is-determinate' : ''}`}
          role="progressbar"
          aria-valuemin={determinate ? 0 : undefined}
          aria-valuemax={determinate ? Number(max) : undefined}
          aria-valuenow={determinate ? Number(value) : undefined}
          style={style}
        ><i /></span>}
      </span>
    </div>
  );
}
