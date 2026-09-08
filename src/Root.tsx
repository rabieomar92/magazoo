import { lazy, Suspense, useEffect, useState } from 'react';
import App from './App';
import { useProjectFile } from './store/projectFiles';
import { useDoc } from './store/useDoc';
const AdminPage=lazy(()=>import('./admin/AdminPage'));
export function Root(){
  const [hash,setHash]=useState(location.hash);
  useEffect(()=>{
    const change=()=>{
      const state=useProjectFile.getState();
      if(state.target && state.savedDoc!==useDoc.getState().doc && !confirm('Leave this document? Some changes are not yet saved. Cancel to save a copy first.')){history.replaceState(null,'',location.pathname+hash);return;}
      setHash(location.hash);
    };
    window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);
  },[hash]);
  return <Suspense fallback={<p>Loading Magazoo…</p>}>{hash==='#admin'?<AdminPage/>:<App key={hash}/>}</Suspense>;
}
