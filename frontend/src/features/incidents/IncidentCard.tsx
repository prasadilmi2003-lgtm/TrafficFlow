import { Link } from 'react-router';
import { SeverityBadge, StatusBadge } from '../../components/ui/Badge';
import type { IncidentSummary } from '../../types/api';
import { timeAgo } from '../../utils/format';

/** One incident in a list of cards (citizen's reports). */
export function IncidentCard({ incident, to }: { incident: IncidentSummary; to: string }) {
  return (
    <Link
      to={to}
      className="block rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:ring-blue-300 focus-visible:outline-2 focus-visible:outline-blue-600"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">
          {incident.type.name} <span className="font-normal text-slate-500">· {incident.referenceNo}</span>
        </p>
        <div className="flex items-center gap-2">
          {incident.severity && <SeverityBadge severity={incident.severity} />}
          <StatusBadge status={incident.status} />
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{incident.description}</p>
      <p className="mt-2 text-xs text-slate-500">
        {incident.locationText ?? 'Location on map'} · reported {timeAgo(incident.createdAt)}
      </p>
    </Link>
  );
}
