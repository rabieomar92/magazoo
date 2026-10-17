import {useEffect,useRef,useState} from 'react';

interface DataConnection extends EventTarget {saveData?:boolean;effectiveType?:string}
const VIDEO=`${import.meta.env.BASE_URL}media/login-network.mp4`;
const HD_VIDEO=`${import.meta.env.BASE_URL}media/login-network-hd.mp4`;
const POSTER=`${import.meta.env.BASE_URL}media/login-network-hd-poster.jpg`;

/** One small, local, silent video. No player SDK, timers or canvas animation.
 * Preferences are checked before assigning src, so a still background does not
 * secretly download the movie. Manual pause survives tab switches. */
export function LoginBackground({enabled=true}:{enabled?:boolean}){
  const video=useRef<HTMLVideoElement>(null);
  const [automatic,setAutomatic]=useState(false),[visible,setVisible]=useState(!document.hidden);
  const [requested,setRequested]=useState<boolean|null>(null),[loaded,setLoaded]=useState(false);
  const [ready,setReady]=useState(false),[playing,setPlaying]=useState(false),[failed,setFailed]=useState(false);
  // Decide once before assigning src; resizing must not redownload the clip.
  const[highDefinition]=useState(()=>window.innerWidth>=1000&&((navigator as Navigator&{connection?:DataConnection}).connection?.effectiveType??'4g')==='4g');
  const shouldPlay=enabled&&(requested??automatic)&&visible&&!failed;
  useEffect(()=>{
    const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const connection=(navigator as Navigator&{connection?:DataConnection}).connection;
    const preference=()=>setAutomatic(!motion?.matches&&!connection?.saveData&&!['2g','slow-2g'].includes(connection?.effectiveType??''));
    const visibility=()=>setVisible(!document.hidden);
    preference();visibility();
    motion?.addEventListener('change',preference);connection?.addEventListener('change',preference);
    document.addEventListener('visibilitychange',visibility);
    return ()=>{motion?.removeEventListener('change',preference);connection?.removeEventListener('change',preference);document.removeEventListener('visibilitychange',visibility);};
  },[]);
  useEffect(()=>{if(shouldPlay)setLoaded(true);},[shouldPlay]);
  useEffect(()=>{
    const element=video.current;if(!element)return;
    element.muted=true;
    if(shouldPlay&&loaded)void element.play()?.catch(()=>setPlaying(false));
    else element.pause();
  },[shouldPlay,loaded,requested]);
  useEffect(()=>{const element=video.current;return ()=>element?.pause();},[]);
  return <>
    <div className="admin-login-background" aria-hidden="true" style={{backgroundImage:`url("${POSTER}")`}}>
      {!failed&&<video ref={video} src={loaded?(highDefinition?HD_VIDEO:VIDEO):undefined} poster={POSTER} autoPlay={shouldPlay} muted loop playsInline preload="none" tabIndex={-1}
        className={ready?'is-ready':undefined} onLoadedData={()=>setReady(true)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onError={()=>{setFailed(true);setPlaying(false);}}/>}
    </div>
    {!failed&&<div className="admin-login-controls"><button type="button" className="admin-login-motion" onClick={()=>setRequested(!playing)} aria-label={playing?'Pause background animation':'Play background animation'}>
      <svg viewBox="0 0 20 20" aria-hidden="true">{playing?<path d="M6 4v12M14 4v12" fill="none" stroke="currentColor" strokeWidth="2.5"/>:<path d="m7 4 9 6-9 6Z" fill="currentColor"/>}</svg>
      {playing?'Pause animation':'Play animation'}
    </button></div>}
  </>;
}
