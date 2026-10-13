/** Deterministic pseudo-random numbers, so the skyline is identical on every render. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const SKYLINE = (() => {
  const random = seeded(7);
  const buildings: Array<{ x: number; width: number; height: number }> = [];
  for (let x = 0; x < 1000; ) {
    const width = 26 + random() * 38;
    // Taller towards the middle of the picture, like a city centre
    const centre = 1 - Math.abs(x - 560) / 560;
    const height = 50 + random() * 90 + Math.max(centre, 0) * 120;
    buildings.push({ x, width, height });
    x += width + random() * 4;
  }
  return buildings;
})();

/**
 * The night-city picture behind the landing page hero, drawn with SVG and
 * gradients: dusk sky, skyline, a tower, and light trails on an elevated road.
 * Purely decorative.
 */
export function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Dusk sky with a glow on the horizon */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 40% at 72% 58%, rgba(251,146,60,0.30), transparent 70%),' +
            'radial-gradient(ellipse 60% 50% at 80% 30%, rgba(99,102,241,0.28), transparent 70%),' +
            'linear-gradient(180deg, #070d22 0%, #121a3f 45%, #1a1a3d 62%, #070d1d 100%)',
        }}
      />

      {/* Skyline */}
      <svg
        className="absolute bottom-[18%] right-0 h-[58%] w-full min-w-[900px] lg:w-[78%]"
        viewBox="0 0 1000 300"
        preserveAspectRatio="xMaxYMax slice"
      >
        <defs>
          <pattern id="lit-windows" width="9" height="12" patternUnits="userSpaceOnUse">
            <rect x="2" y="3" width="2.4" height="3.4" fill="#ffd9a0" opacity="0.55" />
            <rect x="6" y="8" width="2.4" height="3.4" fill="#9fd0ff" opacity="0.4" />
          </pattern>
          <linearGradient id="tower" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#8aa4ff" />
            <stop offset="1" stopColor="#1b2350" />
          </linearGradient>
        </defs>
        {SKYLINE.map((b) => (
          <g key={b.x}>
            <rect x={b.x} y={300 - b.height} width={b.width} height={b.height} fill="#0b1230" opacity="0.92" />
            <rect x={b.x} y={300 - b.height} width={b.width} height={b.height} fill="url(#lit-windows)" opacity="0.8" />
          </g>
        ))}
        {/* Tower with an observation pod */}
        <path d="M575 300 L590 90 L596 90 L611 300 Z" fill="url(#tower)" />
        <ellipse cx="593" cy="104" rx="15" ry="9" fill="#a5b8ff" />
        <ellipse cx="593" cy="104" rx="15" ry="9" fill="none" stroke="#fff" strokeOpacity="0.5" />
        <path d="M593 95 L593 18" stroke="#dbe4ff" strokeWidth="1.6" />
        <circle cx="593" cy="18" r="2.4" fill="#ff5a5a" />
      </svg>

      {/* Light trails on the road */}
      <svg
        className="absolute bottom-0 right-0 h-[48%] w-full lg:w-[85%]"
        viewBox="0 0 1000 400"
        preserveAspectRatio="xMaxYMax slice"
      >
        <defs>
          <linearGradient id="trail-warm" x1="0" x2="1">
            <stop offset="0" stopColor="#f97316" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fb923c" stopOpacity="0.95" />
            <stop offset="1" stopColor="#fde68a" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="trail-cool" x1="0" x2="1">
            <stop offset="0" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="0.6" stopColor="#60a5fa" stopOpacity="0.9" />
            <stop offset="1" stopColor="#e0f2fe" stopOpacity="0.8" />
          </linearGradient>
          <filter id="trail-blur" x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>
        <path d="M-40 330 C 220 300, 430 250, 640 215 S 900 150, 1040 70" stroke="#0b1226" strokeWidth="46" fill="none" />
        <g fill="none" strokeLinecap="round" filter="url(#trail-blur)">
          <path d="M-40 318 C 220 290, 430 240, 640 205 S 900 140, 1040 62" stroke="url(#trail-warm)" strokeWidth="5" />
          <path d="M-40 332 C 220 304, 430 254, 640 219 S 900 154, 1040 76" stroke="url(#trail-warm)" strokeWidth="3" />
          <path d="M-40 346 C 220 318, 430 268, 640 233 S 900 168, 1040 90" stroke="url(#trail-cool)" strokeWidth="4" />
          <path d="M-40 392 C 260 340, 520 330, 760 280 S 960 220, 1040 190" stroke="url(#trail-warm)" strokeWidth="6" />
          <path d="M-40 376 C 260 324, 520 314, 760 264 S 960 204, 1040 174" stroke="url(#trail-cool)" strokeWidth="3" />
        </g>
      </svg>

      {/* Keeps the headline readable: darkens the left, the top and the bottom */}
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/75 to-transparent lg:via-ink-950/55" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink-950/90 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950 to-transparent" />
    </div>
  );
}
