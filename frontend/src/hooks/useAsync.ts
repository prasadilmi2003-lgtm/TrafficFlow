import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

interface AsyncState<T> {
  data: T | undefined;
  error: unknown;
  /** True only for the first load; background refreshes keep showing the old data. */
  loading: boolean;
}

/**
 * Loads data when the component mounts or `deps` change, and optionally
 * refreshes it every `pollMs` milliseconds while the browser tab is visible.
 * Live pages (queues, dashboards, assignments) use polling instead of
 * WebSockets: much simpler, and fast enough for this use.
 */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList, options: { pollMs?: number } = {}) {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, error: undefined, loading: true });
  const requestId = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  const refresh = useCallback(
    async (background: boolean) => {
      const id = ++requestId.current;
      if (!background) setState((s) => ({ ...s, loading: true, error: undefined }));
      try {
        const data = await run();
        // Ignore answers to requests that have since been replaced by newer ones
        if (id === requestId.current) setState({ data, error: undefined, loading: false });
      } catch (error) {
        if (id === requestId.current) setState((s) => ({ ...s, error, loading: false }));
      }
    },
    [run],
  );

  useEffect(() => {
    void refresh(false);
    if (!options.pollMs) return undefined;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(true);
    }, options.pollMs);
    return () => window.clearInterval(timer);
  }, [refresh, options.pollMs]);

  const reload = useCallback(() => refresh(true), [refresh]);

  return { ...state, reload, setData: (data: T) => setState({ data, error: undefined, loading: false }) };
}
