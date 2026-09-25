import type { Role } from '../../types/api';
import { ROLE_LABELS } from '../../utils/labels';

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800 ring-1 ring-inset ring-blue-600/20">
      {ROLE_LABELS[role]}
    </span>
  );
}
