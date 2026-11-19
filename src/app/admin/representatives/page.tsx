import Link from "next/link";
import { resendRepIdCard, revokeRepInvitation, sendRepLoginLink } from "@/app/actions/representatives";
import { Flash } from "@/components/admin/Flash";
import { ConfirmButton } from "@/components/admin/ui";
import { requireSuper } from "@/lib/auth";
import { channelStatus } from "@/lib/notifications/process";
import { serviceDb } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "District Representatives" };

export default async function Representatives({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSuper();
  const svc = serviceDb();
  const { data: reps } = await s.supabase.from("regional_appointments")
    .select("id,full_name,designation,email,phone,photo_url,status,is_public,appointed_on,user_id,districts(name,slug),roles!inner(name,scope,can_manage)")
    .eq("roles.scope", "district").eq("roles.can_manage", true).order("appointed_on", { ascending: false }).limit(200);
  const ids = (reps ?? []).map((r) => r.user_id).filter(Boolean) as string[];
  const { data: members } = ids.length ? await s.supabase.from("members").select("id,user_id,membership_id,status").in("user_id", ids) : { data: [] };

  // Account status comes from Supabase Auth, which only the server key may read.
  const accounts = new Map<string, any>();
  if (svc) await Promise.all(ids.map(async (id) => { const { data } = await svc.auth.admin.getUserById(id); if (data?.user) accounts.set(id, data.user); }));
  const emailOn = channelStatus().email;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl">District Representatives</h1>
          <p className="mt-2 max-w-[72ch] text-[var(--color-muted)]">
            Each representative signs in with their own email address. You never set or see their password: they receive a single-use link and choose it themselves.
          </p>
        </div>
        <Link href="/admin/manage/appointments/new" className="btn btn-leaf">Appoint a representative</Link>
      </div>
      <div className="mt-6">
        <Flash params={sp} />
        {!svc && <p className="notice notice-err mb-6">SUPABASE_SERVICE_ROLE_KEY is missing in .env.local, so account status cannot be shown and invitations cannot be sent.</p>}
        {!emailOn && <p className="notice notice-info mb-6">Email is not connected yet (RESEND_API_KEY and EMAIL_FROM). Invitations are still created: after you press a button, the link is shown here so you can send it to the person yourself.</p>}
      </div>

      {(reps ?? []).length === 0 && <p className="rounded-xl border border-dashed border-neutral-400 px-6 py-10 text-center text-[var(--color-muted)]">No District Representatives yet. Approve an application or appoint one directly.</p>}
      <ul className="max-w-5xl space-y-4">
        {(reps ?? []).map((r: any) => {
          const acc = r.user_id ? accounts.get(r.user_id) : null;
          const member = (members ?? []).find((m) => m.user_id === r.user_id);
          const activated = Boolean(acc?.last_sign_in_at);
          const state = r.status !== "active" ? ["Appointment inactive", "bg-neutral-200"]
            : !r.user_id ? ["No login yet", "bg-rose-100 text-kumkum"]
            : !svc ? ["Login linked", "bg-saffron-soft"]
            : activated ? ["Login active", "bg-leaf-soft"] : ["Invited, password not set", "bg-saffron-soft"];
          return (
            <li key={r.id} className="rounded-xl border border-line p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-4">
                  {r.photo_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={r.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" />
                    : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-saffron-soft font-[family-name:var(--font-display)] text-xl font-semibold text-leaf">{String(r.full_name).slice(0, 1)}</span>}
                  <div>
                    <h2 className="text-xl">{r.full_name}</h2>
                    <p className="text-[0.95rem] text-[var(--color-muted)]">{r.designation || r.roles?.name}, {r.districts?.name ?? "no district"}</p>
                  </div>
                </div>
                <span className={`tag ${state[1]}`}>{state[0]}</span>
              </div>

              <dl className="mt-4 grid gap-x-8 gap-y-2 text-[0.95rem] sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-sm text-[var(--color-muted)]">Login email</dt><dd className="break-all">{r.email || "Not entered"}</dd></div>
                <div><dt className="text-sm text-[var(--color-muted)]">Membership ID</dt><dd>{member?.membership_id ?? "Issued with the invitation"}</dd></div>
                <div><dt className="text-sm text-[var(--color-muted)]">Appointed</dt><dd>{formatDate(r.appointed_on)}</dd></div>
                <div><dt className="text-sm text-[var(--color-muted)]">Last sign-in</dt><dd>{acc?.last_sign_in_at ? formatDateTime(acc.last_sign_in_at) : r.user_id ? "Never" : "No login"}</dd></div>
                {acc && <div><dt className="text-sm text-[var(--color-muted)]">Email confirmed</dt><dd>{acc.email_confirmed_at ? "Yes" : "Not yet (confirmed when the link is opened)"}</dd></div>}
                {acc && <div><dt className="text-sm text-[var(--color-muted)]">Sign-in methods</dt><dd>{(acc.app_metadata?.providers ?? ["email"]).join(", ")}</dd></div>}
                {member && member.status !== "active" && <div><dt className="text-sm text-[var(--color-muted)]">Membership</dt><dd className="text-kumkum">{member.status}</dd></div>}
              </dl>

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                {r.status === "active" && !activated && (
                  <form action={sendRepLoginLink.bind(null, r.id, "invite")}><button className="btn btn-leaf btn-sm">{r.user_id ? "Resend login invitation" : "Send login invitation"}</button></form>
                )}
                {r.status === "active" && activated && (
                  <form action={sendRepLoginLink.bind(null, r.id, "reset")}><ConfirmButton message={`Send ${r.full_name} a link to choose a new password?`}>Reset password</ConfirmButton></form>
                )}
                {r.user_id && <form action={resendRepIdCard.bind(null, r.id)}><button className="btn btn-line btn-sm">Resend ID card</button></form>}
                {member?.status === "active" && <a className="link text-[0.95rem]" href={`/api/id-card?member=${member.id}`} target="_blank">Open ID card</a>}
                <Link className="link text-[0.95rem]" href={`/admin/manage/appointments/${r.id}`}>Edit profile</Link>
                {r.districts?.slug && <Link className="link text-[0.95rem]" href={`/network/${r.districts.slug}`} target="_blank">Public page</Link>}
                {r.user_id && svc && !activated && (
                  <form action={revokeRepInvitation.bind(null, r.id)} className="ml-auto"><ConfirmButton message={`Revoke the invitation for ${r.full_name}? The link stops working and their district rights are removed.`} className="text-sm font-semibold text-kumkum underline">Revoke invitation</ConfirmButton></form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-8 max-w-[72ch] text-sm text-[var(--color-muted)]">
        To stop an activated representative, suspend them under <Link className="underline" href="/admin/volunteers?type=district_representative">Volunteers and members</Link>: their rights and ID card stop immediately.
      </p>
    </>
  );
}