import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { EmailCardButton, MembershipForm, PasswordForm, ProfileForm } from "@/components/AuthForms";
import { LeaderCard } from "@/components/cards";
import { Img } from "@/components/Img";
import { requireUser } from "@/lib/auth";
import { getDistricts, getLeaders, getStates } from "@/lib/data";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

export const metadata = { title: "My account", robots: { index: false } };

const DON_STATUS: Record<string, string> = { pending: "Pending verification", verified: "Verified", rejected: "Could not be verified" };

export default async function Account({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const s = await requireUser();
  const [states, districts, regs, donations, memberRes, leaders] = await Promise.all([
    getStates(), getDistricts(),
    s.supabase.from("event_registrations").select("id,created_at,events(title,slug,starts_at)").eq("user_id", s.user.id).order("created_at", { ascending: false }),
    s.supabase.from("donation_submissions").select("id,reference,amount,status,paid_on,donation_receipts(receipt_no,pdf_path)").eq("user_id", s.user.id).order("created_at", { ascending: false }),
    s.supabase.from("members").select("*").eq("user_id", s.user.id).maybeSingle(),
    getLeaders(),
  ]);
  const member = memberRes.data;
  const active = member?.status === "active";
  const reps = member ? leaders.filter((l) => l.district_id === member.district_id) : [];
  const { data: announcements } = member ? await s.supabase.from("announcements").select("id,title,body,created_at,district_id").order("created_at", { ascending: false }).limit(10) : { data: [] };
  const photoUrl = member?.photo_path ? (await s.supabase.storage.from("private-uploads").createSignedUrl(member.photo_path, 600)).data?.signedUrl : null;
  const nameOf = (id: string | null, list: any[]) => list.find((x) => x.id === id)?.name;
  return (
    <div className="wrap section">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl">{s.profile?.full_name || "My account"}</h1>
          <p className="mt-2 text-[var(--color-muted)]">{s.user.email}</p>
        </div>
        <div className="flex gap-3">
          {s.isStaff && <Link href="/admin" className="btn btn-leaf btn-sm">Open admin panel</Link>}
          <form action={logout}><button className="btn btn-line btn-sm">Sign out</button></form>
        </div>
      </div>
      {notice === "set-password" && <p className="notice notice-info mt-6">You are signed in. Choose a new password below.</p>}
      {notice === "no-admin" && <p className="notice notice-info mt-6">Your account does not have admin access. District Representatives are appointed by the founder.</p>}

      {s.roles.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl">My responsibilities</h2>
          <ul className="mt-4 space-y-2">
            {s.roles.map((r, i) => <li key={i} className="border-l-4 border-saffron pl-4"><strong>{r.roles.name}</strong>{(r.district_id || r.state_id) && `, ${nameOf(r.district_id, districts) ?? nameOf(r.state_id, states) ?? ""}`}</li>)}
          </ul>
        </section>
      )}

      {member ? (
        <section className="mt-12 grid gap-10 lg:grid-cols-[340px_1fr]">
          <div>
            <h2 className="text-2xl">My ID card</h2>
            <div className={`mt-4 overflow-hidden rounded-2xl border-2 ${active ? "border-black" : "border-kumkum"}`}>
              <div className="border-b-4 border-saffron p-4 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Vrutsa Foundation" className="mx-auto h-12 w-auto" />
              </div>
              <div className="p-5 text-center">
                <div className="relative mx-auto h-28 w-28 overflow-hidden rounded-xl bg-saffron-soft">
                  {photoUrl ? <Img src={photoUrl} alt="" sizes="112px" className="object-cover" />
                    : <span className="flex h-full w-full items-center justify-center font-[family-name:var(--font-display)] text-5xl font-semibold text-leaf">{String(member.full_name).slice(0, 1)}</span>}
                </div>
                <p className="mt-3 font-[family-name:var(--font-display)] text-xl font-semibold">{member.full_name}</p>
                <p className="tag mt-1 bg-leaf text-white">{member.member_type === "district_representative" ? "District Representative" : "Volunteer"}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-left text-sm">
                  <div><dt className="text-[var(--color-muted)]">Membership ID</dt><dd className="font-semibold">{member.membership_id}</dd></div>
                  <div><dt className="text-[var(--color-muted)]">Joined</dt><dd className="font-semibold">{formatDate(member.joined_on)}</dd></div>
                  <div><dt className="text-[var(--color-muted)]">District</dt><dd className="font-semibold">{nameOf(member.district_id, districts) ?? "Not set"}</dd></div>
                  <div><dt className="text-[var(--color-muted)]">State</dt><dd className="font-semibold">{nameOf(member.state_id, states) ?? "Not set"}</dd></div>
                </dl>
              </div>
              <div className={`px-4 py-2 text-center text-sm font-semibold text-white ${active ? "bg-leaf" : "bg-kumkum"}`}>
                {active ? "Active member" : member.status === "pending_email" ? "Waiting for email confirmation" : member.status === "suspended" ? "Membership suspended: card not valid" : "Membership closed: card not valid"}
              </div>
            </div>
            {active && (
              <div className="mt-4 flex flex-wrap items-start gap-3">
                <a href="/api/id-card" target="_blank" className="btn btn-leaf btn-sm">Download ID card (PDF)</a>
                <EmailCardButton />
              </div>
            )}
          </div>
          <div className="space-y-10">
            <div>
              <h2 className="text-2xl">My District Representative</h2>
              <div className="mt-4 space-y-6">
                {reps.length ? reps.map((p) => <LeaderCard key={p.id} p={p} />) : <p className="text-[var(--color-muted)]">No representative has been appointed for your district yet. You can contact the foundation office in the meantime.</p>}
                {member.district_id && <Link href={`/network/${districts.find((d) => d.id === member.district_id)?.slug ?? ""}`} className="link inline-block">Open my district page</Link>}
              </div>
            </div>
            <div>
              <h2 className="text-2xl">Announcements</h2>
              {announcements?.length ? (
                <ul className="mt-4 space-y-4">
                  {announcements.map((a: any) => (
                    <li key={a.id} className="border-l-4 border-saffron pl-4">
                      <p className="text-sm text-[var(--color-muted)]">{formatDate(a.created_at)}{a.district_id ? `, ${nameOf(a.district_id, districts)} district` : ""}</p>
                      <h3 className="text-lg">{a.title}</h3>
                      <p className="mt-1 whitespace-pre-line text-[0.97rem]">{a.body}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-3 text-[var(--color-muted)]">Foundation and district announcements appear here.</p>}
            </div>
          </div>
        </section>
      ) : !s.isStaff && (
        <section className="mt-12 rounded-2xl bg-saffron p-6 sm:p-8">
          <h2 className="text-2xl">Become a volunteer</h2>
          <p className="mt-2 max-w-[60ch]">Register in your district to receive your membership ID card.</p>
          <Link href="/get-involved" className="btn btn-white mt-4">Register as a volunteer</Link>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-2xl">Event registrations</h2>
        {regs.data?.length ? (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {regs.data.map((r: any) => <li key={r.id} className="flex flex-wrap justify-between gap-2 py-3"><Link className="link" href={`/events/${r.events?.slug}`}>{r.events?.title}</Link><span>{formatDateTime(r.events?.starts_at)}</span></li>)}
          </ul>
        ) : <p className="mt-3 text-[var(--color-muted)]">No registrations yet. <Link href="/events" className="link">See upcoming events</Link></p>}
      </section>

      <section className="mt-12">
        <h2 className="text-2xl">Donations</h2>
        {donations.data?.length ? (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {donations.data.map((d: any) => {
              const rec = Array.isArray(d.donation_receipts) ? d.donation_receipts[0] : d.donation_receipts;
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span>{formatINR(d.amount)} on {formatDate(d.paid_on)} <span className="text-sm text-[var(--color-muted)]">({d.reference})</span></span>
                  <span className="flex items-center gap-4"><strong>{DON_STATUS[d.status]}</strong>
                    {rec?.pdf_path && <a className="link" href={`/api/files?bucket=receipts&path=${encodeURIComponent(rec.pdf_path)}`}>Acknowledgement {rec.receipt_no}</a>}</span>
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-3 text-[var(--color-muted)]">Donations you confirm while signed in appear here with their acknowledgements.</p>}
      </section>

      {member && (
        <section className="mt-12">
          <h2 className="mb-5 text-2xl">My membership details</h2>
          <MembershipForm member={member} />
        </section>
      )}
      <section className="mt-12">
        <h2 className="mb-5 text-2xl">Account name and location</h2>
        <ProfileForm profile={s.profile} states={states as any} districts={districts as any} />
      </section>
      <section className="mt-12">
        <h2 className="mb-5 text-2xl">Password</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
