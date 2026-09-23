import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../../api/client';
import { incidentsApi } from '../../api/endpoints';
import { SeverityBadge, StatusBadge } from '../../components/ui/Badge';
import { Alert, Card, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { POLL_INTERVAL_MS } from '../../config';
import { useAsync } from '../../hooks/useAsync';
import { OPEN_STATUSES, type IncidentStatus } from '../../types/api';
import { timeAgo } from '../../utils/format';
import { IncidentMap, type MapPoint } from '../incidents/maps';
import { StatusLegend } from '../incidents/StatusLegend';

/** Every open incident on one map, refreshed every 20 seconds. */
export function MapViewPage({ basePath }: { basePath: string }) {
  const incidents = useAsync(() => incidentsApi.map(), [], { pollMs: POLL_INTERVAL_MS });
  const [hidden, setHidden] = useState<Set<IncidentStatus>>(new Set());

  const counts = useMemo(() => {
    const result: Partial<Record<IncidentStatus, number>> = {};
    for (const incident of incidents.data ?? []) result[incident.status] = (result[incident.status] ?? 0) + 1;
    return result;
  }, [incidents.data]);

  const points: MapPoint[] = useMemo(
    () =>
      (incidents.data ?? [])
        .filter((incident) => !hidden.has(incident.status))
        .map((incident) => ({
          id: incident.id,
          latitude: incident.latitude,
          longitude: incident.longitude,
          status: incident.status,
          label: `${incident.referenceNo} · ${incident.type.name}`,
          popup: (
            <div className="space-y-1.5">
              <p className="font-semibold text-slate-900">
                {incident.type.name} · {incident.referenceNo}
              </p>
              <div className="flex gap-1.5">
                <StatusBadge status={incident.status} />
                {incident.severity && <SeverityBadge severity={incident.severity} />}
              </div>
              <p className="text-slate-600">{incident.locationText ?? 'No location description'}</p>
              <p className="text-slate-500">Reported {timeAgo(incident.createdAt)}</p>
              <Link to={`${basePath}/incidents/${incident.id}`} className="font-medium text-blue-600">
                Open incident →
              </Link>
            </div>
          ),
        })),
    [incidents.data, hidden, basePath],
  );

  function toggle(status: IncidentStatus) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  return (
    <>
      <PageHeader title="Live map" description="All open incidents. Click a marker for details; click the legend to show or hide a status." />
      {incidents.error ? (
        <Alert>{errorMessage(incidents.error)}</Alert>
      ) : incidents.loading ? (
        <LoadingBlock />
      ) : (
        <Card>
          <div className="mb-4">
            <StatusLegend statuses={OPEN_STATUSES} counts={counts} hidden={hidden} onToggle={toggle} />
          </div>
          <IncidentMap points={points} height={560} />
        </Card>
      )}
    </>
  );
}
