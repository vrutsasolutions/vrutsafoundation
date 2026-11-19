import { PageHeader } from "@/components/cards";
import { DonateFlow } from "@/components/DonateFlow";
import Link from "next/link";
import { Img } from "@/components/Img";
import { getProgrammes, getSettings } from "@/lib/data";
import { lines, paragraphs } from "@/lib/utils";

export const revalidate = 60;
export const metadata = { title: "Donate", description: "Give directly to Vrutsa Foundation's bank account by UPI or bank transfer." };

export default async function Donate() {
  const [s, programmes] = await Promise.all([getSettings(), getProgrammes()]);
  const TILE = ["bg-saffron text-black", "bg-leaf text-white", "bg-kumkum text-white", "bg-peacock text-white"];
  const open = Boolean(s.upi_qr_url || s.upi_id || s.bank_instructions);
  const amounts = (s.donation_amounts ?? "").split(",").map((v) => Number(v.trim())).filter((n) => n > 0);
  return (
    <>
      <PageHeader title="Donate" intro="Your contribution goes straight from your bank to the foundation's bank account. There is no payment company in between." />
      <section className="section">
        <div className="wrap">
          {open ? (
            <DonateFlow amounts={amounts} purposes={lines(s.donation_purposes)} qrUrl={s.upi_qr_url} upiId={s.upi_id}
              payee={s.upi_payee_name} bank={s.bank_instructions} orgName={s.org_name} />
          ) : (
            <p className="notice notice-info max-w-2xl">
              Online giving opens here as soon as the foundation publishes its official UPI QR code and bank details.
              Until then, please contact the foundation directly.
            </p>
          )}
        </div>
      </section>
      {programmes.length > 0 && (
        <section className="section border-t border-line" id="what-we-support">
          <div className="wrap">
            <h2 className="h-section">What your donations support</h2>
            <p className="lede mt-4">Contributions go to the foundation&apos;s work as a whole. These are the programmes that work is made of.</p>
            <ul className="mt-10 grid gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {programmes.map((p, i) => (
                <li key={p.id} className="flex flex-col">
                  <div className={`relative aspect-[4/3] overflow-hidden rounded-2xl ${p.image_url ? "bg-neutral-100" : TILE[i % TILE.length]}`}>
                    {p.image_url ? <Img src={p.image_url} alt="" className="object-cover" />
                      : <span className="absolute inset-0 flex items-end p-6 font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight">{p.title}</span>}
                  </div>
                  <h3 className="mt-4 text-xl">{p.title}</h3>
                  {p.description && <p className="mt-2 text-[0.97rem] text-[var(--color-muted)]">{p.description}</p>}
                  {p.link_url && <Link href={p.link_url} className="link mt-3 w-fit text-[0.95rem]" aria-label={`Learn more about ${p.title}`}>Learn more</Link>}
                </li>
              ))}
            </ul>
            <p className="mt-12 max-w-[40ch] border-l-4 border-saffron pl-5 font-[family-name:var(--font-display)] text-2xl font-medium leading-snug">
              Your contribution helps us reach more communities and support people who need it.
            </p>
          </div>
        </section>
      )}
      <section className="section border-t border-line" id="how-it-works">
        <div className="wrap grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="h-section">How your donation is verified</h2>
            <ol className="mt-8 space-y-5">
              {[
                ["You pay the foundation directly", "Scan the official QR code with any UPI app, or make a bank transfer."],
                ["You send us the transaction reference", "The short form tells us which payment in our bank statement is yours."],
                ["We check it against the bank records", "Until that check is done, your donation is shown as pending verification."],
                ["You receive a written acknowledgement", "A numbered PDF acknowledgement is sent to your email address."],
              ].map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[44px_1fr] gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-black font-[family-name:var(--font-display)] text-lg font-semibold">{i + 1}</span>
                  <div><h3 className="text-xl">{t}</h3><p className="mt-1 text-[var(--color-muted)]">{d}</p></div>
                </li>
              ))}
            </ol>
          </div>
          <div className="space-y-6">
            <h2 className="h-section">Good to know</h2>
            <p>At present the foundation accepts contributions in Indian rupees from bank accounts in India only.</p>
            <p>We will never ask for your UPI PIN, card details or bank password. Pay only to the account name shown on this page.</p>
            {s.donation_information && <div className="prose-plain">{paragraphs(s.donation_information).map((p, i) => <p key={i}>{p}</p>)}</div>}
          </div>
        </div>
      </section>
    </>
  );
}