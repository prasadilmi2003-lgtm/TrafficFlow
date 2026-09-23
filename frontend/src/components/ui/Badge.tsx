import type { AssignmentStatus, Availability, IncidentStatus, Role, Severity } from '../../types/api';
import {
  ASSIGNMENT_STATUS_LABELS,
  AVAILABILITY_LABELS,
  ROLE_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
} from '../../utils/labels';

function Badge({ className, children }: { className: string; children: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

const STATUS_STYLES: Record<IncidentStatus, string> = {
  REPORTED: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  VERIFIED: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  ASSIGNED: 'bg-violet-50 text-violet-800 ring-violet-600/20',
  RESPONDING: 'bg-orange-50 text-orange-800 ring-orange-600/20',
  RESOLVED: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  REJECTED: 'bg-slate-100 text-slate-700 ring-slate-500/20',
};

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return <Badge className={STATUS_STYLES[status]}>{STATUS_LABELS[status]}</Badge>;
}

const SEVERITY_STYLES: Record<Severity, string> = {
  LOW: 'bg-slate-50 text-slate-700 ring-slate-500/20',
  MEDIUM: 'bg-yellow-50 text-yellow-800 ring-yellow-600/30',
  HIGH: 'bg-orange-50 text-orange-800 ring-orange-600/30',
  CRITICAL: 'bg-red-50 text-red-700 ring-red-600/30',
};

export function SeverityBadge({ severity }: { severity: Severity | null }) {
  if (!severity) return <span className="text-xs text-slate-400">Not set</span>;
  return <Badge className={SEVERITY_STYLES[severity]}>{`${SEVERITY_LABELS[severity]} severity`}</Badge>;
}

const AVAILABILITY_STYLES: Record<Availability, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  BUSY: 'bg-orange-50 text-orange-800 ring-orange-600/20',
  OFF_DUTY: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  return <Badge className={AVAILABILITY_STYLES[availability]}>{AVAILABILITY_LABELS[availability]}</Badge>;
}

const ASSIGNMENT_STYLES: Record<AssignmentStatus, string> = {
  ASSIGNED: 'bg-violet-50 text-violet-800 ring-violet-600/20',
  RESPONDING: 'bg-orange-50 text-orange-800 ring-orange-600/20',
  COMPLETED: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  CANCELLED: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return <Badge className={ASSIGNMENT_STYLES[status]}>{ASSIGNMENT_STATUS_LABELS[status]}</Badge>;
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge className="bg-blue-50 text-blue-800 ring-blue-600/20">{ROLE_LABELS[role]}</Badge>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-600/20">Active</Badge>
  ) : (
    <Badge className="bg-slate-100 text-slate-600 ring-slate-500/20">Deactivated</Badge>
  );
}
