import {expect,it} from 'vitest';
import {heroFadeClearStop} from './heroFade';
import {verticalFadeStops} from './pdfHeroFade';
import {readFileSync} from 'node:fs';

it('preserves the legacy fade at zero immersion and grows it continuously',()=>{
 expect(heroFadeClearStop(100,0)).toBe(50);
 expect(heroFadeClearStop(100,20)).toBe(30);
 expect(heroFadeClearStop(100,50)).toBe(0);
 for(const height of [20,108.14,160]){
  let previous=50;
  for(let depth=0;depth<=height;depth+=.1){const next=heroFadeClearStop(height,depth);expect(next).toBeLessThanOrEqual(previous);expect(next).toBeGreaterThanOrEqual(0);previous=next;}
 }
 expect(heroFadeClearStop(0,100)).toBe(50);expect(heroFadeClearStop(100,NaN)).toBe(50);
});
it.each(['0deg','180deg'])('the adaptive %s fade remains compatible with PDF composition',direction=>{
 const clear=heroFadeClearStop(108.14,24.6);
 expect(verticalFadeStops(`linear-gradient(${direction}, rgba(0, 0, 0, 0) ${clear}%, rgb(254, 254, 254) 99.5%, rgb(254, 254, 254) 100%)`)?.stops[0].offset).toBeCloseTo(clear/100);
});
it('uses the same photo-edge anchors on screen and in print without moving the photo',()=>{
 const css=readFileSync('src/styles/article-layouts.css','utf8');
 expect(css).toContain('inset:var(--hero-fade-top,0px) 0 var(--hero-fade-bottom,0px)');
 expect(css.match(/transparent var\(--hero-fade-clear-stop,50%\)/g)).toHaveLength(2);
});
