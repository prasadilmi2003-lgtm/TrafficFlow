import type { ReactNode } from 'react';
import { formatDay } from '../../utils/format';

/**
 * Small, dependency-free charts for the dashboards, built with plain HTML
 * and Tailwind. Colours come from a validated, colour-blind-safe palette:
 * one blue for magnitudes, fixed status colours for severity (always with a
 * text label), and two categorical colours for the two-series chart.
 */
export const CHART_COLORS = {
  magnitude: '#2a78d6',
  reported: '#2a78d6',
  resolved: '#eb6834',
  status: { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' },
};

/** A single headline number. */
export function StatTile({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

export interface BarRow {
  label: string;
  value: number;
  /** Defaults to the magnitude blue */
  color?: string;
}

/** Horizontal bars with the value written next to each bar. */
export function HorizontalBars({ rows, emptyText = 'No data yet' }: { rows: BarRow[]; emptyText?: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label} className="grid grid-cols-[minmax(6rem,9rem)_1fr_2.5rem] items-center gap-3" title={`${row.label}: ${row.value}`}>
          <span className="truncate text-sm text-slate-600">{row.label}</span>
          <span className="h-2.5 rounded-r bg-slate-100">
            <span
              className="block h-full rounded-r transition-[width] duration-500"
              style={{ width: `${(row.value / max) * 100}%`, backgroundColor: row.color ?? CHART_COLORS.magnitude }}
            />
          </span>
          <span className="text-right text-sm font-medium tabular-nums text-slate-900">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Reported vs resolved per day: pairs of columns, with a legend and a value above each column. */
export function DailyColumns({ days }: { days: Array<{ date: string; reported: number; resolved: number }> }) {
  const max = Math.max(1, ...days.flatMap((day) => [day.reported, day.resolved]));
  const series = [
    { key: 'reported' as const, label: 'Reported', color: CHART_COLORS.reported },
    { key: 'resolved' as const, label: 'Resolved', color: CHART_COLORS.resolved },
  ];

  return (
    <div>
      <ul className="mb-4 flex gap-4 text-sm text-slate-600" aria-label="Legend">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-7 gap-2 border-b border-slate-300">
        {days.map((day) => (
          <div key={day.date} className="flex h-40 items-end justify-center gap-0.5">
            {series.map((s) => (
              <div key={s.key} className="flex w-1/3 max-w-5 flex-col items-center justify-end" title={`${formatDay(day.date)}: ${day[s.key]} ${s.label.toLowerCase()}`}>
                <span className="mb-1 text-[11px] tabular-nums text-slate-500">{day[s.key]}</span>
                <span
                  className="w-full rounded-t"
                  style={{ height: `${Math.max((day[s.key] / max) * 120, day[s.key] > 0 ? 2 : 0)}px`, backgroundColor: s.color }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {days.map((day) => (
          <span key={day.date} className="text-center text-[11px] text-slate-500">
            {formatDay(day.date)}
          </span>
        ))}
      </div>
    </div>
  );
}
