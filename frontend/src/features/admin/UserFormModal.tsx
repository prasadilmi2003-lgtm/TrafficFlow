import { useEffect, useState } from 'react';
import { errorMessage, fieldErrors } from '../../api/client';
import { usersApi, type UpdateUserInput } from '../../api/endpoints';
import { Button } from '../../components/ui/Button';
import { SelectInput, TextInput } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { RESPONDER_TYPES, ROLES, type ResponderType, type Role, type User } from '../../types/api';
import { RESPONDER_TYPE_LABELS, ROLE_LABELS } from '../../utils/labels';

const EMPTY = { fullName: '', email: '', phone: '', password: '', role: 'OPERATOR' as Role, responderType: 'POLICE' as ResponderType, unitCode: '' };

/** Create a user (any role), or edit one when `user` is given. */
export function UserFormModal({
  open,
  user,
  currentUserId,
  onClose,
  onSaved,
}: {
  open: boolean;
  user: User | null;
  currentUserId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = user !== null;
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setError(null);
    setForm(
      user
        ? { ...EMPTY, fullName: user.fullName, email: user.email, phone: user.phone ?? '', role: user.role }
        : EMPTY,
    );
  }, [open, user]);

  const set = (field: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [field]: value }));

  // Accounts can't switch to or from the responder role (they need a profile)
  const roleOptions = editing
    ? user.role === 'RESPONDER'
      ? (['RESPONDER'] as Role[])
      : ROLES.filter((role) => role !== 'RESPONDER')
    : ROLES;

  async function save() {
    setSaving(true);
    setErrors({});
    setError(null);
    try {
      if (editing) {
        const changes: UpdateUserInput = { fullName: form.fullName, phone: form.phone || null };
        if (form.role !== user.role) changes.role = form.role;
        if (form.password) changes.password = form.password;
        await usersApi.update(user.id, changes);
      } else {
        await usersApi.create({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone || undefined,
          password: form.password,
          role: form.role,
          responderProfile: form.role === 'RESPONDER' ? { responderType: form.responderType, unitCode: form.unitCode } : undefined,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={editing ? `Edit ${user.fullName}` : 'Add a user'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            {editing ? 'Save changes' : 'Create user'}
          </Button>
        </>
      }
    >
      {error && <Alert>{error}</Alert>}
      <TextInput label="Full name" value={form.fullName} onChange={(e) => set('fullName')(e.target.value)} error={errors.fullName} />
      <TextInput
        label="Email"
        type="email"
        value={form.email}
        disabled={editing}
        hint={editing ? 'Email addresses cannot be changed' : undefined}
        onChange={(e) => set('email')(e.target.value)}
        error={errors.email}
      />
      <TextInput label="Phone" type="tel" optional value={form.phone} onChange={(e) => set('phone')(e.target.value)} error={errors.phone} />
      <SelectInput
        label="Role"
        value={form.role}
        disabled={editing && (user.role === 'RESPONDER' || user.id === currentUserId)}
        onChange={(e) => set('role')(e.target.value)}
        error={errors.role}
      >
        {roleOptions.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </SelectInput>
      {!editing && form.role === 'RESPONDER' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectInput label="Responder type" value={form.responderType} onChange={(e) => set('responderType')(e.target.value)}>
            {RESPONDER_TYPES.map((type) => (
              <option key={type} value={type}>
                {RESPONDER_TYPE_LABELS[type]}
              </option>
            ))}
          </SelectInput>
          <TextInput
            label="Unit code"
            placeholder="e.g. AMB-07"
            value={form.unitCode}
            onChange={(e) => set('unitCode')(e.target.value)}
            error={errors['responderProfile.unitCode'] ?? errors.responderProfile}
          />
        </div>
      )}
      <TextInput
        label={editing ? 'New password' : 'Password'}
        type="password"
        autoComplete="new-password"
        optional={editing}
        hint={editing ? 'Leave empty to keep the current password' : 'At least 8 characters, with letters and numbers'}
        value={form.password}
        onChange={(e) => set('password')(e.target.value)}
        error={errors.password}
      />
    </Modal>
  );
}
