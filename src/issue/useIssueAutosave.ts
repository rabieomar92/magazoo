import { useCallback, useEffect, useRef, useState } from 'react';
import { issueApi } from './api';
import type { IssuePlan } from './model';

/** Serialize arrangement writes and always use the latest server revision.
 * A rejected request never advances the saved snapshot or retries a conflict. */
export function useIssueAutosave(projectId: string, csrf: string, plan: IssuePlan, initialVersion: number, initiallySaved: IssuePlan | null) {
  const current = useRef(plan);
  current.current = plan;
  const version = useRef(initialVersion);
  const saved = useRef(initiallySaved ? JSON.stringify(initiallySaved) : '');
  const flight = useRef<Promise<number> | null>(null);
  const alive = useRef(true);
  const [status, setStatus] = useState<'saved' | 'pending' | 'saving' | 'error'>(saved.current === JSON.stringify(plan) ? 'saved' : 'pending');
  const [error, setError] = useState('');
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const flush = useCallback((): Promise<number> => {
    if (flight.current) return flight.current;
    if (saved.current === JSON.stringify(current.current)) return Promise.resolve(version.current);
    const work = async () => {
      try {
        while (saved.current !== JSON.stringify(current.current)) {
          const snapshot = current.current;
          const text = JSON.stringify(snapshot);
          if (alive.current) { setStatus('saving'); setError(''); }
          const result = await issueApi<{ version: number }>(projectId, csrf, '', 'PUT', { version: version.current, plan: snapshot });
          version.current = result.version;
          saved.current = text;
        }
        if (alive.current) setStatus('saved');
        return version.current;
      } catch (failure) {
        if (alive.current) { setStatus('error'); setError(failure instanceof Error ? failure.message : 'The arrangement could not be saved.'); }
        throw failure;
      } finally { flight.current = null; }
    };
    flight.current = work();
    return flight.current;
  }, [projectId, csrf]);
  useEffect(() => {
    if (saved.current === JSON.stringify(plan)) return;
    setStatus('pending');
    const timer = window.setTimeout(() => { void flush().catch(() => {}); }, 800);
    return () => window.clearTimeout(timer);
  }, [plan, flush]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (saved.current !== JSON.stringify(current.current)) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, []);
  const acceptFinalizedVersion = (nextVersion: number) => { version.current = nextVersion; saved.current = JSON.stringify(current.current); setStatus('saved'); };
  return { status, error, flush, acceptFinalizedVersion };
}
