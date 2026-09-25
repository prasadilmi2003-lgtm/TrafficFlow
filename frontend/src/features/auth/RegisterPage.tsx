import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { errorMessage, fieldErrors } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Layout';
import { useAuth } from './useAuth';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [field]: value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setErrors({ confirm: 'Passwords do not match' });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await register({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Create an account</h1>
      <p className="mt-1 text-sm text-slate-600">New accounts are citizen accounts.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <TextInput label="Full name" autoComplete="name" value={form.fullName} onChange={(e) => set('fullName')(e.target.value)} error={errors.fullName} required />
        <TextInput label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email')(e.target.value)} error={errors.email} required />
        <TextInput
          label="Phone"
          type="tel"
          autoComplete="tel"
          optional
          value={form.phone}
          onChange={(e) => set('phone')(e.target.value)}
          error={errors.phone}
        />
        <TextInput
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with letters and numbers"
          value={form.password}
          onChange={(e) => set('password')(e.target.value)}
          error={errors.password}
          required
        />
        <TextInput
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={(e) => set('confirm')(e.target.value)}
          error={errors.confirm}
          required
        />
        <Button type="submit" loading={submitting} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
          Log in
        </Link>
      </p>
    </>
  );
}
