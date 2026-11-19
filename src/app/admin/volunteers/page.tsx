import Link from "next/link";
import { addVolunteer, setMemberFlag, setMemberStatus } from "@/app/actions/admin";
import { Flash } from "@/components/admin/Flash";
import { AddVolunteerForm } from "@/components/admin/forms";
import { ConfirmButton } from "@/components/admin/ui";
import { requireManager } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Volunteers" };
const SIZE = 50;
const STATUS: Record<string, string> = { active: "Active", pending_email: "Email not confirmed", suspended: "Suspended", removed: "Removed" };
const STYLE: Record<string, string> = { active: "bg-leaf-soft", pending_email: "bg-saffron-soft", suspended: "bg-rose-100 text-kumkum", removed: "bg-neutral-200" };

export default async function Volunteers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireManager();
  const c = s.supabase;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status ?? "active";

  let dq: any = c.from("districts").select("id,name").eq("is_active", true).order("name");
  if (!s.scope.all) dq = dq.in("id", s.scope.manage);
  const { data: districts } = await dq;

  // One page at a time, filtered in the database. Row Level Security limits a representative to their district.
  let q: any = c.from("members").select("*, districts(name)", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1);
  if (!s.isSuper) q = q.eq("member_type", "volunteer");
  else if (sp.type) q = q.eq("member_type", sp.type);
  if (status === "flagged") q = q.eq("flagged", true); else if (status !== "all") q = q.eq("status", status);
  if (sp.district) q = q.eq("district_id", sp.district);
  const term = (sp.q ?? "").trim().replace(/[%,()]/g, "");
  if (term) q = /^VF-/i.test(term) ? q.ilike("membership_id", `${term}%`) : /^\+?\d{6,}$/.test(term) ? q.eq("phone", term) : term.includes("@") ? q.eq("email", term.toLowerCase()) : q.ilike("full_name", `${term}%`);
  const { data, count, error } = await q;
  const rows: any[] = data ?? [];
  const pages = Math.max(1, Math.ceil((count ?? 0) / SIZE));
  const href = (over: Record<string, string>) => `/admin/volunteers?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && !["saved", "error", "page"].includes(k))) as Record<string, string>, ...over })}`;

  return (
    <>
      <h1 className="text-4xl">{s.isSuper ? "Volunteers and members" : "Volunteers"}</h1>
      <p className="mt-2 max-w-[70ch] text-[var(--color-muted)]">
        Volunteers join through the website without approval and receive their ID card automatically.
        {s.isSuper ? " You can see every district." : " You see and manage the volunteers of your own district."} Suspending or removing a member makes their ID card invalid at once.
      </p>
      <div className="mt-6"><Flash params={sp} />{error && <p className="notice notice-err mb-6">{error.message}</p>}</div>

      <form className="grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto]" role="search">
        <div><label className="label" htmlFor="q">Search</label><input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Name starts with, membership ID, mobile or email" className="field" /></div>
        <div><label className="label" htmlFor="district">District</label><select id="district" name="district" defaultValue={sp.district ?? ""} className="field"><option value="">{s.scope.all ? "All districts" : "My districts"}</option>{(districts ?? []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div><label className="label" htmlFor="status">Status</label><select id="status" name="status" defaultValue={status} className="field"><option value="active">Active</option><option value="pending_email">Email not confirmed</option><option value="suspended">Suspended</option><option value="removed">Removed</option><option value="flagged">Flagged</option><option value="all">All</option></select></div>
        <div className="flex items-end"><button className="btn btn-line">Show</button></div>
        {s.isSuper && <div><label className="label" htmlFor="type">Type</label><select id="type" name="type" defaultValue={sp.type ?? ""} className="field"><option value="">Volunteers and representatives</option><option value="volunteer">Volunteers</option><option value="district_representative">District Representatives</option></select></div>}
      </form>

      <p className="mt-6 text-[0.95rem] text-[var(--color-muted)]" role="status">{count ?? 0} member{count === 1 ? "" : "s"} in this list</p>
      {rows.length === 0 && <p className="mt-3 rounded-xl border border-dashed border-neutral-400 px-6 py-10 text-center text-[var(--color-muted)]">Nobody matches this search.</p>}
      <ul className="mt-3 max-w-5xl space-y-3">
        {rows.map((m) => {
          const mine = s.isSuper || m.member_type === "volunteer";
          return (
            <li key={m.id} className="rounded-xl border border-line">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <span><span className="font-semibold">{m.full_name}</span>{m.flagged && <span className="tag ml-2 bg-kumkum text-white">Flagged</span>}
                    <span className="block text-sm text-[var(--color-muted)]">{m.membership_id}, {m.districts?.name ?? "no district"}, joined {formatDate(m.joined_on)}{m.member_type === "district_representative" ? ", District Representative" : ""}</span></span>
                  <span className={`tag ${STYLE[m.status]}`}>{STATUS[m.status]}</span>
                </summary>
                <div className="grid gap-8 border-t border-line px-5 py-5 md:grid-cols-2">
                  <dl className="space-y-2 text-[0.95rem]">
                    {[["Email", m.email], ["Mobile", m.phone], ["Date of birth", m.date_of_birth && formatDate(m.date_of_birth)], ["Gender", m.gender], ["City", m.city], ["Address", m.address], ["Occupation", m.occupation],
                      ["Interest", m.interest], ["Skills", m.skills], ["Availability", m.availability], ["Website account", m.user_id ? "Yes" : "No (added by the team)"], ["WhatsApp updates", m.whatsapp_opt_in ? "Agreed" : "Not agreed"], ["Last note", m.status_note]]
                      .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-sm text-[var(--color-muted)]">{k}</dt><dd>{v}</dd></div>)}
                    <div className="flex flex-wrap gap-4 pt-2">
                      {m.photo_path && <a className="link" href={`/api/files?bucket=private-uploads&path=${encodeURIComponent(m.photo_path)}`} target="_blank">View photograph</a>}
                      {m.status === "active" && <a className="link" href={`/api/id-card?member=${m.id}`} target="_blank">Open ID card</a>}
                    </div>
                  </dl>
                  {mine && (
                    <div className="space-y-4">
                      {m.status !== "removed" && m.status !== "pending_email" && (
                        <form action={setMemberStatus.bind(null, m.id, m.status === "active" ? "suspended" : "active")} className="space-y-2">
                          {m.status === "active" && <input name="note" required placeholder="Reason for suspension" aria-label="Reason for suspension" className="field text-sm" />}
                          {m.status === "active" ? <ConfirmButton message={`Suspend ${m.full_name}? Their ID card stops being valid immediately.`}>Suspend</ConfirmButton> : <button className="btn btn-leaf btn-sm">Reactivate</button>}
                        </form>
                      )}
                      {m.status !== "removed" && (
                        <form action={setMemberStatus.bind(null, m.id, "removed")} className="space-y-2">
                          <input name="note" required placeholder="Reason for removal" aria-label="Reason for removal" className="field text-sm" />
                          <ConfirmButton message={`Remove ${m.full_name} from the foundation? Their ID card becomes invalid. The record stays in the audit trail.`} className="text-sm font-semibold text-kumkum underline">Remove from the foundation</ConfirmButton>
                        </form>
                      )}
                      <form action={setMemberFlag.bind(null, m.id, !m.flagged)}><button className="text-sm underline">{m.flagged ? "Clear the flag" : "Flag for the founder's attention"}</button></form>
                    </div>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
      {pages > 1 && (
        <nav aria-label="Pages" className="mt-8 flex max-w-5xl items-center justify-center gap-4">
          {page > 1 && <Link href={href({ page: String(page - 1) })} className="btn btn-line btn-sm">Previous</Link>}
          <span className="text-[0.95rem]">Page {page} of {pages}</span>
          {page < pages && <Link href={href({ page: String(page + 1) })} className="btn btn-line btn-sm">Next</Link>}
        </nav>
      )}

      <h2 id="add" className="mb-3 mt-14 scroll-mt-6 text-2xl">Add a volunteer</h2>
      <p className="mb-4 max-w-[70ch] text-[var(--color-muted)]">For people who join in person. They get a membership ID straight away. They can create a website account later with the same email address.</p>
      <AddVolunteerForm action={addVolunteer} districts={districts ?? []} />
    </>
  );
}
