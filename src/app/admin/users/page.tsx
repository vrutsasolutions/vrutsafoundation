import { grantRole, setRoleActive } from "@/app/actions/admin";
import { Flash } from "@/components/admin/Flash";
import { ConfirmButton, GrantRoleForm } from "@/components/admin/ui";
import { requireSuper } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Users and permissions" };

export default async function Users({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSuper();
  const c = s.supabase;
  let uq = c.from("profiles").select("id,full_name,email,phone,created_at,districts(name)").order("created_at", { ascending: false }).limit(200);
  if (sp.q) uq = uq.or(`email.ilike.%${sp.q.replace(/[%,()]/g, "")}%,full_name.ilike.%${sp.q.replace(/[%,()]/g, "")}%`);
  const [{ data: users }, { data: grants }, { data: roles }, { data: states }, { data: districts }] = await Promise.all([
    uq,
    c.from("user_roles").select("id,user_id,role_key,is_active,created_at,roles(name,rank),states(name),districts(name),profiles!user_roles_user_id_fkey(full_name,email)").order("created_at", { ascending: false }),
    c.from("roles").select("key,name,scope,rank").order("rank"),
    c.from("states").select("id,name").order("name"), c.from("districts").select("id,name").order("name"),
  ]);
  return (
    <>
      <h1 className="text-4xl">Users and permissions</h1>
      <p className="mt-2 max-w-[70ch] text-[var(--color-muted)]">
        Nobody can make themselves an administrator. A person registers on the website like anyone else, and you grant a role here.
        District roles can manage only their own district.
      </p>
      <div className="mt-6"><Flash params={sp} /></div>

      <h2 className="mb-3 mt-4 text-2xl">Grant a role</h2>
      <GrantRoleForm action={grantRole} roles={(roles ?? []) as any} states={states ?? []} districts={districts ?? []} />

      <h2 className="mb-3 mt-12 text-2xl">Administrators and team roles</h2>
      <div className="overflow-x-auto"><table className="table">
        <thead><tr><th>Person</th><th>Role</th><th>Area</th><th>Since</th><th>Status</th><th /></tr></thead>
        <tbody>
          {(grants ?? []).map((g: any) => (
            <tr key={g.id} className={g.is_active ? "" : "text-neutral-500"}>
              <td><span className="font-medium">{g.profiles?.full_name || "(no name)"}</span><br /><span className="text-sm">{g.profiles?.email}</span></td>
              <td>{g.roles?.name}</td><td>{g.districts?.name ?? g.states?.name ?? "Whole foundation"}</td>
              <td>{formatDate(g.created_at)}</td><td>{g.is_active ? "Active" : "Deactivated"}</td>
              <td className="text-right">
                <form action={setRoleActive.bind(null, g.id, !g.is_active)}>
                  {g.is_active ? <ConfirmButton message="Deactivate this role? The person loses these admin rights immediately.">Deactivate</ConfirmButton> : <button className="btn btn-line btn-sm">Reactivate</button>}
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      <h2 className="mb-3 mt-12 text-2xl">Registered users</h2>
      <form className="mb-4 flex max-w-md gap-2" role="search"><input name="q" defaultValue={sp.q ?? ""} placeholder="Search by name or email" aria-label="Search users" className="field" /><button className="btn btn-line btn-sm">Search</button></form>
      <div className="overflow-x-auto"><table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>District</th><th>Registered</th></tr></thead>
        <tbody>{(users ?? []).map((u: any) => <tr key={u.id}><td className="font-medium">{u.full_name}</td><td>{u.email}</td><td>{u.phone}</td><td>{u.districts?.name}</td><td>{formatDate(u.created_at)}</td></tr>)}</tbody>
      </table></div>
    </>
  );
}
