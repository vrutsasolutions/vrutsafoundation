import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Login", robots: { index: false } };

const PORTALS = {
  member: { tab: "Volunteer or member", title: "Volunteer and member login", text: "See your ID card, your district team and foundation announcements." },
  representative: { tab: "District Representative", title: "District Representative login", text: "Manage the volunteers, activities and events of your district. Accounts are created by the founder after an approved application." },
  founder: { tab: "Founder or admin", title: "Founder and admin login", text: "Full administration of the foundation platform. This account cannot be created from the website." },
} as const;
type Portal = keyof typeof PORTALS;

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; as?: string }> }) {
  const { next, error, as } = await searchParams;
  const s = await getSession();
  if (s) redirect(s.isStaff ? "/admin" : "/account");
  const portal: Portal = as === "representative" || as === "founder" ? as : "member";
  const p = PORTALS[portal];
  return (
    <div className="wrap section max-w-xl">
      <h1 className="text-4xl">Sign in</h1>
      <nav aria-label="Choose your login" className="mt-6 grid grid-cols-3 gap-1 rounded-xl border border-line p-1 text-center text-[0.9rem] font-semibold">
        {(Object.keys(PORTALS) as Portal[]).map((k) => (
          <Link key={k} href={`/login?as=${k}${next ? `&next=${encodeURIComponent(next)}` : ""}`} aria-current={k === portal ? "page" : undefined}
            className={`flex items-center justify-center rounded-lg px-2 py-2.5 leading-tight ${k === portal ? (k === "member" ? "bg-leaf text-white" : k === "representative" ? "bg-saffron text-black" : "bg-black text-white") : "hover:bg-neutral-100"}`}>{PORTALS[k].tab}</Link>
        ))}
      </nav>
      <h2 className="mt-8 text-2xl">{p.title}</h2>
      <p className="mt-2 text-[var(--color-muted)]">{p.text}</p>
      {error === "link" && <p className="notice notice-err mt-5">That link has expired or was already used. Please request a new one.</p>}
      <div className="mt-6"><LoginForm next={next} portal={portal} key={portal} /></div>
      {portal === "representative" && <p className="mt-6 text-[0.95rem]">Not a representative yet? <Link href="/join-representative" className="link">Apply to join as District Representative</Link></p>}
    </div>
  );
}
