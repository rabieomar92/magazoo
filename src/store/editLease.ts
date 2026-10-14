import { create } from 'zustand';
export type LeaseStatus = 'local'|'loading'|'active'|'blocked'|'lost'|'released'|'recovery'|'error';
export const useEditLease = create<{status:LeaseStatus;token?:string;leaseId?:string;deadline:number;message:string}>(()=>({status:'local',deadline:0,message:''}));
const endpoint = () => `${import.meta.env.BASE_URL}api/documents/shared/lock`;
export class EditLeaseError extends Error { status:number;constructor(message:string,status=423){super(message);this.status=status;} }
async function request(token:string,leaseId:string,action:string,keepalive=false) {
  const response=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,leaseId}),keepalive,signal:keepalive?undefined:AbortSignal.timeout(12000)});
  const data=await response.json();
  if(!response.ok)throw new EditLeaseError(data.error || 'Could not confirm editing access.',response.status);
  return data;
}
export async function acquireEditLease(token:string) {
  const previous=useEditLease.getState();
  const leaseId=previous.token===token && ['lost','error'].includes(previous.status) && previous.leaseId ? previous.leaseId : crypto.randomUUID();
  const started=Date.now();
  useEditLease.setState({status:'loading',token,leaseId,deadline:0,message:'Reserving editing access…'});
  try {
    const data=await request(token,leaseId,'acquire');
    if(useEditLease.getState().leaseId!==leaseId){
      await releaseOwnedLease(token,leaseId);
      throw new EditLeaseError('This editing request was superseded.',409);
    }
    const deadline=started+data.validForMs;
    if(!Number.isFinite(deadline)||deadline<Date.now()+5000)throw new Error('Editing access could not be confirmed. Please retry.');
    useEditLease.setState({status:'active',deadline,message:'Only this tab can edit. Other visitors are read-only.'});
    return {...data,leaseId};
  } catch(error) {
    if(useEditLease.getState().leaseId===leaseId)useEditLease.setState({status:error instanceof EditLeaseError && error.status===423?'blocked':'error',deadline:0,message:error instanceof Error?error.message:'Could not reserve editing access.'});
    throw error;
  }
}
export function loseEditLease(message='The connection could not confirm editing access. Editing is paused; your changes are kept here.') {
  useEditLease.setState({status:'lost',deadline:0,message});
}
export function editLeaseId(token:string) {
  const state=useEditLease.getState();
  if(state.token!==token || state.status!=='active' || state.deadline<=Date.now()+1000 || !state.leaseId)throw new EditLeaseError('Editing access is not active. Your changes are kept here; reconnect before saving.');
  return state.leaseId;
}
export async function releaseEditLease(token?:string,keepalive=false) {
  const state=useEditLease.getState();
  if(!state.token || !state.leaseId || token && token!==state.token)return;
  await releaseOwnedLease(state.token,state.leaseId,keepalive);
}
/** Release only this request's ownership, never a newer tab/session's lease. */
export async function releaseOwnedLease(token:string,leaseId:string,keepalive=false) {
  const ownsState=()=>useEditLease.getState().token===token&&useEditLease.getState().leaseId===leaseId;
  if(ownsState())useEditLease.setState({status:'released',deadline:0,message:'Finishing editing access…'});
  try {
    await request(token,leaseId,'release',keepalive);
    if(ownsState())useEditLease.setState({leaseId:undefined,message:'Editing finished. Another visitor can now start editing.'});
  } catch {
    if(ownsState())useEditLease.setState({message:'Editing stopped here. The server could not confirm release; access will recover within about 3 minutes.'});
  }
}
export function maintainEditLease() {
  let stopped=false,renewing=false;
  const renew=async()=>{
    const state=useEditLease.getState();
    if(stopped||renewing||state.status!=='active'||!state.token||!state.leaseId)return;
    if(state.deadline<=Date.now()){loseEditLease('Editing access expired while the browser was inactive. Your changes are kept here.');return;}
    const started=Date.now();renewing=true;
    try {
      const result=await request(state.token,state.leaseId,'renew');
      if(!stopped && useEditLease.getState().status==='active' && useEditLease.getState().leaseId===state.leaseId)useEditLease.setState({deadline:started+result.validForMs});
    }catch{if(!stopped && useEditLease.getState().status==='active' && useEditLease.getState().leaseId===state.leaseId)loseEditLease();}
    finally{renewing=false;}
  };
  const clock=setInterval(()=>{const s=useEditLease.getState();if(s.status==='active'&&s.deadline<=Date.now())loseEditLease();},1000);
  const heartbeat=setInterval(()=>void renew(),20000);
  const hidden=()=>{if(document.visibilityState==='visible')void renew();};
  const close=()=>{void releaseEditLease(undefined,true);};
  document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',close);
  return()=>{stopped=true;clearInterval(clock);clearInterval(heartbeat);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',close);};
}
