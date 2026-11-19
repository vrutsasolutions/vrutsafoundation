import Link from "next/link";
import { PageHeader } from "@/components/cards";
import { VolunteerForm } from "@/components/VolunteerForm";
import { getSession } from "@/lib/auth";
import { getDistricts, getStates } from "@/lib/data";

export const metadata = { title: "Register as a volunteer", description: "Join Vrutsa Foundation as a volunteer in your district and receive your membership ID card." };

export default async function GetInvolved({ searchParams }: { searchParams: Promise<{ district?: string }> }) {
  const [{ district }, states, districts, session] = await Promise.all([searchParams, getStates(), getDistricts(), getSession()]);
  const member = session ? (await session.supabase.from("members").select("membership_id").eq("user_id", session.user.id).maybeSingle()).data : null;
  return (
    <>
      <PageHeader title="Register as a volunteer" intro="Join the foundation in your district. Registration is immediate: there is no waiting for approval." />
      <section className="section">
        <div className="wrap grid gap-14 lg:grid-cols-[1fr_1.5fr]">
          <div>
            <h2 className="text-3xl">How it works</h2>
            <ol className="mt-6 space-y-5">
              {[["Fill in the form", "It takes a few minutes."],
                ["Confirm your email address", "We send one link to make sure the address is yours."],
                ["Receive your membership ID card", "By email, and always available in your account."],
                ["Meet your district team", "Your District Representative is told that you have joined."],
              ].map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[40px_1fr] gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-saffron font-[family-name:var(--font-display)] font-semibold">{i + 1}</span>
                  <div><h3 className="text-lg">{t}</h3><p className="text-[0.97rem] text-[var(--color-muted)]">{d}</p></div>
                </li>
              ))}
            </ol>
            <div className="mt-10 border-t border-line pt-6">
              <h2 className="text-xl">Want to lead your district?</h2>
              <p className="mt-2 text-[0.97rem] text-[var(--color-muted)]">District Representatives are appointed by the founder after an application.</p>
              <Link href="/join-representative" className="link mt-3 inline-block">Join as District Representative</Link>
            </div>
          </div>
          {member ? (
            <div className="h-fit rounded-2xl border-2 border-black p-6 sm:p-10">
              <h2 className="text-3xl">You are already a member</h2>
              <p className="mt-3">Your membership ID is <strong>{member.membership_id}</strong>. Your ID card is in your account.</p>
              <Link href="/account" className="btn btn-leaf mt-6">Open my account</Link>
            </div>
          ) : <VolunteerForm states={states as any} districts={districts as any} preselect={district} profile={session?.profile} signedIn={Boolean(session)} />}
        </div>
      </section>
    </>
  );
}
