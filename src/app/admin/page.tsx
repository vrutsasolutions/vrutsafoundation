import Link from "next/link";
import { BarChart, periodLabel } from "@/components/stats";
import { requireStaff } from "@/lib/auth";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ district?: string }> }) {
  const sp = await searchParams;
  const s = await requireStaff();
  const c = s.supabase;

  // Founder: whole foundation. Representative: their own district (the database refuses any other).
  let districtQ: any = c.from("districts").select("id,name").eq("is_active", true).order("name");
  if (!s.scope.all) districtQ = districtQ.in("id", s.scope.manage.length ? s.scope.manage : s.scope.contribute);
  const { data: districts } = await districtQ;
  const districtId = s.isSuper ? null : (districts ?? []).find((d: any) => d.id === sp.district)?.id ?? districts?.[0]?.id ?? null;
  const districtName = (districts ?? []).find((d: any) => d.id === districtId)?.name;

  if (!s.isSuper && (!s.isManager || !districtId)) {
    return (<><h1 className="text-4xl">Welcome</h1><p className="mt-3 max-w-[60ch] text-[var(--color-muted)]">Use the menu to add activity reports for your district.</p></>);
  }
  const [{ data: st, error }, { data: don }, recent] = await Promise.all([
    c.rpc("overview_stats", { p_district: districtId }),
    s.isSuper ? c.rpc("donation_stats") : Promise.resolve({ data: null }),
    c.from("members").select("id,full_name,membership_id,created_at,districts(name)").eq("member_type", "volunteer").neq("status", "removed")
      .order("created_at", { ascending: false }).limit(6).then((r) => r.data ?? []),
  ]);
  if (error || !st) return <p className="notice notice-err">The dashboard figures could not be loaded: {error?.message ?? "no data"}. Check that migration 0005 has been applied.</p>;

  const tiles: [string, string | number, string][] = s.isSuper ? [
    ["Total volunteers", st.volunteers, "/admin/volunteers"], ["New volunteers this month", st.volunteers_month, "/admin/volunteers"],
    ["District Representatives", st.representatives, "/admin/manage/appointments"], [`Districts covered (of ${st.districts_total})`, st.districts_covered, "/admin/manage/appointments"],
    ["Pending representative applications", st.pending_applications, "/admin/applications"], ["Published activities", st.activities, "/admin/manage/activities"],
    ["Upcoming events", st.events_upcoming, "/admin/manage/events"],
    ["Verified donations this month", formatINR(don?.month.amount ?? 0), "/admin/donations?status=verified"], ["Verified donations this year", formatINR(don?.year.amount ?? 0), "/admin/donations?status=verified"],
  ] : [
    ["Total volunteers", st.volunteers, "/admin/volunteers"], ["New volunteers this month", st.volunteers_month, "/admin/volunteers"],
    ["Published activities", st.activities, "/admin/manage/activities"], ["Upcoming events", st.events_upcoming, "/admin/manage/events"],
  ];
  const months = (st.monthly_volunteers as { period: string; count: number }[]).map((m) => ({ label: periodLabel(m.period), value: m.count }));
  const donMonths = don ? [...don.monthly].slice(0, 6).reverse().map((m: any) => ({ label: periodLabel(m.period), value: Number(m.amount) })) : [];

  return (
    <>
      <h1 className="text-4xl">{s.isSuper ? "Founder dashboard" : `${districtName} district`}</h1>
      <p className="mt-2 text-[var(--color-muted)]">{s.isSuper ? "The whole foundation, counted live from the database." : "Your district, counted live from the database."}</p>
      {!s.isSuper && (districts ?? []).length > 1 && (
        <form className="mt-4 flex max-w-sm gap-2"><select name="district" defaultValue={districtId ?? ""} aria-label="District" className="field">{districts!.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><button className="btn btn-line btn-sm">Show</button></form>
      )}

      <ul className="mt-8 grid max-w-5xl gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map(([label, value, href]) => (
          <li key={label}>
            <Link href={href} className="block h-full rounded-xl border border-line p-5 hover:border-black">
              <span className="font-[family-name:var(--font-display)] text-4xl font-semibold">{value}</span>
              <span className="mt-1 block text-[0.95rem] text-[var(--color-muted)]">{label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid max-w-5xl gap-4 lg:grid-cols-2">
        <BarChart title="New volunteers, last six months" data={months} />
        {s.isSuper && <BarChart title="Verified donations, last six recorded months" data={donMonths} format={(n) => formatINR(n)} />}
      </div>

      <section className="mt-10 max-w-5xl">
        <div className="flex items-end justify-between"><h2 className="text-2xl">Newest volunteers</h2><Link href="/admin/volunteers" className="link">See all</Link></div>
        {recent.length ? (
          <div className="mt-3 overflow-x-auto"><table className="table">
            <thead><tr><th>Name</th><th>Membership ID</th><th>District</th><th>Joined</th></tr></thead>
            <tbody>{recent.map((m: any) => <tr key={m.id}><td className="font-medium">{m.full_name}</td><td>{m.membership_id}</td><td>{m.districts?.name}</td><td>{new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</td></tr>)}</tbody>
          </table></div>
        ) : <p className="mt-3 text-[var(--color-muted)]">No volunteers have registered yet.</p>}
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/admin/manage/activities/new" className="btn btn-leaf btn-sm">Add new activity</Link>
        <Link href="/admin/manage/events/new" className="btn btn-leaf btn-sm">Add new event</Link>
        <Link href="/admin/volunteers#add" className="btn btn-line btn-sm">Add volunteer</Link>
      </div>
    </>
  );
}
