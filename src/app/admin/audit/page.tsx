import { requireSuper } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit log" };
const NAMES: Record<string, string> = { user_roles: "Role", regional_appointments: "Appointment", donation_submissions: "Donation", donation_verifications: "Donation check", donation_receipts: "Receipt",
  foundation_settings: "Setting", activities: "Activity", events: "Event", districts: "District", states: "State", volunteer_applications: "Volunteer application", roles: "Role definition" };
const VERB: Record<string, string> = { insert: "created", update: "changed", delete: "deleted" };

export default async function Audit() {
  const s = await requireSuper();
  const { data } = await s.supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
  const ids = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))];
  const { data: people } = ids.length ? await s.supabase.from("profiles").select("id,full_name,email").in("id", ids) : { data: [] };
  const who = (id: string | null) => { const p = (people ?? []).find((x) => x.id === id); return p ? p.full_name || p.email : id ? "Unknown user" : "System or public form"; };
  return (
    <>
      <h1 className="text-4xl">Audit log</h1>
      <p className="mb-8 mt-2 max-w-[70ch] text-[var(--color-muted)]">Written by the database itself whenever roles, appointments, donations, settings or published content change. It cannot be edited from the website.</p>
      <div className="overflow-x-auto"><table className="table">
        <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
        <tbody>
          {(data ?? []).map((r: any) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap">{formatDateTime(r.created_at)}</td><td>{who(r.actor_id)}</td>
              <td className="whitespace-nowrap font-medium">{NAMES[r.entity] ?? r.entity} {VERB[r.action]}</td>
              <td className="max-w-[520px] text-sm">
                {r.action === "update" && r.details
                  ? Object.entries(r.details).map(([k, v]: any) => <span key={k} className="mr-3 inline-block">{k}: {String(v[0] ?? "empty").slice(0, 40)} → {String(v[1] ?? "empty").slice(0, 40)}</span>)
                  : <span className="text-[var(--color-muted)]">{String(r.details?.title ?? r.details?.full_name ?? r.details?.name ?? r.details?.reference ?? r.details?.role_key ?? r.entity_id ?? "")}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
