import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { errorMessage } from '../../api/client';
import { incidentsApi, incidentTypesApi } from '../../api/endpoints';
import { SeverityBadge, StatusBadge } from '../../components/ui/Badge';
import { FilterSelect } from '../../components/ui/Field';
import { Alert, EmptyState, PageHeader } from '../../components/ui/Layout';
import { Pagination } from '../../components/ui/Pagination';
import { LoadingBlock } from '../../components/ui/Spinner';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import { INCIDENT_STATUSES, SEVERITIES, type IncidentStatus, type Severity } from '../../types/api';
import { timeAgo } from '../../utils/format';
import { SEVERITY_LABELS, STATUS_LABELS } from '../../utils/labels';

/**
 * All incidents with filters. Used by operators (/operator/incidents) and,
 * read-only, by admins (/admin/incidents). Filters live in the URL, so a
 * filtered view can be bookmarked or shared.
 */
export function IncidentQueuePage({ basePath }: { basePath: string }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const statuses = (params.get('status')?.split(',').filter(Boolean) ?? []) as IncidentStatus[];
  const typeId = params.get('typeId') ?? '';
  const severity = (params.get('severity') ?? '') as Severity | '';
  const search = params.get('search') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;

  const [searchInput, setSearchInput] = useState(search);

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  }

  // Search as the user types, but wait until they pause
  useEffect(() => {
    if (searchInput === search) return undefined;
    const timer = window.setTimeout(() => update({ search: searchInput.trim() }), 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const types = useAsync(() => incidentTypesApi.listActive(), []);
  const incidents = useAsync(
    () =>
      incidentsApi.list({
        page,
        limit: 20,
        status: statuses,
        typeId: typeId || undefined,
        severity: severity || undefined,
        search: search || undefined,
      }),
    [params.toString()],
    { pollMs: POLL_INTERVAL_MS },
  );

  function toggleStatus(status: IncidentStatus) {
    const next = statuses.includes(status) ? statuses.filter((s) => s !== status) : [...statuses, status];
    update({ status: next.join(',') });
  }

  return (
    <>
      <PageHeader title="Incidents" description="Every reported incident, newest first. Click a row to review it." />

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {INCIDENT_STATUSES.map((status) => {
            const active = statuses.includes(status);
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => toggleStatus(status)}
                className={`rounded-full px-3 py-1 text-sm ring-1 ring-inset transition ${
                  active ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'
                }`}
              >
                {STATUS_LABELS[status]}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            aria-label="Search incidents"
            placeholder="Search reference, description or place"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-md border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600 sm:w-80"
          />
          <FilterSelect label="Incident type" value={typeId} onChange={(e) => update({ typeId: e.target.value })}>
            <option value="">All types</option>
            {types.data?.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Severity" value={severity} onChange={(e) => update({ severity: e.target.value })}>
            <option value="">Any severity</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </option>
            ))}
          </FilterSelect>
        </div>
      </div>

      {incidents.error ? (
        <Alert>{errorMessage(incidents.error)}</Alert>
      ) : incidents.loading || !incidents.data ? (
        <LoadingBlock />
      ) : incidents.data.items.length === 0 ? (
        <EmptyState title="No incidents match these filters" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Reference</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Severity</th>
                  <th scope="col" className="px-4 py-3">Location</th>
                  <th scope="col" className="px-4 py-3 text-right">Responders</th>
                  <th scope="col" className="px-4 py-3">Reported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incidents.data.items.map((incident) => (
                  <tr
                    key={incident.id}
                    onClick={() => navigate(`${basePath}/incidents/${incident.id}`)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-blue-700">{incident.referenceNo}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{incident.type.name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={incident.status} />
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={incident.severity} />
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-600">{incident.locationText ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{incident.activeAssignments}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{timeAgo(incident.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={incidents.data.pagination} onPage={(p) => update({ page: String(p) })} />
        </>
      )}
    </>
  );
}
