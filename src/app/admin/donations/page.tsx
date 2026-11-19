import Link from "next/link";
import { correctDonation, recordDonation, regenerateReceipt, rejectDonation, verifyDonation, voidDonation } from "@/app/actions/admin";
import { RecordDonationForm } from "@/components/admin/forms";
import { DonationTransparency } from "@/components/stats";
import { lines } from "@/lib/utils";
import { Flash } from "@/components/admin/Flash";
import { ConfirmButton } from "@/components/admin/ui";
import { requireSuper } from "@/lib/auth";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

export const metadata = { title: "Donations" };

export default async function Donations({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSuper();
  const status = ["pending", "verified", "rejected", "reports"].includes(sp.status ?? "") ? sp.status! : "pending";
  const [{ data: stats }, { data: purposeRow }] = await Promise.all([
    s.supabase.rpc("donation_stats"), s.supabase.from("foundation_settings").select("value").eq("key", "donation_purposes").maybeSingle(),
  ]);
  const { data } = await s.supabase.from("donation_submissions")
    .select("*, donation_receipts(receipt_no,pdf_path,issued_at), donation_verifications(note,action,created_at)")
    .eq("status", status === "reports" ? "verified" : status).order("created_at", { ascending: false }).limit(300);
  const rows: any[] = data ?? [];
  const file = (bucket: string, path: string) => `/api/files?bucket=${bucket}&path=${encodeURIComponent(path)}`;

  return (
    <>
      <h1 className="text-4xl">Donations and receipts</h1>
      <div className="notice notice-info mt-4 max-w-3xl">
        <p className="font-semibold">Verify against the bank statement, never against a screenshot.</p>
        <p className="mt-1">Find the same UTR, amount and date in the foundation&apos;s bank or UPI statement before you press Verify. Verifying creates the numbered acknowledgement and queues it to the donor.</p>
      </div>
      <p className="mt-6 flex gap-4 text-sm">
        {[["pending", "Pending verification"], ["verified", "Verified"], ["rejected", "Rejected or voided"], ["reports", "Monthly and yearly report"]].map(([v, l]) => (
          <Link key={v} href={`/admin/donations?status=${v}`} className={status === v ? "font-semibold underline decoration-saffron decoration-[3px] underline-offset-4" : "underline"}>{l}</Link>
        ))}
      </p>
      <div className="mt-6"><Flash params={sp} /></div>
      {status === "reports" && (
        <section className="max-w-5xl">
          <p className="mb-6 max-w-[70ch] text-[var(--color-muted)]">Private to the founder. Recalculated from verified records every time; it is not shown on the public website.</p>
          <DonationTransparency stats={stats as any} />
        </section>
      )}
      {status === "verified" && (
        <section className="mb-10">
          <h2 className="mb-2 text-2xl">Record a donation received in the bank</h2>
          <p className="mb-4 max-w-[70ch] text-[var(--color-muted)]">For money you have seen in the foundation&apos;s account when the donor did not use the website form. It is added to your reports immediately.</p>
          <RecordDonationForm action={recordDonation} purposes={lines(purposeRow?.value)} />
        </section>
      )}
      {status !== "reports" && rows.length === 0 && <p className="rounded-xl border border-dashed border-neutral-400 px-6 py-10 text-center text-[var(--color-muted)]">No donations in this list.</p>}

      <ul className="max-w-4xl space-y-5">
        {(status === "reports" ? [] : rows).map((d) => {
          const rec = Array.isArray(d.donation_receipts) ? d.donation_receipts[0] : d.donation_receipts;
          const note = d.donation_verifications?.[0]?.note;
          return (
            <li key={d.id} className="rounded-xl border border-line p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-[family-name:var(--font-display)] text-3xl font-semibold">{formatINR(d.amount)}</p>
                  <p className="font-medium">{d.donor_name}{d.source === "founder_entry" && <span className="tag ml-2 bg-neutral-200">Entered by the founder</span>}</p>
                </div>
                <p className="text-right text-sm text-[var(--color-muted)]">{d.reference}<br />Submitted {formatDateTime(d.created_at)}</p>
              </div>
              <dl className="mt-4 grid gap-x-8 gap-y-2 text-[0.95rem] sm:grid-cols-2">
                <div><dt className="text-sm text-[var(--color-muted)]">Transaction reference (UTR)</dt><dd className="font-mono text-lg font-semibold tracking-wide">{d.utr}</dd></div>
                <div><dt className="text-sm text-[var(--color-muted)]">Payment date</dt><dd>{formatDate(d.paid_on)}</dd></div>
                <div><dt className="text-sm text-[var(--color-muted)]">Contact</dt><dd>{d.email || "No email"}<br />{d.phone}</dd></div>
                <div><dt className="text-sm text-[var(--color-muted)]">Purpose</dt><dd>{d.purpose || "Not stated"}</dd></div>
              </dl>
              {d.proof_path && <p className="mt-3"><a className="link" href={file("private-uploads", d.proof_path)} target="_blank">View the donor&apos;s screenshot</a> <span className="text-sm text-[var(--color-muted)]">(supporting information only)</span></p>}
              {note && <p className="mt-3 text-[0.95rem]"><strong>Note:</strong> {note}</p>}

              {status === "pending" && (
                <div className="mt-5 grid gap-5 border-t border-line pt-5 md:grid-cols-2">
                  <form action={verifyDonation.bind(null, d.id)} className="space-y-3">
                    <label className="flex items-start gap-3 text-[0.95rem]"><input type="checkbox" name="checked" required className="mt-1 h-5 w-5 accent-[var(--color-leaf)]" /><span>I found this UTR, amount and date in the foundation&apos;s bank records.</span></label>
                    <input name="note" placeholder="Note (optional), for example the statement date" aria-label="Verification note" className="field text-sm" />
                    <button className="btn btn-leaf btn-sm">Verify and issue acknowledgement</button>
                  </form>
                  <form action={rejectDonation.bind(null, d.id)} className="space-y-3">
                    <input name="note" required placeholder="Reason, sent to the donor" aria-label="Reason for rejection" className="field text-sm" />
                    <ConfirmButton message="Reject this submission? The donor will be told it could not be verified.">Reject</ConfirmButton>
                  </form>
                </div>
              )}
              {status === "verified" && (
                <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4">
                  {rec?.pdf_path ? <a className="btn btn-line btn-sm" href={file("receipts", rec.pdf_path)} target="_blank">Open acknowledgement {rec.receipt_no}</a>
                    : <span className="text-kumkum">Verified, but the acknowledgement PDF is missing.</span>}
                  <form action={regenerateReceipt.bind(null, d.id)}><button className="text-sm underline">Create receipt again</button></form>
                  <details className="w-full">
                    <summary className="cursor-pointer text-sm underline">Correct or void this record</summary>
                    <div className="mt-3 grid gap-5 md:grid-cols-2">
                      <form action={correctDonation.bind(null, d.id)} className="space-y-2">
                        <div className="grid grid-cols-2 gap-2"><input name="amount" defaultValue={d.amount} inputMode="decimal" required aria-label="Correct amount" className="field text-sm" /><input name="paid_on" type="date" defaultValue={d.paid_on} required aria-label="Correct date" className="field text-sm" /></div>
                        <input name="note" required placeholder="Reason for the correction" aria-label="Reason for the correction" className="field text-sm" />
                        <button className="btn btn-line btn-sm">Save correction</button>
                      </form>
                      <form action={voidDonation.bind(null, d.id)} className="space-y-2">
                        <input name="note" required placeholder="Reason for voiding" aria-label="Reason for voiding" className="field text-sm" />
                        <ConfirmButton message="Void this donation? It is removed from the public totals. The history is kept." className="text-sm font-semibold text-kumkum underline">Void this record</ConfirmButton>
                      </form>
                    </div>
                  </details>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}