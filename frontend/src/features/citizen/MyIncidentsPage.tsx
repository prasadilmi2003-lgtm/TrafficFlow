import { useState } from 'react';
import { errorMessage } from '../../api/client';
import { incidentsApi } from '../../api/endpoints';
import { ButtonLink } from '../../components/ui/Button';
import { Alert, EmptyState, PageHeader } from '../../components/ui/Layout';
import { Pagination } from '../../components/ui/Pagination';
import { LoadingBlock } from '../../components/ui/Spinner';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import { OPEN_STATUSES, type IncidentStatus } from '../../types/api';
import { IncidentCard } from '../incidents/IncidentCard';

const TABS: Array<{ key: string; label: string; statuses?: IncidentStatus[] }> = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'In progress', statuses: OPEN_STATUSES },
  { key: 'closed', label: 'Closed', statuses: ['RESOLVED', 'REJECTED'] },
];

export function MyIncidentsPage() {
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const statuses = TABS.find((t) => t.key === tab)?.statuses;

  const { data, error, loading } = useAsync(
    () => incidentsApi.listMine({ page, limit: 10, status: statuses }),
    [page, tab],
    { pollMs: POLL_INTERVAL_MS },
  );

  return (
    <>
      <PageHeader
        title="My reports"
        description="Incidents you have reported and how the response is going. This page updates automatically."
        actions={<ButtonLink to="/citizen/report">Report an incident</ButtonLink>}
      />

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 sm:inline-flex" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <Alert>{errorMessage(error)}</Alert>
      ) : loading || !data ? (
        <LoadingBlock />
      ) : data.items.length === 0 ? (
        <EmptyState
          title={tab === 'all' ? "You haven't reported any incidents yet" : 'Nothing here'}
          description="Seen an accident, a blocked road or a hazard? Report it and follow the response here."
          action={<ButtonLink to="/citizen/report">Report an incident</ButtonLink>}
        />
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} to={`/citizen/incidents/${incident.id}`} />
            ))}
          </div>
          <Pagination pagination={data.pagination} onPage={setPage} />
        </>
      )}
    </>
  );
}
