import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { errorMessage } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Layout';
import { homePathForRole } from '../../utils/labels';
import { useAuth } from './useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Where the user was going before being sent to the login page
  const from = (location.state as { from?: string } | null)?.from;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(email, password);
      const home = homePathForRole(user.role);
      navigate(from?.startsWith(home) ? from : home, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Log in</h1>
      <p className="mt-1 text-sm text-slate-600">Report incidents, track responses and coordinate help.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextInput
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" loading={submitting} className="w-full">
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        New to TrafficFlow?{' '}
        <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
          Create a citizen account
        </Link>
      </p>
    </>
  );
}
