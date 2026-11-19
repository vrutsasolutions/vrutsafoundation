import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { approveContent } from "@/app/actions/admin";
import { Flash } from "@/components/admin/Flash";
import { requireStaff } from "@/lib/auth";
import { canAccess, RESOURCES } from "@/lib/resources";

type Props = { params: Promise<{ resource: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function ResourceList({ params, searchParams }: Props) {
  const [{ resource }, sp] = await Promise.all([params, searchParams]);
  const r = RESOURCES[resource];
  if (!r) notFound();
  const s = await requireStaff();
  if (!canAccess(r, s)) redirect("/admin");

  let q: any = s.supabase.from(r.table).select(r.select).order(r.orderBy[0], { ascending: r.orderBy[1] }).limit(300);
  if (r.districtScoped && !s.scope.all) q = q.in("district_id", s.scope.contribute);
  if (r.publishable && sp.status) q = q.eq("publish_status", sp.status);
  const { data, error } = await q;
  const rows: any[] = data ?? [];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl">{r.title}</h1>
          <p className="mt-2 max-w-[70ch] text-[var(--color-muted)]">{r.intro}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {r.key === "slides" && <Link href="/admin/slider-preview" className="btn btn-line">Preview carousel</Link>}
          {!(r.key === "slides" && rows.length >= 4) && <Link href={`/admin/manage/${r.key}/new`} className="btn btn-leaf">Add {r.singular}</Link>}
        </div>
      </div>
      <div className="mt-6"><Flash params={sp} />{error && <p className="notice notice-err mb-6">{error.message}</p>}</div>
      {r.publishable && (
        <p className="mb-4 flex gap-4 text-sm">
          {[["", "All"], ["pending", "Waiting for approval"], ["draft", "Drafts"], ["published", "Published"]].map(([v, l]) => (
            <Link key={v} href={`/admin/manage/${r.key}${v ? `?status=${v}` : ""}`} className={(sp.status ?? "") === v ? "font-semibold underline decoration-saffron decoration-[3px] underline-offset-4" : "underline"}>{l}</Link>
          ))}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-400 px-6 py-10 text-center text-[var(--color-muted)]">Nothing here yet. Use “Add {r.singular}” to create the first one.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr>{r.columns.map((c) => <th key={c.label} scope="col">{c.label}</th>)}<th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {r.columns.map((c, i) => <td key={c.label} className={i === 0 ? "font-medium" : ""}>{c.render(row)}</td>)}
                  <td className="whitespace-nowrap text-right">
                    <span className="inline-flex items-center gap-3">
                      {r.publishable && row.publish_status === "pending" && s.isSuper && (
                        <form action={approveContent.bind(null, r.key, row.id)}><button className="btn btn-saffron btn-sm">Approve and publish</button></form>
                      )}
                      <Link href={`/admin/manage/${r.key}/${row.id}`} className="link">Edit</Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}