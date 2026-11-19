import { formatINR } from "@/lib/utils";
import type { DonationStats } from "@/lib/data";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const periodLabel = (p: string) => (p.length === 7 ? `${MONTHS[Number(p.slice(5)) - 1]} ${p.slice(0, 4)}` : p);
const num = (n: number) => new Intl.NumberFormat("en-IN").format(n);

/** Single-series bar chart in plain HTML: one hue, value on hover and for screen readers, table-like structure. */
export function BarChart({ title, data, format = num }: { title: string; data: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 0);
  return (
    <figure className="rounded-xl border border-line p-5">
      <figcaption className="font-semibold">{title}</figcaption>
      {max === 0 ? <p className="mt-6 pb-4 text-sm text-[var(--color-muted)]">Nothing recorded in this period yet.</p> : (
        <ol className="mt-5 flex h-44 items-end gap-[2px] border-b border-neutral-300" aria-label={title}>
          {data.map((d) => (
            <li key={d.label} className="group relative flex h-full flex-1 items-end justify-center" tabIndex={0} aria-label={`${d.label}: ${format(d.value)}`}>
              <span className="pointer-events-none absolute -top-1 z-10 hidden -translate-y-full whitespace-nowrap rounded-md bg-black px-2.5 py-1.5 text-xs text-white group-hover:block group-focus:block">
                {d.label}<br /><strong>{format(d.value)}</strong>
              </span>
              <span className="w-[62%] max-w-10 rounded-t-[4px] bg-leaf transition-colors group-hover:bg-leaf-deep" style={{ height: `${d.value ? Math.max((d.value / max) * 100, 2) : 0}%` }} />
            </li>
          ))}
        </ol>
      )}
      {max > 0 && <div className="mt-1.5 flex gap-[2px] text-center text-xs text-[var(--color-muted)]">{data.map((d) => <span key={d.label} className="flex-1 truncate">{d.label.slice(0, 3)}</span>)}</div>}
    </figure>
  );
}

/** Donation report for the founder (admin panel only): verified totals. Zero is shown as zero. */
export function DonationTransparency({ stats }: { stats: DonationStats | null }) {
  if (!stats) return <p className="notice notice-info max-w-2xl">Donation figures appear here once the website is connected to its database.</p>;
  const now = new Date();
  const tiles = [
    [`Verified donors in ${MONTHS[now.getMonth()]}`, num(stats.month.donors)], [`Collected in ${MONTHS[now.getMonth()]}`, formatINR(stats.month.amount)],
    [`Verified donors in ${now.getFullYear()}`, num(stats.year.donors)], [`Collected in ${now.getFullYear()}`, formatINR(stats.year.amount)],
  ];
  return (
    <div>
      <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([k, v]) => (
          <div key={k} className="bg-white p-6">
            <dd className="font-[family-name:var(--font-display)] text-4xl font-semibold">{v}</dd>
            <dt className="mt-1 text-[0.95rem] text-[var(--color-muted)]">{k}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[0.95rem]">
        Total verified since the foundation began recording here: <strong>{formatINR(stats.total.amount)}</strong> from <strong>{num(stats.total.donors)}</strong> donor{stats.total.donors === 1 ? "" : "s"}.
        {stats.updated_at && <> Last updated {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(stats.updated_at))}.</>}
      </p>
      {stats.monthly.length > 0 && (
        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          {[["Month by month", stats.monthly], ["Year by year", stats.yearly]].map(([title, list]) => (
            <div key={title as string} className="overflow-x-auto">
              <table className="table">
                <caption className="mb-2 text-left font-[family-name:var(--font-display)] text-xl font-semibold">{title as string}</caption>
                <thead><tr><th scope="col">Period</th><th scope="col" className="text-right">Donors</th><th scope="col" className="text-right">Verified amount</th></tr></thead>
                <tbody>{(list as DonationStats["monthly"]).map((r) => <tr key={r.period}><td>{periodLabel(r.period)}</td><td className="text-right tabular-nums">{num(r.donors)}</td><td className="text-right tabular-nums">{formatINR(r.amount)}</td></tr>)}</tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      <p className="mt-6 max-w-[70ch] text-sm text-[var(--color-muted)]">
        These figures include only donations confirmed in the foundation's bank account. Submitted forms and screenshots are not counted until verified.
      </p>
    </div>
  );
}