import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../api/client';
import { protectedApi } from '../../api/endpoints';
import { RoleBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Alert, Card, Detail, PageHeader } from '../../components/ui/Layout';
import { Spinner } from '../../components/ui/Spinner';
import type { ProtectedTestResponse } from '../../types/api';
import { formatDateTime } from '../../utils/format';
import { useCurrentUser } from '../auth/useAuth';

/**
 * Shows that authentication works end to end:
 * - "Your account" comes from GET /api/v1/auth/me (loaded by AuthProvider).
 * - "Protected route" calls GET /api/v1/protected-test, which the backend
 *   only answers for a valid session.
 */
export function DashboardPage() {
  const user = useCurrentUser();
  const [result, setResult] = useState<ProtectedTestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const callProtectedRoute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await protectedApi.test());
    } catch (err) {
      setResult(null);
      setError(errorMessage(err, 'The protected route could not be reached.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void callProtectedRoute();
  }, [callProtectedRoute]);

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.fullName.split(' ')[0]}`}
        description="You are logged in. This page is only available with a valid session."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Your account (GET /api/v1/auth/me)">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Full name">{user.fullName}</Detail>
            <Detail label="Email">{user.email}</Detail>
            <Detail label="Phone">{user.phone ?? '—'}</Detail>
            <Detail label="Role">
              <RoleBadge role={user.role} />
            </Detail>
            <Detail label="Account created">{formatDateTime(user.createdAt)}</Detail>
            <Detail label="Last login">{formatDateTime(user.lastLoginAt)}</Detail>
          </dl>
        </Card>

        <Card
          title="Protected route (GET /api/v1/protected-test)"
          actions={
            <Button size="sm" variant="secondary" onClick={() => void callProtectedRoute()} disabled={loading}>
              Call again
            </Button>
          }
        >
          {loading ? (
            <Spinner label="Calling the protected route…" />
          ) : error ? (
            <Alert>{error}</Alert>
          ) : result ? (
            <div className="space-y-3">
              <Alert tone="success" title="Access granted">
                {result.message}
              </Alert>
              <p className="text-sm text-slate-600">
                The server checked your session cookie, verified the JWT and loaded your account from PostgreSQL at{' '}
                {formatDateTime(result.accessedAt)}.
              </p>
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}
