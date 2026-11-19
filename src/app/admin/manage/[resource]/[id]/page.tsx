import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteResource, saveResource, sendEventNotice } from "@/app/actions/admin";
import { Flash } from "@/components/admin/Flash";
import { ConfirmButton, ResourceForm } from "@/components/admin/ui";
import { MediaManager } from "@/components/uploads";
import { requireStaff } from "@/lib/auth";
import { canAccess, RESOURCES } from "@/lib/resources";
import { formatDateTime } from "@/lib/utils";

type Props = { params: Promise<{ resource: string; id: string }>; searchParams: Promise<Record<string, string | undefined>> };
type Opt = { value: string; label: string };

export default async function ResourceEdit({ params, searchParams }: Props) {
  const [{ resource, id }, sp] = await Promise.all([params, searchParams]);
  const r = RESOURCES[resource];
  if (!r) notFound();
  const s = await requireStaff();
  if (!canAccess(r, s)) redirect("/admin");
  const isNew = id === "new";
  const c = s.supabase;

  let row: any = null;
  if (!isNew) {
    row = (await c.from(r.table).select(r.select).eq("id", id).maybeSingle()).data;
    if (!row) notFound();
  }

  // Menus offer only what this person may use: a district president sees only their own district.
  const refs = new Set(r.fields.filter((f) => f.type === "ref").map((f) => f.ref!));
  const options: Record<string, Opt[]> = {};
  const load = async (name: string, q: PromiseLike<{ data: any[] | null }>, label: (x: any) => string, value = "id") => {
    if (refs.has(name as any)) options[name] = ((await q).data ?? []).map((x) => ({ value: x[value], label: label(x) }));
  };
  let districts: any = c.from("districts").select("id,name").eq("is_active", true).order("name");
  if (!s.scope.all) districts = districts.in("id", r.key === "events" ? s.scope.manage : s.scope.contribute);
  await Promise.all([
    load("districts", districts, (x) => x.name),
    load("states", c.from("states").select("id,name").order("name"), (x) => x.name),
    load("categories", c.from("categories").select("id,name").order("sort_order"), (x) => x.name),
    load("roles", c.from("roles").select("key,name,rank").order("rank"), (x) => x.name, "key"),
    load("events", c.from("events").select("id,title").order("starts_at", { ascending: false }).limit(150), (x) => x.title),
    load("activities", c.from("activities").select("id,title").order("activity_date", { ascending: false }).limit(150), (x) => x.title),
  ]);

  const media = !isNew && r.media ? (await c.from("activity_media").select("*").eq(r.media, id).order("sort_order")).data ?? [] : [];
  const registrations = !isNew && r.key === "events"
    ? (await c.from("event_registrations").select("*").eq("event_id", id).order("created_at")).data ?? [] : [];

  return (
    <>
      <Link href={`/admin/manage/${r.key}`} className="link text-sm">Back to {r.title.toLowerCase()}</Link>
      <h1 className="mt-3 text-4xl">{isNew ? `Add ${r.singular}` : `Edit ${r.singular}`}</h1>
      {row?.publish_status === "pending" && <p className="notice notice-info mt-5 max-w-2xl">This is waiting for the founder&apos;s approval and is not visible on the website yet.</p>}
      <div className="mt-6"><Flash params={sp} /></div>

      <ResourceForm action={saveResource.bind(null, r.key, isNew ? null : id)} fields={r.fields} row={row} options={options} allowEmptyDistrict={s.scope.all} />

      {!isNew && r.media && (
        <section className="mt-14 max-w-3xl border-t border-line pt-8">
          <h2 className="mb-4 text-2xl">Photographs and videos</h2>
          <MediaManager column={r.media} id={id} initial={media} />
        </section>
      )}

      {!isNew && r.key === "events" && s.isManager && (
        <section className="mt-14 max-w-3xl border-t border-line pt-8">
          <h2 className="text-2xl">Messages about this event</h2>
          <p className="mt-2 text-[var(--color-muted)]">Messages are queued and appear under Email and WhatsApp. Each person receives each message once.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <form action={sendEventNotice.bind(null, id, "announcement")}><ConfirmButton message="Announce this event to approved volunteers of this district who agreed to be contacted?">Announce to district volunteers</ConfirmButton></form>
            <form action={sendEventNotice.bind(null, id, "update")}><ConfirmButton message="Tell everyone registered that the event details changed?">Send update to registered people</ConfirmButton></form>
          </div>
          <h3 className="mt-8 text-xl">Registrations ({registrations.length})</h3>
          {registrations.length > 0 && (
            <div className="mt-3 overflow-x-auto"><table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Registered</th></tr></thead>
              <tbody>{registrations.map((g: any) => <tr key={g.id}><td>{g.full_name}</td><td>{g.email}</td><td>{g.phone}</td><td>{formatDateTime(g.created_at)}</td></tr>)}</tbody>
            </table></div>
          )}
        </section>
      )}

      {!isNew && (s.isManager || row?.created_by === s.user.id) && (
        <form action={deleteResource.bind(null, r.key, id)} className="mt-14 max-w-2xl border-t border-line pt-6">
          <ConfirmButton message={`Delete this ${r.singular}? This cannot be undone.`} className="text-sm font-semibold text-kumkum underline">Delete this {r.singular}</ConfirmButton>
        </form>
      )}
    </>
  );
}
