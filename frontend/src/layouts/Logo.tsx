export function Logo({ large = false, inverted = false }: { large?: boolean; inverted?: boolean }) {
  const size = large ? 'h-10 w-10' : 'h-8 w-8';
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className={size} aria-hidden="true">
        <rect x="9" y="2" width="14" height="28" rx="5" fill={inverted ? '#334155' : '#1e293b'} />
        <circle cx="16" cy="9" r="3.5" fill="#ef4444" />
        <circle cx="16" cy="16" r="3.5" fill="#f59e0b" />
        <circle cx="16" cy="23" r="3.5" fill="#22c55e" />
      </svg>
      <span className={`font-semibold tracking-tight ${large ? 'text-2xl' : 'text-lg'} ${inverted ? 'text-white' : 'text-slate-900'}`}>
        TrafficFlow
      </span>
    </span>
  );
}
