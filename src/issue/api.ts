export class IssueApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function issueApi<T>(projectId: string, csrf: string, suffix = '', method = 'GET', data?: unknown, signal?: AbortSignal): Promise<T> {
  if(method==='GET'&&suffix===''){
    const snapshot=await issueApi<import('./model').IssueResponse>(projectId,csrf,'/metadata','GET',undefined,signal);
    // Fetch individual articles instead of one enormous image-filled response.
    // Validate versions before publishing a coherent snapshot to the compiler.
    const items=[...snapshot.items];let next=0;
    await Promise.all(Array.from({length:Math.min(3,items.length)},async()=>{for(;;){const i=next++;if(i>=items.length)return;const item=items[i];
      const response=await fetch(`${import.meta.env.BASE_URL}api/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(item.id)}`,{signal:signal??AbortSignal.timeout(60000),headers:{'X-CSRF-Token':csrf}});
      if(!response.ok)throw new Error('An article could not be loaded. Refresh the issue; no data was changed.');
      const current=await response.json();if(current.version!==item.version)throw new Error('An article changed while opening the issue. Reload to compile a consistent version.');items[i]=current;
    }}));
    return {...snapshot,items} as T;
  }
  const response = await fetch(`${import.meta.env.BASE_URL}api/projects/${encodeURIComponent(projectId)}/issue${suffix}`, {
    method,
    signal: signal ?? AbortSignal.timeout(60_000),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json().catch(() => { throw new Error('The issue service could not be reached. Check your connection and try again.'); });
  if (!response.ok) throw new IssueApiError(result.error ?? 'Unable to save this issue.', response.status);
  return result as T;
}
