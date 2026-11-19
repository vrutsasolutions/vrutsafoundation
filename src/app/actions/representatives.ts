"use server";
import { redirect } from "next/navigation";
import { requireSuper } from "@/lib/auth";
import { kickQueue } from "@/lib/notifications/process";
import { SITE_URL } from "@/lib/supabase/env";
import { serviceDb } from "@/lib/supabase/server";

/* Login management for District Representatives. Founder only.
   No password is ever created or emailed here: the person receives a single-use link and chooses their own. */

const PAGE = "/admin/representatives";
function back(params: Record<string, string>): never {
  kickQueue();
  redirect(`${PAGE}?${new URLSearchParams(params)}`);
}
const NO_KEY = "Add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart the server. It is needed to manage other people's logins.";

/** Send (or send again) the set-password link. Creates the login if the person has none, links it to the
    appointment, grants the district role and issues the ID card. Also used for "Reset password". */
export async function sendRepLoginLink(appointmentId: string, kind: "invite" | "reset") {
  const s = await requireSuper();
  const svc = serviceDb();
  if (!svc) back({ error: NO_KEY });
  const { data: a } = await s.supabase.from("regional_appointments").select("id,full_name,email,user_id,status").eq("id", appointmentId).maybeSingle();
  if (!a) back({ error: "Appointment not found." });
  if (a.status !== "active") back({ error: "This appointment is inactive. Set it to Active first." });
  const email = String(a.email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) back({ error: `Add ${a.full_name}'s email address to the profile first (Edit profile).` });

  // Reuse an existing account for that email (for example a volunteer account), otherwise create one.
  let userId: string | null = a.user_id ?? (await s.supabase.from("profiles").select("id").ilike("email", email).maybeSingle()).data?.id ?? null;
  const link = await svc.auth.admin.generateLink({
    type: userId ? "recovery" : "invite", email,
    options: { redirectTo: `${SITE_URL}/auth/accept`, ...(userId ? {} : { data: { full_name: a.full_name } }) },
  } as any);
  if (link.error || !link.data?.user) back({ error: `The link could not be created: ${link.error?.message ?? "unknown error"}` });
  userId = link.data.user!.id;
  const url = link.data.properties?.action_link ?? "";

  const { error } = await s.supabase.rpc("link_representative_account", { p_appointment: a.id, p_user: userId });
  if (error) back({ error: /function .* does not exist|schema cache/i.test(error.message) ? "Run supabase/migrations/0006_update3.sql in the Supabase SQL Editor first." : error.message });

  await svc.from("notification_queue").insert({
    channel: "email", template: "rep_login_link", recipient: email,
    payload: { name: a.full_name, link: url, reset: kind === "reset" }, dedupe_key: `email:rep_login_link:${a.id}:${Date.now()}`,
  });
  back({
    notice: kind === "reset" ? `Password reset link sent to ${email}.` : `Login invitation sent to ${email}. The ID card follows in a separate email.`,
    link: url,
  });
}

export async function resendRepIdCard(appointmentId: string) {
  const s = await requireSuper();
  const { data: a } = await s.supabase.from("regional_appointments").select("user_id,full_name").eq("id", appointmentId).maybeSingle();
  if (!a?.user_id) back({ error: "Send the login invitation first. The ID card is created with the account." });
  const { data: m } = await s.supabase.from("members").select("id").eq("user_id", a.user_id).maybeSingle();
  if (!m) back({ error: "No membership record exists for this person. Send the login invitation to create it." });
  const { data, error } = await s.supabase.rpc("queue_id_card", { p_member: m.id });
  back(error ? { error: error.message } : data ? { notice: `ID card queued to ${a.full_name}'s email address.` } : { error: "The ID card could not be queued: the membership is not active or has no email address." });
}

/** Withdraw an invitation that has not been used yet: the link stops working and the district rights are removed. */
export async function revokeRepInvitation(appointmentId: string) {
  const s = await requireSuper();
  const svc = serviceDb();
  if (!svc) back({ error: NO_KEY });
  const { data: a } = await s.supabase.from("regional_appointments").select("user_id,full_name").eq("id", appointmentId).maybeSingle();
  if (!a?.user_id) back({ error: "There is no invitation to revoke." });
  const { data: u } = await svc.auth.admin.getUserById(a.user_id);
  if (u?.user?.last_sign_in_at) back({ error: `${a.full_name} has already activated the account. To stop access, suspend them under Volunteers and members.` });

  await s.supabase.from("regional_appointments").update({ user_id: null }).eq("id", appointmentId);   // removes the district role
  await s.supabase.from("members").delete().eq("user_id", a.user_id);
  const del = await svc.auth.admin.deleteUser(a.user_id);                                              // invalidates the link
  back(del.error ? { error: `Rights were removed, but the unused login could not be deleted: ${del.error.message}` }
                 : { notice: `Invitation revoked. ${a.full_name}'s public profile stays; send a new invitation whenever you are ready.` });
}