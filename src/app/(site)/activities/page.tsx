import Link from "next/link";
import { ActivityCard, Empty, PageHeader } from "@/components/cards";
import { activityYears, getCategories, getDistricts, pageActivities } from "@/lib/data";

export const metadata = { title: "Our activities", description: "A record of the work Vrutsa Foundation has carried out, by category, district, year and month." };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SIZE = 12;

export default async function Activities({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const f = await searchParams;
  const page = Math.max(1, Number(f.page) || 1);
  const [{ rows, total }, categories, districts, years] = await Promise.all([pageActivities(f, page, SIZE), getCategories(), getDistricts(), activityYears()]);
  const filtered = Boolean(f.category || f.district || f.year || f.month);
  const pages = Math.max(1, Math.ceil(total / SIZE));
  const href = (p: number) => `/activities?${new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([k, v]) => v && k !== "page")) as Record<string, string>, ...(p > 1 ? { page: String(p) } : {}) })}`;
  return (
    <>
      <PageHeader title="Our activities" intro="A record of the work the foundation has carried out, newest first. Filter by category, district, year and month.">
        <form className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_140px_170px_auto]" role="search" aria-label="Filter activities">
          <div><label className="label" htmlFor="category">Category</label>
            <select id="category" name="category" defaultValue={f.category ?? ""} className="field"><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="label" htmlFor="district">District</label>
            <select id="district" name="district" defaultValue={f.district ?? ""} className="field"><option value="">All districts</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div><label className="label" htmlFor="year">Year</label>
            <select id="year" name="year" defaultValue={f.year ?? ""} className="field"><option value="">All years</option>{[...new Set([String(new Date().getFullYear()), ...years])].sort().reverse().map((y) => <option key={y}>{y}</option>)}</select></div>
          <div><label className="label" htmlFor="month">Month</label>
            <select id="month" name="month" defaultValue={f.month ?? ""} className="field"><option value="">All months</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
          <div className="flex items-end gap-3"><button className="btn btn-leaf">Show</button>{filtered && <Link href="/activities" className="link pb-3">Clear</Link>}</div>
        </form>
      </PageHeader>
      <section className="section">
        <div className="wrap">
          {total > 0 && <p className="mb-8 text-[0.95rem] text-[var(--color-muted)]" role="status">{total} activit{total === 1 ? "y" : "ies"}{filtered ? " match your filters" : ""}</p>}
          {rows.length ? <div className="grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">{rows.map((a) => <ActivityCard key={a.id} a={a} />)}</div>
            : <Empty>{filtered ? "No activities match these filters. Try clearing one of them." : "Activities will be published here as the foundation records its work."}</Empty>}
          {pages > 1 && (
            <nav aria-label="Pages" className="mt-14 flex items-center justify-center gap-4">
              {page > 1 ? <Link href={href(page - 1)} className="btn btn-line btn-sm">Newer</Link> : <span className="btn btn-line btn-sm opacity-30" aria-hidden="true">Newer</span>}
              <span className="text-[0.95rem]">Page {page} of {pages}</span>
              {page < pages ? <Link href={href(page + 1)} className="btn btn-line btn-sm">Older</Link> : <span className="btn btn-line btn-sm opacity-30" aria-hidden="true">Older</span>}
            </nav>
          )}
        </div>
      </section>
    </>
  );
}
