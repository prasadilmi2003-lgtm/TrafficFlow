import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { errorMessage } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Layout';
import { homePathForRole } from '../../utils/labels';
import { useAuth } from './useAuth';

type Audience = 'citizen' | 'staff';

const AUDIENCES: Array<{ id: Audience; label: string; intro: string }> = [
  { id: 'citizen', label: 'Login as Citizen', intro: 'Report incidents, track responses and coordinate help.' },
  { id: 'staff', label: 'Login as Admin', intro: 'For administrators, operators and responders.' },
];

export function LoginPage() {
  const { login, logout } = useAuth();
  const [audience, setAudience] = useState<Audience>('citizen');
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
      // Each button is for one kind of account; send people to the other one if they picked the wrong one
      if ((audience === 'citizen') !== (user.role === 'CITIZEN')) {
        await logout();
        setError(
          audience === 'citizen'
            ? 'This is a staff account. Use "Login as Admin" instead.'
            : 'This is a citizen account. Use "Login as Citizen" instead.',
        );
        return;
      }
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
      <h1 className="text-2xl font-semibold tracking-tight text-white">Log in</h1>

      <div role="group" aria-label="Account type" className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-white/[0.06] p-1 ring-1 ring-white/10">
        {AUDIENCES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={audience === option.id}
            onClick={() => {
              setAudience(option.id);
              setError(null);
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
              audience === option.id ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-400">{AUDIENCES.find((option) => option.id === audience)?.intro}</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {error && <Alert onDark>{error}</Alert>}
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
        <Button type="submit" variant="brand" loading={submitting} className="w-full py-2.5">
          Log in
        </Button>
      </form>

      {audience === 'citizen' && (
        <p className="mt-6 text-center text-sm text-slate-400">
          New to TrafficFlow?{' '}
          <Link to="/register" className="font-medium text-sky-400 hover:text-sky-300">
            Create a citizen account
          </Link>
        </p>
      )}
    </>
  );
}
