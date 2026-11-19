import Link from "next/link";
import { approveRepApplication, reviewRepApplication } from "@/app/actions/admin";
import { Flash } from "@/components/admin/Flash";
import { ConfirmButton } from "@/components/admin/ui";
import { requireSuper } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Representative applications" };
const LABEL: Record<string, string> = { submitted: "Submitted", under_review: "Under review", approved: "Approved", rejected: "Rejected", suspended: "Suspended" };
const EMP: Record<string, string> = { salaried: "Salaried employee", self_employed: "Self-employed", business_owner: "Business owner", student: "Student", other: "Other" };
const age = (dob: string) => Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86_400_000));

export default async function Applications({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSuper();
  const status = sp.status ?? "open";
  let q = s.supabase.from("representative_applications").select("*, districts(name), states(name)").order("created_at", { ascending: false }).limit(100);
  q = status === "open" ? q.in("status", ["submitted", "under_review"]) : q.eq("status", status);
  const { data, error } = await q;
  const file = (path: string) => `/api/files?bucket=private-uploads&path=${encodeURIComponent(path)}`;
  return (
    <>
      <h1 className="text-4xl">District Representative applications</h1>
      <p className="mt-2 max-w-[70ch] text-[var(--color-muted)]">Only you can see these. Approving creates the representative&apos;s login, publishes their profile on the district page, gives them their district dashboard and emails their ID card.</p>
      <p className="mt-5 flex flex-wrap gap-4 text-sm">
        {[["open", "To review"], ["approved", "Approved"], ["rejected", "Rejected"]].map(([v, l]) => (
          <Link key={v} href={`/admin/applications?status=${v}`} className={status === v ? "font-semibold underline decoration-saffron decoration-[3px] underline-offset-4" : "underline"}>{l}</Link>
        ))}
      </p>
      <div className="mt-6"><Flash params={sp} />{error && <p className="notice notice-err mb-6">{error.message}</p>}</div>
      {(data ?? []).length === 0 && <p className="rounded-xl border border-dashed border-neutral-400 px-6 py-10 text-center text-[var(--color-muted)]">No applications in this list.</p>}
      <ul className="max-w-5xl space-y-4">
        {(data ?? []).map((a: any) => (
          <li key={a.id} className="rounded-xl border border-line">
            <details open={(data ?? []).length === 1}>
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-4">
                <span><span className="font-semibold">{a.full_name}</span><span className="block text-sm text-[var(--color-muted)]">{a.districts?.name}, {a.reference}, applied {formatDate(a.created_at)}</span></span>
                <span className="tag bg-saffron-soft">{LABEL[a.status]}</span>
              </summary>
              <div className="grid gap-8 border-t border-line px-5 py-5 lg:grid-cols-[1.4fr_1fr]">
                <div className="space-y-6">
                  <dl className="grid gap-x-6 gap-y-2 text-[0.95rem] sm:grid-cols-2">
                    {[["Email", a.email], ["Mobile", a.phone], ["Date of birth", `${formatDate(a.date_of_birth)} (age ${age(a.date_of_birth)})`], ["City", a.city], ["Address", a.address],
                      ["Employment", EMP[a.employment_type]], ["Organisation", a.organisation], ["Designation", a.designation], ["Business", a.business_name], ["Business type", a.business_type],
                      ["Profession", a.profession], ["Institution", a.institution], ["Course", a.course], ["Annual income or turnover", a.annual_income]]
                      .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-sm text-[var(--color-muted)]">{k}</dt><dd>{v}</dd></div>)}
                  </dl>
                  {[["Why they want to represent the foundation", a.motivation], ["Social activities conducted before", a.past_activities], ["NGO or social organisation experience", a.ngo_experience], ["Personal introduction", a.introduction]]
                    .filter(([, v]) => v).map(([k, v]) => <div key={k}><h3 className="text-base">{k}</h3><p className="mt-1 whitespace-pre-line text-[0.95rem]">{v}</p></div>)}
                  <p className="flex flex-wrap gap-4">
                    {a.photo_path && <a className="link" href={file(a.photo_path)} target="_blank">View photograph</a>}
                    {(a.documents ?? []).map((d: string, i: number) => <a key={d} className="link" href={file(d)} target="_blank">Supporting document {i + 1}</a>)}
                  </p>
                  {a.review_note && <p className="text-[0.95rem]"><strong>Your note:</strong> {a.review_note}</p>}
                </div>
                {["submitted", "under_review"].includes(a.status) && (
                  <div className="h-fit space-y-5 rounded-xl bg-neutral-50 p-4">
                    <form action={approveRepApplication.bind(null, a.id)}>
                      <ConfirmButton className="btn btn-leaf btn-sm w-full" message={`Appoint ${a.full_name} as District Representative for ${a.districts?.name}? This creates their login and publishes their profile.`}>Approve and create account</ConfirmButton>
                    </form>
                    {a.status === "submitted" && <form action={reviewRepApplication.bind(null, a.id, "under_review")} className="space-y-2"><input name="note" placeholder="Note to yourself (optional)" aria-label="Note" className="field text-sm" /><button className="btn btn-line btn-sm w-full">Mark as under review</button></form>}
                    <form action={reviewRepApplication.bind(null, a.id, "rejected")} className="space-y-2">
                      <input name="note" placeholder="Internal reason (not sent)" aria-label="Reason" className="field text-sm" />
                      <ConfirmButton message={`Reject this application? ${a.full_name} will receive a polite email.`} className="text-sm font-semibold text-kumkum underline">Reject application</ConfirmButton>
                    </form>
                  </div>
                )}
                {a.status === "approved" && <p className="h-fit rounded-xl bg-leaf-soft p-4 text-[0.95rem]">Appointed. Manage this person under <Link className="link" href="/admin/manage/appointments">District Representatives</Link>, or suspend them under <Link className="link" href="/admin/volunteers?type=district_representative">Volunteers and members</Link>.</p>}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
