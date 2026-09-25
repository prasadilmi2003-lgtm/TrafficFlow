function numberOr(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(parsed) ? parsed : fallback;
}

/** Where maps open by default (Colombo unless configured in .env). */
export const MAP_DEFAULTS = {
  center: [
    numberOr(import.meta.env.VITE_MAP_DEFAULT_LAT, 6.9271),
    numberOr(import.meta.env.VITE_MAP_DEFAULT_LNG, 79.8612),
  ] as [number, number],
  zoom: numberOr(import.meta.env.VITE_MAP_DEFAULT_ZOOM, 12),
};

/** How often live pages (dashboard, queues, assignments) refresh. */
export const POLL_INTERVAL_MS = 20_000;

/** Must match MAX_UPLOAD_SIZE_MB on the backend. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
