/* The connected-nodes motif from the Vrutsa logo, redrawn as a living network.
   Deterministic, so server and browser render the same picture. */
function build(seed: number, count: number, w: number, h: number) {
  let t = seed;
  const rnd = () => { t = (t * 1664525 + 1013904223) % 4294967296; return t / 4294967296; };
  const pts: { x: number; y: number; r: number; green: boolean }[] = [];
  let guard = 0;
  while (pts.length < count && guard++ < 4000) {
    const x = 20 + rnd() * (w - 40), y = 20 + rnd() * (h - 40);
    if (pts.every((p) => Math.hypot(p.x - x, p.y - y) > Math.min(w, h) / 7.5))
      pts.push({ x, y, r: 3 + rnd() * 4, green: rnd() > 0.78 });
  }
  const lines: [number, number][] = [];
  pts.forEach((p, i) => {
    pts.map((q, j) => ({ j, d: Math.hypot(p.x - q.x, p.y - q.y) })).filter((o) => o.j !== i).sort((a, b) => a.d - b.d).slice(0, 3)
      .forEach(({ j }) => { if (!lines.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) lines.push([i, j]); });
  });
  return { pts, lines };
}

export function Mesh({ className, seed = 7, count = 26 }: { className?: string; seed?: number; count?: number }) {
  const w = 520, h = 520;
  const { pts, lines } = build(seed, count, w, h);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true" focusable="false">
      {lines.map(([a, b], i) => (
        <line key={i} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} pathLength={1}
          className="mesh-line" style={{ animationDelay: `${0.15 + i * 0.018}s` }} stroke="#f0a500" strokeWidth={1.6} />
      ))}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.green ? "#0f5a1f" : "#f0a500"} />
      ))}
    </svg>
  );
}

/** The thin band under the wordmark in the logo, used as the one decorative divider. */
export function MeshStrip({ className }: { className?: string }) {
  const n = 60, w = 1200, h = 14;
  const top = Array.from({ length: n }, (_, i) => (i * w) / (n - 1));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden="true" focusable="false">
      <path d={top.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)} ${i % 2 ? h - 2 : 2}`).join(" ")} fill="none" stroke="#f0a500" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      <path d={`M0 2 H${w} M0 ${h - 2} H${w}`} stroke="#f0a500" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
