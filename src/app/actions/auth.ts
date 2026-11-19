"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/supabase/env";
import { rateLimit } from "@/lib/rate-limit";
import { firstError, passwordSchema, registerSchema } from "@/lib/validation";
import type { FormState } from "@/lib/types";

const NOT_CONNECTED = "The website is not connected to its database yet.";
const safeNext = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/account";
};

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimit("login", 8))) return { error: "Too many attempts. Please wait a few minutes." };
  const supabase = await db();
  if (!supabase) return { error: NOT_CONNECTED };
  const { error } = await supabase.auth.signInWithPassword({
    email: String(fd.get("email") ?? "").trim().toLowerCase(), password: String(fd.get("password") ?? ""),
  });
  if (error) return { error: /confirm/i.test(error.message) ? "Please confirm your email address first. Check your inbox." : "The email or password is not correct." };

  // The three doors lead to the same lock: what a person may do is decided by their role in the database.
  // This check only stops someone landing in a portal that is not theirs.
  const portal = String(fd.get("portal") ?? "member");
  const { data: { user } } = await supabase.auth.getUser();
  const { data: roles } = await supabase.from("user_roles").select("role_key,roles(can_manage)").eq("user_id", user!.id).eq("is_active", true);
  const isSuper = (roles ?? []).some((r) => r.role_key === "super_admin");
  const isManager = (roles ?? []).some((r: any) => r.roles?.can_manage);
  if (portal === "founder" && !isSuper) { await supabase.auth.signOut(); return { error: "This account does not have founder access. Choose the login that matches your role." }; }
  if (portal === "representative" && !isManager) { await supabase.auth.signOut(); return { error: "This account is not a District Representative account. If you applied, access starts after the founder approves your application." }; }
  const next = safeNext(fd.get("next"));
  redirect(next !== "/account" ? next : portal === "member" ? "/account" : "/admin");
}

/** Creates an ordinary account. Admin rights can only be granted later by the founder. */
export async function register(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimit("register", 4))) return { error: "Too many attempts. Please wait a few minutes." };
  const parsed = registerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await db();
  if (!supabase) return { error: NOT_CONNECTED };
  const { full_name, phone, email, password } = parsed.data;
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name, phone }, emailRedirectTo: `${SITE_URL}/auth/callback?next=/account` },
  });
  if (error) return { error: error.message };
  if (data.session) redirect("/account");
  return { ok: true, message: "Almost done. Open the confirmation link we sent to your email, then sign in." };
}

export async function logout() {
  const supabase = await db();
  await supabase?.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimit("reset", 3))) return { error: "Too many attempts. Please wait a few minutes." };
  const supabase = await db();
  if (!supabase) return { error: NOT_CONNECTED };
  await supabase.auth.resetPasswordForEmail(String(fd.get("email") ?? "").trim().toLowerCase(), {
    redirectTo: `${SITE_URL}/auth/callback?next=/account%3Fnotice%3Dset-password`,
  });
  return { ok: true, message: "If an account exists for that address, a reset link is on its way." };
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = passwordSchema.safeParse(fd.get("password"));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await db();
  if (!supabase) return { error: NOT_CONNECTED };
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  return error ? { error: error.message } : { ok: true, message: "Password changed." };
}

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await db();
  if (!supabase) return { error: NOT_CONNECTED };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const text = (k: string, max: number) => String(fd.get(k) ?? "").trim().replace(/[<>]/g, "").slice(0, max) || null;
  const { error } = await supabase.from("profiles").update({
    full_name: text("full_name", 120), phone: text("phone", 20), city: text("city", 80),
    state_id: text("state_id", 36), district_id: text("district_id", 36), updated_at: new Date().toISOString(),
  }).eq("id", user.id);
  if (error) return { error: "We could not save your profile." };
  revalidatePath("/account");
  return { ok: true, message: "Profile saved." };
}

/** A member updates the details they are allowed to change. The database ignores anything else. */
export async function updateMembership(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await db();
  if (!supabase) return { error: NOT_CONNECTED };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const text = (k: string, max: number) => String(fd.get(k) ?? "").trim().replace(/[<>]/g, "").slice(0, max) || null;
  const photo = String(fd.get("photo_path") ?? "");
  const { error } = await supabase.from("members").update({
    phone: text("phone", 20), city: text("city", 80), address: text("address", 400), occupation: text("occupation", 120),
    interest: text("interest", 300), skills: text("skills", 300), availability: text("availability", 160),
    whatsapp_opt_in: fd.get("whatsapp_opt_in") === "on",
    ...(/^applicants\/[\w-]+\.(jpg|jpeg|png)$/i.test(photo) ? { photo_path: photo } : {}),
  }).eq("user_id", user.id);
  if (error) return { error: "We could not save your details." };
  revalidatePath("/account");
  return { ok: true, message: "Details saved." };
}

export async function emailMyIdCard(_: FormState, __: FormData): Promise<FormState> {
  const supabase = await db();
  if (!supabase) return { error: NOT_CONNECTED };
  const { data, error } = await supabase.rpc("email_my_id_card");
  if (error || !data) return { error: "Your ID card could not be queued. It is available only for active memberships." };
  return { ok: true, message: "Your ID card will arrive by email shortly. It can be requested once a day." };
}
