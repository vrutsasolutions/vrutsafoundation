import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./supabase/server";

export type RoleRow = {
  role_key: string; state_id: string | null; district_id: string | null;
  roles: { name: string; rank: number; scope: string; can_manage: boolean; can_contribute: boolean };
};

/** Who is signed in and what they may touch. Mirrors the SQL helpers; the database still has the final say. */
export const getSession = cache(async () => {
  const supabase = await db();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles")
      .select("role_key,state_id,district_id,roles(name,rank,scope,can_manage,can_contribute)")
      .eq("user_id", user.id).eq("is_active", true),
  ]);
  const roles = ((roleRows ?? []) as unknown as RoleRow[]).sort((a, b) => a.roles.rank - b.roles.rank);

  const isSuper = roles.some((r) => r.role_key === "super_admin");
  const isManager = roles.some((r) => r.roles.can_manage);
  const isStaff = roles.some((r) => r.roles.can_manage || r.roles.can_contribute);
  const all = roles.some((r) => r.roles.scope === "global" && r.roles.can_manage);

  // Districts this person may manage / contribute to (ignored when `all` is true).
  const manage = new Set<string>(), contribute = new Set<string>();
  if (!all && isStaff) {
    const stateIds = roles.filter((r) => r.roles.scope === "state" && r.state_id).map((r) => r.state_id!);
    const { data: stateDistricts } = stateIds.length
      ? await supabase.from("districts").select("id,state_id").in("state_id", stateIds) : { data: [] };
    for (const r of roles) {
      const ids = r.roles.scope === "district" ? (r.district_id ? [r.district_id] : [])
        : (stateDistricts ?? []).filter((d) => d.state_id === r.state_id).map((d) => d.id as string);
      ids.forEach((id) => { contribute.add(id); if (r.roles.can_manage) manage.add(id); });
    }
  }
  return {
    supabase, user, profile, roles, isSuper, isManager, isStaff,
    scope: { all, manage: [...manage], contribute: [...contribute] },
    title: roles[0]?.roles.name ?? "Member",
  };
});
export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
export async function requireStaff() {
  const s = await requireUser();
  if (!s.isStaff) redirect("/account?notice=no-admin");
  return s;
}
export async function requireManager() {
  const s = await requireStaff();
  if (!s.isManager) redirect("/admin");
  return s;
}
export async function requireSuper() {
  const s = await requireStaff();
  if (!s.isSuper) redirect("/admin");
  return s;
}
