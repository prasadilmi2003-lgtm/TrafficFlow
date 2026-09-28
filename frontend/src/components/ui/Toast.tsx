import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CloseIcon } from './icons';

type Tone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
}

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_STYLES: Record<Tone, { dot: string; label: string }> = {
  success: { dot: 'bg-emerald-500', label: 'Done' },
  error: { dot: 'bg-red-500', label: 'Error' },
  info: { dot: 'bg-sky-500', label: 'Note' },
};

/** How long a notification stays (errors a little longer, so they can be read). */
const DURATION_MS: Record<Tone, number> = { success: 4000, info: 5000, error: 7000 };

/**
 * Short notifications ("Incident verified") shown in the bottom corner after
 * an action. Screen readers announce them through a live region.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((toast) => toast.id !== id)), []);

  const show = useCallback(
    (tone: Tone, message: string) => {
      const id = nextId.current++;
      // At most four at once: the oldest one goes first
      setToasts((all) => [...all.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), DURATION_MS[tone]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => show('success', message),
      error: (message) => show('error', message),
      info: (message) => show('info', message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[3000] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg bg-white p-3 pl-4 shadow-lg ring-1 ring-slate-200"
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_STYLES[toast.tone].dot}`} aria-hidden="true" />
            <p className="flex-1 text-sm text-slate-800">
              <span className="sr-only">{TONE_STYLES[toast.tone].label}: </span>
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Dismiss notification"
            >
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast must be used inside <ToastProvider>');
  return toast;
}
