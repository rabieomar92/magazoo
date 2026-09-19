import type { CSSProperties } from 'react';

// Separate animal-free lettering and a registered four-frame gait per animal.
// Native logo coordinates keep every route aligned at any loader size.
const ANIMALS = [
  { name: 'monkey', row: 0, x: 30, y: 27, size: 82, route: 'upper', duration: 8, delay: 0 },
  { name: 'cat', row: 1, x: 203, y: 35, size: 74, route: 'arch', duration: 7, delay: -2 },
  { name: 'panda', row: 2, x: 360, y: 27, size: 82, route: 'panda', duration: 11, delay: -3 },
  { name: 'koala', row: 3, x: 562, y: 166, size: 72, route: 'climb', duration: 10, delay: -1 },
  { name: 'squirrel', row: 4, x: 27, y: 230, size: 78, route: 'zigzag', duration: 9, delay: -5 },
  { name: 'kitten', row: 5, x: 194, y: 304, size: 68, route: 'lower', duration: 7, delay: -1 },
  { name: 'little-monkey', row: 0, x: 379, y: 224, size: 70, route: 'round', duration: 10, delay: -4 },
  { name: 'little-cat', row: 1, x: 540, y: 462, size: 66, route: 'exclaim', duration: 9, delay: -6 },
] as const;

export function AnimatedMagazooMark() {
  const base = import.meta.env.BASE_URL;
  return <svg className="magazoo-loader-mark" viewBox="-12 -5 664 620" aria-hidden="true">
    <image className="magazoo-loader-base" href={base + 'magazoo-letters.png'} width="640" height="598" />
    <g className="magazoo-loader-animals">
      {ANIMALS.map(animal => <g key={animal.name} transform={`translate(${animal.x} ${animal.y})`}>
        <g className={`magazoo-loader-animal route-${animal.route}`} data-animal={animal.name}
          style={{ '--route-time': `${animal.duration}s`, '--route-delay': `${animal.delay}s` } as CSSProperties}>
          <svg width={animal.size} height={animal.size} viewBox="0 0 256 256" overflow="hidden">
            <image className="magazoo-animal-gait" href={base + 'magazoo-animals.png'} width="1024" height="1536" y={-animal.row * 256}
              style={{ animationDuration: animal.name === 'panda' || animal.name === 'koala' ? '.9s' : '.6s', animationDelay: `${animal.delay / 7}s` }} />
          </svg>
        </g>
      </g>)}
    </g>
  </svg>;
}
