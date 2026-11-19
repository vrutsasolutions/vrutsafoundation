import { publicDb } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "ID verification", robots: { index: false } };
export const dynamic = "force-dynamic";

// What the QR code on an ID card opens. Shows whether the card is valid today.
export default async function Verify({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let m: any = null;
  if (/^[0-9a-f-]{36}$/i.test(token)) m = ((await publicDb()?.rpc("verify_member", { p_token: token }))?.data ?? [])[0] ?? null;
  const active = m?.status === "active";
  return (
    <div className="wrap section max-w-xl">
      <h1 className="text-4xl">ID verification</h1>
      {!m ? (
        <p className="notice notice-err mt-6 text-lg">This is not a valid Vrutsa Foundation ID card.</p>
      ) : (
        <div className={`mt-6 rounded-2xl border-2 p-6 sm:p-8 ${active ? "border-leaf" : "border-kumkum"}`}>
          <p className={`tag text-sm text-white ${active ? "bg-leaf" : "bg-kumkum"}`}>{active ? "Valid: active member" : m.status === "suspended" ? "Not valid: membership suspended" : "Not valid: membership closed"}</p>
          <h2 className="mt-4 text-3xl">{m.full_name}</h2>
          <p className="mt-1 text-lg font-medium text-leaf">{m.role}</p>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            {[["Membership ID", m.membership_id], ["District", m.district], ["State", m.state], ["Member since", formatDate(m.joined_on)]].map(([k, v]) => (
              <div key={k}><dt className="text-sm text-[var(--color-muted)]">{k}</dt><dd className="font-semibold">{v || "Not recorded"}</dd></div>
            ))}
          </dl>
          {!active && <p className="mt-5 text-[0.95rem]">This card must not be accepted as identification of Vrutsa Foundation.</p>}
        </div>
      )}
      <p className="mt-6 text-sm text-[var(--color-muted)]">Checked against the foundation&apos;s membership records just now.</p>
    </div>
  );
}
