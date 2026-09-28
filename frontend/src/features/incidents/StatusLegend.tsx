import type { IncidentStatus } from '../../types/api';
import { STATUS_LABELS, STATUS_MARKER_COLORS } from '../../utils/labels';

/** Legend for map marker colours; clicking an entry shows or hides that status. */
export function StatusLegend({
  statuses,
  counts,
  hidden,
  onToggle,
}: {
  statuses: IncidentStatus[];
  counts: Partial<Record<IncidentStatus, number>>;
  hidden: Set<IncidentStatus>;
  onToggle: (status: IncidentStatus) => void;
}) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Map legend">
      {statuses.map((status) => {
        const off = hidden.has(status);
        return (
          <li key={status}>
            <button
              type="button"
              onClick={() => onToggle(status)}
              aria-pressed={!off}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ring-1 ring-inset transition ${
                off ? 'bg-white text-slate-400 ring-slate-200' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
              }`}
            >
              <span
                className="h-3 w-3 rounded-full ring-2 ring-white"
                style={{ backgroundColor: off ? '#cbd5e1' : STATUS_MARKER_COLORS[status] }}
                aria-hidden="true"
              />
              {STATUS_LABELS[status]}
              <span className="tabular-nums text-slate-500">{counts[status] ?? 0}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
