import type { HistoryEntry } from '../../types/api';
import { formatDateTime } from '../../utils/format';
import { ROLE_LABELS, STATUS_DESCRIPTIONS, STATUS_LABELS, STATUS_MARKER_COLORS } from '../../utils/labels';

/** A note keeps the status unchanged; a status change moves it on. */
function isNote(entry: HistoryEntry): boolean {
  return entry.fromStatus === entry.toStatus;
}

/** Every status change and note of the incident, oldest first: who, when and why. */
export function StatusTimeline({ history }: { history: HistoryEntry[] }) {
  return (
    <ol className="relative space-y-6 border-l-2 border-slate-100 pl-6">
      {history.map((entry) => (
        <li key={entry.id} className="relative">
          <span
            className={`absolute top-1 rounded-full ring-4 ring-white ${isNote(entry) ? '-left-[31px] h-3 w-3 bg-slate-300' : '-left-[33px] h-4 w-4'}`}
            style={isNote(entry) ? undefined : { backgroundColor: STATUS_MARKER_COLORS[entry.toStatus] }}
            aria-hidden="true"
          />
          <p className="text-sm font-semibold text-slate-900">{isNote(entry) ? 'Note' : STATUS_LABELS[entry.toStatus]}</p>
          <p className="text-xs text-slate-500">
            {formatDateTime(entry.createdAt)} · {entry.changedBy.fullName} ({ROLE_LABELS[entry.changedBy.role]})
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{entry.note ?? STATUS_DESCRIPTIONS[entry.toStatus]}</p>
        </li>
      ))}
    </ol>
  );
}
