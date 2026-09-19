import { lazy, Suspense, useEffect, useState } from 'react';
import AdminPage from './admin/AdminPage';
import { ErrorBoundary } from './ErrorBoundary';
import { isAdminHash } from './routing';
import { MagazooLoader } from './components/MagazooLoader';
const App = lazy(() => import('./App'));

export function Root(){
  const [hash,setHash]=useState(location.hash);
  useEffect(()=>{
    let live=true;
    const change=async()=>{
      const destination=location.hash;
      if(!isAdminHash(hash)){
        const [{useProjectFile},{useDoc}]=await Promise.all([import('./store/projectFiles'),import('./store/useDoc')]);
        if(!live||location.hash!==destination)return;
        const state=useProjectFile.getState();
        if(state.target && state.savedDoc!==useDoc.getState().doc && !confirm('Leave this document? Some changes are not yet saved. Cancel to save a copy first.')){history.replaceState(null,'',location.pathname+location.search+hash);return;}
      }
      if(live)setHash(destination);
    };
    window.addEventListener('hashchange',change);return()=>{live=false;window.removeEventListener('hashchange',change);};
  },[hash]);
  return <ErrorBoundary><Suspense fallback={<MagazooLoader label="Loading Magazoo editor…" detail="Preparing your publication workspace." />}>{isAdminHash(hash)?<AdminPage/>:<App key={hash}/>}</Suspense></ErrorBoundary>;
}
