import {useLayoutEffect,useState} from 'react';
import {HERO_CAPTION_LAYOUT_EVENT} from '../lib/heroCaptionPlacement';

/** A newly mounted page-level caption is measurable after its portal commits.
 * Coalesce geometry notifications; pointer movement never repaginates. */
export function useHeroCaptionLayout() {
  const [epoch,setEpoch]=useState(0);
  useLayoutEffect(()=>{
    let pending=0;
    const changed=()=>{if(!pending)pending=requestAnimationFrame(()=>{pending=0;setEpoch(value=>value+1);});};
    window.addEventListener(HERO_CAPTION_LAYOUT_EVENT,changed);changed();
    return ()=>{window.removeEventListener(HERO_CAPTION_LAYOUT_EVENT,changed);cancelAnimationFrame(pending);};
  },[]);
  return epoch;
}
