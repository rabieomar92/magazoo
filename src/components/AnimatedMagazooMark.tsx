import { useId } from 'react';

// Disjoint cut-outs of the original artwork. The same paths remove each
// animal from the wordmark AND clip its moving piece: nothing sits behind
// an animated animal, so it cannot leave a second, stationary animal behind.
const ANIMALS = [
  ['monkey', 'M3 61 L45 57 L45 26 L90 22 L116 0 L155 9 L163 51 L182 56 L182 102 L155 117 L115 118 L111 165 L100 181 L82 176 L76 146 L75 119 L30 133 L4 106 Z', '108px 106px'],
  ['cat', 'M200 16 L260 2 L285 37 L333 36 L327 79 L336 80 L352 70 L364 84 L352 109 L328 147 L317 182 L303 183 L293 128 L277 132 L266 115 L248 115 L239 128 L211 124 L202 99 L211 79 Z', '266px 113px'],
  ['panda', 'M376 64 L408 45 L419 28 L451 28 L466 43 L492 61 L520 64 L522 103 L502 124 L498 174 L498 211 L474 233 L440 225 L441 204 L426 196 L430 176 L451 164 L457 153 L436 146 L428 117 L407 105 L376 119 Z', '449px 125px'],
  ['koala', 'M523 111 L543 87 L580 95 L605 93 L637 104 L640 139 L625 160 L630 191 L621 222 L598 242 L586 232 L592 202 L581 190 L565 184 L566 174 L548 163 L527 167 L520 147 Z', '578px 164px'],
  ['squirrel', 'M0 380 L22 374 L32 350 L53 367 L72 354 L103 373 L104 404 L84 434 L74 461 L83 477 L69 499 L44 496 L30 481 L5 487 L0 475 Z', '60px 417px'],
  ['kitten', 'M221 475 L222 439 L246 450 L258 467 L283 464 L308 462 L315 493 L314 525 L297 535 L291 553 L269 549 L259 541 L237 550 L220 536 Z', '264px 525px'],
  ['little-monkey', 'M426 281 L454 272 L478 277 L499 270 L520 289 L518 329 L512 349 L532 345 L542 369 L533 405 L510 414 L497 411 L491 424 L477 419 L469 406 L479 391 L475 371 L460 367 L451 350 L457 338 L453 317 L436 309 L422 308 Z', '480px 344px'],
  ['little-cat', 'M588 373 L599 351 L616 373 L640 384 L640 423 L623 454 L637 450 L640 477 L625 498 L595 507 L587 490 L604 477 L608 456 L590 445 L573 434 L575 415 L588 408 Z', '604px 429px'],
] as const;

export function AnimatedMagazooMark() {
  const id = useId().replace(/:/g, '');
  const source = `${import.meta.env.BASE_URL}magazoo-mark.png`;
  return <svg className="magazoo-loader-mark" viewBox="0 0 640 598" aria-hidden="true">
    <defs>
      <image id={`${id}-source`} href={source} width="640" height="598" />
      <mask id={`${id}-letters`} maskUnits="userSpaceOnUse" x="0" y="0" width="640" height="598">
        <rect width="640" height="598" fill="white" />
        {ANIMALS.map(([name, path]) => <path key={name} d={path} fill="black" />)}
      </mask>
      {ANIMALS.map(([name, path]) => <clipPath key={name} id={`${id}-${name}`}><path d={path} /></clipPath>)}
    </defs>
    <use className="magazoo-loader-base" href={`#${id}-source`} mask={`url(#${id}-letters)`} />
    {ANIMALS.map(([name, , origin], index) => <g key={name}
      className={`magazoo-loader-animal is-${name}`}
      style={{ transformOrigin: origin, animationDelay: `${index * -.31}s` }}>
      <use href={`#${id}-source`} clipPath={`url(#${id}-${name})`} />
    </g>)}
  </svg>;
}
