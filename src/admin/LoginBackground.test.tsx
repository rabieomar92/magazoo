import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {LoginBackground} from './LoginBackground';

let host:HTMLDivElement,root:ReturnType<typeof createRoot>,hidden:boolean;
let motion:EventTarget&{matches:boolean};
let connection:EventTarget&{saveData:boolean;effectiveType:string};
let play:ReturnType<typeof vi.spyOn>,pause:ReturnType<typeof vi.spyOn>;
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);hidden=false;
  motion=Object.assign(new EventTarget(),{matches:false});
  connection=Object.assign(new EventTarget(),{saveData:false,effectiveType:'4g'});
  vi.stubGlobal('matchMedia',()=>motion);Object.defineProperty(navigator,'connection',{configurable:true,value:connection});
  vi.spyOn(document,'hidden','get').mockImplementation(()=>hidden);
  play=vi.spyOn(HTMLMediaElement.prototype,'play').mockImplementation(function(this:HTMLMediaElement){this.dispatchEvent(new Event('play'));return Promise.resolve();});
  pause=vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(function(this:HTMLMediaElement){this.dispatchEvent(new Event('pause'));});
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(()=>{act(()=>root.unmount());host.remove();delete (navigator as Navigator&{connection?:unknown}).connection;vi.restoreAllMocks();vi.unstubAllGlobals();});
const render=()=>act(async()=>root.render(<LoginBackground/>));
const click=()=>act(async()=>host.querySelector<HTMLButtonElement>('button')!.click());

describe('lightweight decorative login video',()=>{
  it('presents the supplied clip at its native aspect ratio, without an interactive video surface',async()=>{
    await render();const video=host.querySelector('video')!;
    expect(video.getAttribute('src')).toBe('/media/login-magazoo.mp4');expect(video.poster).toContain('login-magazoo-poster.jpg');
    expect(video.width).toBe(752);expect(video.height).toBe(416);
    expect(host.querySelector('aside[aria-label="Magazoo animation"]')).not.toBeNull();
    expect(video.muted).toBe(true);expect(video.loop).toBe(true);expect(video.playsInline).toBe(true);expect(video.preload).toBe('none');
    expect(video.controls).toBe(false);expect(video.tabIndex).toBe(-1);expect(video.closest('[aria-hidden=true]')).not.toBeNull();
    expect(play).toHaveBeenCalled();expect(host.querySelector('button')!.textContent).toBe('Pause animation');
  });
  it.each(['reduced-motion','save-data','slow-network'])('never assigns a video URL or starts decoding under %s until explicitly requested',async preference=>{
    if(preference==='reduced-motion')motion.matches=true;
    if(preference==='save-data')connection.saveData=true;
    if(preference==='slow-network')connection.effectiveType='2g';
    await render();expect(host.querySelector('video')!.hasAttribute('src')).toBe(false);expect(play).not.toHaveBeenCalled();
    expect(host.querySelector('.admin-login-background')!.getAttribute('style')).toContain('login-magazoo-poster.jpg');
    await click();expect(host.querySelector('video')!.getAttribute('src')).toBe('/media/login-magazoo.mp4');expect(play).toHaveBeenCalled();
  });
  it('pauses hidden tabs, resumes visible tabs, and keeps a manual pause across tab switches',async()=>{
    await render();const started=play.mock.calls.length;
    await act(async()=>{hidden=true;document.dispatchEvent(new Event('visibilitychange'));});
    expect(pause).toHaveBeenCalled();
    await act(async()=>{hidden=false;document.dispatchEvent(new Event('visibilitychange'));});
    expect(play.mock.calls.length).toBeGreaterThan(started);
    await click();const pausedAt=play.mock.calls.length;
    await act(async()=>{hidden=true;document.dispatchEvent(new Event('visibilitychange'));});
    await act(async()=>{hidden=false;document.dispatchEvent(new Event('visibilitychange'));});
    expect(play.mock.calls.length).toBe(pausedAt);expect(host.querySelector('button')!.textContent).toBe('Play animation');
    expect(host.querySelector('video')!.hasAttribute('src')).toBe(true); // no repeated URL swaps/downloads.
  });
  it('reacts to changed motion and data-saving preferences, and falls back quietly if playback fails',async()=>{
    await render();await act(async()=>{motion.matches=true;motion.dispatchEvent(new Event('change'));});
    expect(host.querySelector('button')!.textContent).toBe('Play animation');
    await act(async()=>{motion.matches=false;motion.dispatchEvent(new Event('change'));});
    expect(host.querySelector('button')!.textContent).toBe('Pause animation');
    await act(async()=>{connection.saveData=true;connection.dispatchEvent(new Event('change'));});
    expect(host.querySelector('button')!.textContent).toBe('Play animation');
    await act(async()=>host.querySelector('video')!.dispatchEvent(new Event('error')));
    expect(host.querySelector('video')).toBeNull();expect(host.querySelector('button')).toBeNull();
    expect(host.querySelector('.admin-login-background')).not.toBeNull();
  });
  it('keeps the sign-in page usable when autoplay is blocked and releases playback on unmount',async()=>{
    play.mockImplementation(()=>Promise.reject(new Error('Autoplay blocked')));
    await render();expect(host.querySelector('button')!.textContent).toBe('Play animation');
    play.mockImplementation(function(this:HTMLMediaElement){this.dispatchEvent(new Event('play'));return Promise.resolve();});
    await click();expect(host.querySelector('button')!.textContent).toBe('Pause animation');
    const calls=pause.mock.calls.length;await act(async()=>root.render(<div/>));expect(pause.mock.calls.length).toBeGreaterThan(calls);
  });
  it('does not download or play the film while the session is being checked',async()=>{
    await act(async()=>root.render(<LoginBackground enabled={false}/>));
    expect(host.querySelector('video')!.hasAttribute('src')).toBe(false);expect(play).not.toHaveBeenCalled();
    await click();expect(host.querySelector('video')!.hasAttribute('src')).toBe(false);
    await render();expect(host.querySelector('video')!.getAttribute('src')).toBe('/media/login-magazoo.mp4');
  });
  it('keeps one source across screen sizes instead of reloading a blurry mobile rendition',async()=>{
    await render();const video=host.querySelector('video')!;
    await act(async()=>{window.dispatchEvent(new Event('resize'));});
    expect(host.querySelector('video')).toBe(video);expect(video.getAttribute('src')).toBe('/media/login-magazoo.mp4');
    expect(host.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
    await click();expect(host.querySelector('button')!.getAttribute('aria-pressed')).toBe('false');
  });
});
