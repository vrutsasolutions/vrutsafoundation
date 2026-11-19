import Link from "next/link";
import { updateRepProfile } from "@/app/actions/admin";
import { RepProfileForm } from "@/components/admin/forms";
import { requireManager } from "@/lib/auth";

export const metadata = { title: "My profile" };

export default async function MyProfile() {
  const s = await requireManager();
  const { data: p } = await s.supabase.from("regional_appointments").select("*, districts(name,slug)").eq("user_id", s.user.id).eq("status", "active").limit(1).maybeSingle();
  return (
    <>
      <h1 className="text-4xl">My public profile</h1>
      {!p ? <p className="notice notice-info mt-6 max-w-2xl">No public profile is linked to this login. {s.isSuper ? "The founder's profile is edited under Founder profile and content." : "Please ask the founder to link your appointment to this account."}</p> : (
        <>
          <p className="mb-8 mt-2 max-w-[70ch] text-[var(--color-muted)]">
            This is what visitors see on the <Link href={`/network/${(p as any).districts?.slug}`} className="link">{(p as any).districts?.name} district page</Link>. Your name, designation and district are set by the founder.
          </p>
          <dl className="mb-8 grid max-w-2xl grid-cols-3 gap-4 rounded-xl bg-neutral-50 p-4 text-[0.95rem]">
            <div><dt className="text-sm text-[var(--color-muted)]">Name</dt><dd className="font-semibold">{p.full_name}</dd></div>
            <div><dt className="text-sm text-[var(--color-muted)]">Designation</dt><dd className="font-semibold">{p.designation || "District Representative"}</dd></div>
            <div><dt className="text-sm text-[var(--color-muted)]">District</dt><dd className="font-semibold">{(p as any).districts?.name}</dd></div>
          </dl>
          <RepProfileForm action={updateRepProfile} profile={p} />
          <p className="mt-10 text-[0.95rem]">Your ID card and password are in <Link href="/account" className="link">your account</Link>.</p>
        </>
      )}
    </>
  );
}
