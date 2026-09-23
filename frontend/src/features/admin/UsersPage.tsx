import { useEffect, useState } from 'react';
import { errorMessage } from '../../api/client';
import { usersApi } from '../../api/endpoints';
import { ActiveBadge, RoleBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { FilterSelect } from '../../components/ui/Field';
import { Alert, EmptyState, PageHeader } from '../../components/ui/Layout';
import { Pagination } from '../../components/ui/Pagination';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useAsync } from '../../hooks/useAsync';
import { ROLES, type Role, type User } from '../../types/api';
import { timeAgo } from '../../utils/format';
import { ROLE_LABELS } from '../../utils/labels';
import { useCurrentUser } from '../auth/useAuth';
import { UserFormModal } from './UserFormModal';

export function UsersPage() {
  const me = useCurrentUser();
  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<User | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const users = useAsync(
    () =>
      usersApi.list({
        page,
        limit: 20,
        role: role || undefined,
        isActive: status === '' ? undefined : status === 'active',
        search: search || undefined,
      }),
    [page, role, status, search],
  );

  async function toggleActive(user: User) {
    setError(null);
    try {
      await usersApi.update(user.id, { isActive: !user.isActive });
      await users.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Create accounts for operators, responders and admins. Citizens register themselves."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add user
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          aria-label="Search users"
          placeholder="Search name, email or unit code"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full rounded-md border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600 sm:w-72"
        />
        <FilterSelect label="Role" value={role} onChange={(e) => { setRole(e.target.value as Role | ''); setPage(1); }}>
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Status" value={status} onChange={(e) => { setStatus(e.target.value as '' | 'active' | 'inactive'); setPage(1); }}>
          <option value="">Active and deactivated</option>
          <option value="active">Active only</option>
          <option value="inactive">Deactivated only</option>
        </FilterSelect>
      </div>

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {users.error ? (
        <Alert>{errorMessage(users.error)}</Alert>
      ) : users.loading || !users.data ? (
        <LoadingBlock />
      ) : users.data.items.length === 0 ? (
        <EmptyState title="No users match these filters" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Role</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Last login</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.data.items.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">
                        {user.fullName}
                        {user.id === me.id && <span className="ml-1 text-xs font-normal text-slate-400">(you)</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {user.email}
                        {user.responderProfile && ` · ${user.responderProfile.unitCode}`}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-4 py-3">
                      <ActiveBadge active={user.isActive} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{user.lastLoginAt ? timeAgo(user.lastLoginAt) : 'Never'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(user);
                          setFormOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      {user.id !== me.id && (
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(user)}>
                          {user.isActive ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={users.data.pagination} onPage={setPage} />
        </>
      )}

      <UserFormModal
        open={formOpen}
        user={editing}
        currentUserId={me.id}
        onClose={() => setFormOpen(false)}
        onSaved={() => void users.reload()}
      />
    </>
  );
}
