import { requireStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "My notifications" };

export default async function Inbox() {
  const s = await requireStaff();
  const mail = (s.profile?.email ?? s.user.email ?? "").toLowerCase();
  const { data } = await s.supabase.from("notification_queue").select("id,template,payload,status,created_at").eq("recipient", mail).order("created_at", { ascending: false }).limit(100);
  return (
    <>
      <h1 className="text-4xl">My notifications</h1>
      <p className="mb-8 mt-2 max-w-[70ch] text-[var(--color-muted)]">Every email the platform has created for {mail}: new volunteers in your district, removals and suspensions, announcements.</p>
      {(data ?? []).length ? (
        <ul className="max-w-3xl divide-y divide-line border-y border-line">
          {(data ?? []).map((m: any) => (
            <li key={m.id} className="py-3.5">
              <p className="text-sm text-[var(--color-muted)]">{formatDateTime(m.created_at)}, {m.status === "sent" ? "emailed" : m.status === "failed" ? "email failed" : "email waiting to be sent"}</p>
              <p className="font-medium">{m.payload?.title ?? String(m.template).replace(/_/g, " ")}</p>
              {Array.isArray(m.payload?.lines) && <ul className="mt-1 text-[0.95rem] text-[var(--color-muted)]">{m.payload.lines.map((l: string, i: number) => <li key={i}>{l}</li>)}</ul>}
            </li>
          ))}
        </ul>
      ) : <p className="text-[var(--color-muted)]">No notifications yet.</p>}
    </>
  );
}
