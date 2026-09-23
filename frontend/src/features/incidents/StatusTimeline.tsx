import type { HistoryEntry } from '../../types/api';
import { formatDateTime } from '../../utils/format';
import { ROLE_LABELS, STATUS_DESCRIPTIONS, STATUS_LABELS, STATUS_MARKER_COLORS } from '../../utils/labels';

/** Every status change of the incident, oldest first: who, when and why. */
export function StatusTimeline({ history }: { history: HistoryEntry[] }) {
  return (
    <ol className="relative space-y-6 border-l-2 border-slate-100 pl-6">
      {history.map((entry) => (
        <li key={entry.id} className="relative">
          <span
            className="absolute -left-[33px] top-1 h-4 w-4 rounded-full ring-4 ring-white"
            style={{ backgroundColor: STATUS_MARKER_COLORS[entry.toStatus] }}
            aria-hidden="true"
          />
          <p className="text-sm font-semibold text-slate-900">{STATUS_LABELS[entry.toStatus]}</p>
          <p className="text-xs text-slate-500">
            {formatDateTime(entry.createdAt)} · {entry.changedBy.fullName} ({ROLE_LABELS[entry.changedBy.role]})
          </p>
          <p className="mt-1 text-sm text-slate-600">{entry.note ?? STATUS_DESCRIPTIONS[entry.toStatus]}</p>
        </li>
      ))}
    </ol>
  );
}
