import Link from "next/link";
import { retryNotification, sendQueuedNow } from "@/app/actions/admin";
import { Flash } from "@/components/admin/Flash";
import { requireSuper } from "@/lib/auth";
import { channelStatus } from "@/lib/notifications/process";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Email and WhatsApp" };
const LABEL: Record<string, string> = { queued: "Waiting to send", sending: "Sending", sent: "Sent", failed: "Failed" };
const STYLE: Record<string, string> = { queued: "bg-saffron-soft", sending: "bg-saffron-soft", sent: "bg-leaf-soft", failed: "bg-rose-100 text-kumkum" };

export default async function Notifications({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSuper();
  const ch = channelStatus();
  let q = s.supabase.from("notification_queue").select("*").order("created_at", { ascending: false }).limit(200);
  if (sp.status) q = q.eq("status", sp.status);
  const { data } = await q;
  return (
    <>
      <h1 className="text-4xl">Email and WhatsApp</h1>
      <p className="mt-2 max-w-[70ch] text-[var(--color-muted)]">Every message the website creates is listed here with its delivery status. Each message is created once per person per event, so nobody receives duplicates.</p>
      <div className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
        {[["Email (SMTP)", ch.email, "Add SMTP_HOST, SMTP_USER, SMTP_PASSWORD and EMAIL_FROM on the server."], ["WhatsApp Business Platform", ch.whatsapp, "Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID, and get the templates approved."]].map(([name, on, hint]) => (
          <div key={name as string} className={`rounded-xl border-l-4 p-4 ${on ? "border-leaf bg-leaf-soft" : "border-kumkum bg-rose-50"}`}>
            <p className="font-semibold">{name}</p>
            <p className="text-[0.95rem]">{on ? "Keys are present. Delivery is confirmed per message below." : `Not connected. ${hint} Messages wait here until then.`}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-5">
        <form action={sendQueuedNow}><button className="btn btn-leaf btn-sm">Send queued messages now</button></form>
        <p className="flex gap-4 text-sm">
          {[["", "All"], ["queued", "Waiting"], ["failed", "Failed"], ["sent", "Sent"]].map(([v, l]) => (
            <Link key={v} href={`/admin/notifications${v ? `?status=${v}` : ""}`} className={(sp.status ?? "") === v ? "font-semibold underline decoration-saffron decoration-[3px] underline-offset-4" : "underline"}>{l}</Link>
          ))}
        </p>
      </div>
      <div className="mt-6"><Flash params={sp} /></div>
      <div className="overflow-x-auto"><table className="table">
        <thead><tr><th>Message</th><th>Channel</th><th>Recipient</th><th>Created</th><th>Status</th><th>Failure reason</th><th /></tr></thead>
        <tbody>
          {(data ?? []).map((m: any) => (
            <tr key={m.id}>
              <td className="font-medium">{String(m.template).replace(/_/g, " ")}</td><td>{m.channel === "email" ? "Email" : "WhatsApp"}</td><td>{m.recipient}</td>
              <td className="whitespace-nowrap">{formatDateTime(m.created_at)}</td>
              <td><span className={`tag ${STYLE[m.status]}`}>{LABEL[m.status]}</span>{m.attempts > 0 && m.status !== "sent" && <span className="block text-xs text-[var(--color-muted)]">{m.attempts} attempt{m.attempts > 1 ? "s" : ""}</span>}</td>
              <td className="max-w-[280px] text-sm">{m.last_error}</td>
              <td>{m.status !== "sent" && <form action={retryNotification.bind(null, m.id)}><button className="btn btn-line btn-sm">Retry</button></form>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {(data ?? []).length === 0 && <p className="mt-4 text-[var(--color-muted)]">No messages yet.</p>}
    </>
  );
}