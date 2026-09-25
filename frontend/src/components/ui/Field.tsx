import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

const CONTROL =
  'block w-full rounded-md border-0 px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset placeholder:text-slate-400 ' +
  'focus:ring-2 focus:ring-inset focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-500';

function controlClasses(hasError: boolean): string {
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
  const messageId = `${id}-message`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': error || hint ? messageId : undefined,
        className: controlClasses(Boolean(error)),
      })}
      {error ? (
        <p id={messageId} className="text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-sm text-slate-500">
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
