import { createContext, useContext, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const CONTROL =
  'block w-full rounded-md border-0 px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset placeholder:text-slate-400 ' +
  'focus:ring-2 focus:ring-inset focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-500';

const DARK_CONTROL =
  'block w-full rounded-xl border-0 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white shadow-sm ring-1 ring-inset placeholder:text-slate-500 ' +
  'focus:bg-white/[0.09] focus:ring-2 focus:ring-inset focus:ring-sky-400 disabled:text-slate-500';

/** Lets a dark page (the login screens) restyle every field inside it. */
export const FieldThemeContext = createContext<'light' | 'dark'>('light');

function controlClasses(hasError: boolean, dark = false): string {
  if (dark) return `${DARK_CONTROL} ${hasError ? 'ring-red-400/70' : 'ring-white/15'}`;
  return `${CONTROL} ${hasError ? 'ring-red-400' : 'ring-slate-300'}`;
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string; className: string }) => ReactNode;
}

/** Label, control, hint and error message, wired together for screen readers. */
export function Field({ label, error, hint, optional, children }: FieldProps) {
  const id = useId();
  const dark = useContext(FieldThemeContext) === 'dark';
  const messageId = `${id}-message`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={`block text-sm font-medium ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
        {label}
        {optional && <span className={`ml-1 font-normal ${dark ? 'text-slate-500' : 'text-slate-400'}`}>(optional)</span>}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': error || hint ? messageId : undefined,
        className: controlClasses(Boolean(error), dark),
      })}
      {error ? (
        <p id={messageId} className={`text-sm ${dark ? 'text-red-300' : 'text-red-600'}`}>
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type Common = { label: string; error?: string; hint?: ReactNode; optional?: boolean };

export function TextInput({ label, error, hint, optional, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} error={error} hint={hint} optional={optional}>
      {(props) => <input {...rest} {...props} />}
    </Field>
  );
}

export function SelectInput({ label, error, hint, optional, children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} error={error} hint={hint} optional={optional}>
      {(props) => (
        <select {...rest} {...props}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function TextArea({ label, error, hint, optional, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} error={error} hint={hint} optional={optional}>
      {(props) => <textarea rows={4} {...rest} {...props} />}
    </Field>
  );
}

/** A select used as a compact filter above a list (no label shown). */
export function FilterSelect({ label, children, ...rest }: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select aria-label={label} className={`${controlClasses(false)} w-auto min-w-40`} {...rest}>
      {children}
    </select>
  );
}
