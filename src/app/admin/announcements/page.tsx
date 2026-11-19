import { sendAnnouncement } from "@/app/actions/admin";
import { AnnouncementForm } from "@/components/admin/forms";
import { requireManager } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Announcements" };

export default async function Announcements() {
  const s = await requireManager();
  let dq: any = s.supabase.from("districts").select("id,name").eq("is_active", true).order("name");
  if (!s.scope.all) dq = dq.in("id", s.scope.manage);
  const [{ data: districts }, { data: list }] = await Promise.all([
    dq, s.supabase.from("announcements").select("*, districts(name)").order("created_at", { ascending: false }).limit(50),
  ]);
  return (
    <>
      <h1 className="text-4xl">Announcements</h1>
      <p className="mb-8 mt-2 max-w-[70ch] text-[var(--color-muted)]">{s.isSuper ? "Write to every member, or to the members of one district." : "Write to the members of your district."}</p>
      <AnnouncementForm action={sendAnnouncement} districts={districts ?? []} allowAll={s.isSuper} />
      <h2 className="mb-3 mt-12 text-2xl">Sent</h2>
      {(list ?? []).length ? (
        <div className="max-w-4xl overflow-x-auto"><table className="table">
          <thead><tr><th>Sent</th><th>Subject</th><th>To</th><th className="text-right">Members</th></tr></thead>
          <tbody>{(list ?? []).map((a: any) => <tr key={a.id}><td className="whitespace-nowrap">{formatDateTime(a.created_at)}</td><td className="font-medium">{a.title}</td><td>{a.districts?.name ?? "Everyone"}</td><td className="text-right tabular-nums">{a.recipients}</td></tr>)}</tbody>
        </table></div>
      ) : <p className="text-[var(--color-muted)]">Nothing has been sent yet.</p>}
    </>
  );
}
