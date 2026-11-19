import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { AdminNav } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth";

export const metadata = { title: { default: "Admin", template: "%s | Vrutsa admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStaff();
  const count = async (table: string, col: string, vals: string[]) =>
    (await s.supabase.from(table).select("id", { count: "exact", head: true }).in(col, vals)).count ?? 0;
  const [pendingDonations, pendingApplications] = await Promise.all([
    s.isSuper ? count("donation_submissions", "status", ["pending"]) : 0,
    s.isSuper ? count("representative_applications", "status", ["submitted", "under_review"]) : 0,
  ]);

  const groups = s.isSuper ? [
    { title: "Overview", items: [{ href: "/admin", label: "Dashboard" }] },
    { title: "People", items: [
      { href: "/admin/applications", label: "Representative applications", badge: pendingApplications },
      { href: "/admin/representatives", label: "District Representatives" },
      { href: "/admin/manage/appointments", label: "Leadership profiles" },
      { href: "/admin/volunteers", label: "Volunteers and members" },
      { href: "/admin/announcements", label: "Announcements" },
      { href: "/admin/users", label: "Users and access control" },
    ]},
    { title: "Website", items: [
      { href: "/admin/manage/slides", label: "Homepage carousel" },
      { href: "/admin/manage/activities", label: "Activities" }, { href: "/admin/manage/events", label: "Events" },
      { href: "/admin/manage/media", label: "Media library" },
      { href: "/admin/content", label: "Founder profile and content" },
      { href: "/admin/manage/categories", label: "Focus areas" },
      { href: "/admin/manage/programmes", label: "Donation programmes" },
      { href: "/admin/manage/districts", label: "Districts" }, { href: "/admin/manage/states", label: "States" },
    ]},
    { title: "Donations", items: [{ href: "/admin/donations", label: "Donations and reports", badge: pendingDonations }] },
    { title: "System", items: [
      { href: "/admin/notifications", label: "Email and WhatsApp" }, { href: "/admin/settings", label: "Website settings" },
      { href: "/admin/audit", label: "Audit log" },
    ]},
  ] : [
    { title: "My district", items: [
      { href: "/admin", label: "District overview" },
      ...(s.isManager ? [{ href: "/admin/volunteers", label: "Volunteers" }] : []),
      { href: "/admin/manage/activities", label: "Activities" },
      ...(s.isManager ? [{ href: "/admin/manage/events", label: "Events" }] : []),
      { href: "/admin/manage/media", label: "Media" },
      ...(s.isManager ? [{ href: "/admin/announcements", label: "Announcements" }, { href: "/admin/profile", label: "My profile" }] : []),
      { href: "/admin/inbox", label: "My notifications" },
    ]},
  ];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="border-b border-line p-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <Link href="/" aria-label="Back to the website"><Image src="/logo.png" alt="Vrutsa Foundation" width={414} height={148} className="h-11 w-auto" /></Link>
        <div className={`mt-4 rounded-lg px-3 py-2.5 text-sm ${s.isSuper ? "bg-black text-white" : "bg-saffron-soft"}`}>
          <p className="font-semibold">{s.profile?.full_name || s.user.email}</p>
          <p className="opacity-80">{s.isSuper ? "Founder admin panel" : `${s.title} panel`}</p>
        </div>
        <details className="mt-4 lg:hidden"><summary className="btn btn-line btn-sm">Menu</summary><div className="mt-4"><AdminNav groups={groups} /></div></details>
        <div className="mt-6 hidden lg:block"><AdminNav groups={groups} /></div>
        <form action={logout} className="mt-6 px-3"><button className="text-sm font-semibold underline">Sign out</button></form>
      </aside>
      <main id="main" className="min-w-0 px-5 py-8 sm:px-10">{children}</main>
    </div>
  );
}