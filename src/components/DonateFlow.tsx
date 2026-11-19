"use client";
import { useActionState, useState } from "react";
import { submitDonation } from "@/app/actions/public";
import { FormMessage, Honeypot, Submit } from "./form";
import { PrivateUpload } from "./uploads";
import { formatINR } from "@/lib/utils";

type Props = { amounts: number[]; purposes: string[]; qrUrl?: string; upiId?: string; payee?: string; bank?: string; orgName: string };

export function DonateFlow({ amounts, purposes, qrUrl, upiId, payee, bank, orgName }: Props) {
  const [amount, setAmount] = useState<string>(amounts[0] ? String(amounts[0]) : "");
  const [purpose, setPurpose] = useState(purposes[0] ?? "");
  const [state, action] = useActionState(submitDonation, null);
  const value = Number(amount);
  const today = new Date().toISOString().slice(0, 10);
  // Opens the donor's own UPI app with the foundation's official UPI ID. No gateway is involved.
  const upiLink = upiId && value > 0
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payee || orgName)}&am=${value.toFixed(2)}&cu=INR${purpose ? `&tn=${encodeURIComponent(purpose.slice(0, 40))}` : ""}`
    : null;

  if (state?.ok) {
    return (
      <div className="rounded-2xl border-2 border-black p-6 sm:p-10" role="status">
        <p className="tag bg-saffron text-black">Pending verification</p>
        <h2 className="mt-4 text-3xl">We have your confirmation</h2>
        <p className="mt-3 max-w-[60ch]">
          Our team will now check this payment against the foundation&apos;s bank records. Once it is verified, your
          acknowledgement will be sent to the email address you gave. Nothing is marked as received until that check is done.
        </p>
        <p className="mt-5 text-sm text-[var(--color-muted)]">Your reference</p>
        <p className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-wide">{state.reference}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1.05fr]">
      <div>
        <ol className="space-y-10">
          <li>
            <h2 className="text-2xl"><span className="mr-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-saffron text-lg">1</span>Choose an amount</h2>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {amounts.map((a) => (
                <button key={a} type="button" onClick={() => setAmount(String(a))} aria-pressed={value === a}
                  className={`btn btn-sm min-h-11 border-2 ${value === a ? "border-leaf bg-leaf text-white" : "border-black bg-white text-black hover:bg-neutral-100"}`}>{formatINR(a)}</button>
              ))}
            </div>
            <label className="label mt-4" htmlFor="custom-amount">Or enter another amount (₹)</label>
            <input id="custom-amount" inputMode="decimal" className="field max-w-[220px]" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
            {purposes.length > 0 && (
              <>
                <label className="label mt-4" htmlFor="purpose-pick">Purpose</label>
                <select id="purpose-pick" className="field max-w-sm" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                  {purposes.map((p) => <option key={p}>{p}</option>)}
                </select>
              </>
            )}
          </li>
          <li>
            <h2 className="text-2xl"><span className="mr-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-saffron text-lg">2</span>Pay the foundation directly</h2>
            <div className="mt-4 rounded-2xl border border-line p-5">
              {qrUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrUrl} alt={`Official UPI QR code of ${orgName}`} className="mx-auto w-full max-w-[260px]" />
              )}
              <dl className="mt-4 space-y-1 text-[0.97rem]">
                {payee && <div><dt className="inline text-[var(--color-muted)]">Pay to: </dt><dd className="inline font-semibold">{payee}</dd></div>}
                {upiId && <div><dt className="inline text-[var(--color-muted)]">UPI ID: </dt><dd className="inline font-semibold break-all">{upiId}</dd></div>}
              </dl>
              {payee && <p className="mt-2 text-sm text-[var(--color-muted)]">Check that your UPI app shows this name before you approve the payment.</p>}
              {upiLink && <a href={upiLink} className="btn btn-leaf mt-4 w-full sm:hidden">Open my UPI app for {formatINR(value)}</a>}
              {bank && (
                <details className="mt-4 border-t border-line pt-3">
                  <summary className="cursor-pointer font-semibold">Pay by bank transfer instead</summary>
                  <p className="mt-2 whitespace-pre-line text-[0.97rem]">{bank}</p>
                </details>
              )}
            </div>
          </li>
        </ol>
      </div>

      <form action={action} className="relative h-fit rounded-2xl border-2 border-black p-6 sm:p-8">
        <h2 className="text-2xl"><span className="mr-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-saffron text-lg">3</span>Tell us about your payment</h2>
        <p className="mt-2 text-[0.97rem] text-[var(--color-muted)]">Fill this in after you have paid, so we can match your payment in the bank records and send your acknowledgement.</p>
        <Honeypot />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label" htmlFor="donor_name">Your name</label><input id="donor_name" name="donor_name" required autoComplete="name" className="field" /></div>
          <div><label className="label" htmlFor="d-email">Email</label><input id="d-email" name="email" type="email" required autoComplete="email" className="field" /></div>
          <div><label className="label" htmlFor="d-phone">WhatsApp or mobile number</label><input id="d-phone" name="phone" type="tel" required autoComplete="tel" className="field" /></div>
          <div><label className="label" htmlFor="d-amount">Amount paid (₹)</label><input id="d-amount" name="amount" inputMode="decimal" required className="field" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} /></div>
          <div><label className="label" htmlFor="paid_on">Payment date</label><input id="paid_on" name="paid_on" type="date" required max={today} defaultValue={today} className="field" /></div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="utr">Transaction reference (UTR)</label>
            <input id="utr" name="utr" required className="field uppercase" autoComplete="off" aria-describedby="utr-help" />
            <p id="utr-help" className="help">The 12-digit UPI reference or bank UTR shown in your payment app after paying.</p>
          </div>
          <input type="hidden" name="purpose" value={purpose} />
          <div className="sm:col-span-2">
            <span className="label">Payment screenshot (optional)</span>
            <PrivateUpload name="proof_path" prefix="proofs" accept="image/jpeg,image/png,image/webp,application/pdf" label="Attach screenshot" />
          </div>
          <label className="flex items-start gap-3 text-[0.95rem] sm:col-span-2">
            <input type="checkbox" name="whatsapp_opt_in" className="mt-1 h-5 w-5 accent-[var(--color-leaf)]" />
            <span>Also send my acknowledgement on WhatsApp.</span>
          </label>
        </div>
        <div className="mt-5 space-y-4">
          <FormMessage state={state} />
          <Submit className="btn btn-saffron w-full" pending="Sending…">Send for verification</Submit>
          <p className="text-sm text-[var(--color-muted)]">We use these details only to verify your donation and send your acknowledgement.</p>
        </div>
      </form>
    </div>
  );
}
