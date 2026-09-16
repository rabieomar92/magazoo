export class IssueApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function issueApi<T>(projectId: string, csrf: string, suffix = '', method = 'GET', data?: unknown, signal?: AbortSignal): Promise<T> {
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
