"use server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { donationSchema, firstError, passwordSchema, registrationSchema, repApplicationSchema, volunteerRegisterSchema } from "@/lib/validation";
import { verifyTurnstile } from "@/lib/turnstile";
import { kickQueue } from "@/lib/notifications/process";
import { SITE_URL } from "@/lib/supabase/env";
import type { FormState } from "@/lib/types";

const NOT_CONNECTED = "The website is not connected to its database yet. Please try again later.";
const TOO_MANY = "Too many submissions from this connection. Please try again in a few minutes.";

function dbError(e: { code?: string; message: string }, duplicate: string) {
  if (e.code === "23505") return duplicate;
  if (/too many submissions/i.test(e.message)) return "Too many submissions. Please try again later.";
  console.error("[public form]", e.code, e.message);
  return "We could not save this. Please check the details and try again.";
}

/** Step 6 of the donation process. The result is always "pending verification", never "successful". */
export async function submitDonation(_: FormState, fd: FormData): Promise<FormState> {
  if (fd.get("website")) return { ok: true, reference: "VFD-RECEIVED" }; // honeypot: bots fill hidden fields
  if (!(await rateLimit("donation"))) return { error: TOO_MANY };
  if (!(await verifyTurnstile(fd))) return { error: "Please complete the security check and try again." };
  const parsed = donationSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await db();
  if (!supabase) return { error: NOT_CONNECTED };
  const { data: { user } } = await supabase.auth.getUser();

  const reference = `VFD-${randomBytes(5).toString("hex").toUpperCase()}`;
  const { error } = await supabase.from("donation_submissions").insert({ ...parsed.data, reference, user_id: user?.id ?? null });
  if (error) return { error: dbError(error, "This transaction reference (UTR) has already been submitted. If that was you, there is nothing more to do.") };
  kickQueue();
  return { ok: true, reference };
}

/** Volunteer registration: no manual approval. The database creates the membership, the ID and the notifications. */
export async function registerVolunteer(_: FormState, fd: FormData): Promise<FormState> {
  if (fd.get("website")) return { ok: true };
  if (!(await rateLimit("volunteer", 4))) return { error: TOO_MANY };
  if (!(await verifyTurnstile(fd))) return { error: "Please complete the security check and try again." };
  const parsed = volunteerRegisterSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await db();
  if (!supabase) return { error: NOT_CONNECTED };
  const { consent_contact: _c, email, ...details } = parsed.data;

  const { data: taken } = await supabase.rpc("volunteer_phone_taken", { p_phone: details.phone });
  if (taken) return { error: "This mobile number is already registered. Sign in to your account, or use Forgot password." };

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data, error } = await supabase.rpc("join_as_volunteer", { p: details });
    if (error) return { error: /already a member/i.test(error.message) ? "You are already registered. Your ID card is in your account." : dbError(error, "You are already registered.") };
    revalidatePath("/account");
    kickQueue();
    return { ok: true, reference: data as string, message: "signed-in" };
  }

  const parsedPw = passwordSchema.safeParse(fd.get("password"));
  if (!parsedPw.success) return { error: firstError(parsedPw.error) };
  const { data, error } = await supabase.auth.signUp({
    email, password: parsedPw.data,
    options: { data: { register_as: "volunteer", ...details }, emailRedirectTo: `${SITE_URL}/auth/callback?next=/account` },
  });
  if (error) return { error: /rate limit/i.test(error.message) ? "Too many registrations right now. Please try again in a few minutes." : error.message };
  // Supabase answers an already-registered email with an empty identity list instead of an error.
  if (data.user && (data.user.identities?.length ?? 0) === 0) return { error: "An account with this email address already exists. Sign in, then register as a volunteer from your account." };
  kickQueue();
  return { ok: true, message: data.session ? "signed-in" : "confirm-email" };
}

/** District Representative application. Stored for the founder only; nothing is approved automatically. */
export async function submitRepApplication(_: FormState, fd: FormData): Promise<FormState> {
  if (fd.get("website")) return { ok: true, reference: "DRA-RECEIVED" };
  if (!(await rateLimit("rep-application", 3))) return { error: TOO_MANY };
  if (!(await verifyTurnstile(fd))) return { error: "Please complete the security check and try again." };
  const parsed = repApplicationSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await db();
  if (!supabase) return { error: NOT_CONNECTED };
  const { consent: _c, document_path, ...row } = parsed.data;
  const reference = `DRA-${randomBytes(4).toString("hex").toUpperCase()}`;
  const { error } = await supabase.from("representative_applications").insert({ ...row, reference, documents: document_path ? [document_path] : [] });
  if (error) return { error: dbError(error, "We already have this application.") };
  kickQueue();
  return { ok: true, reference };
}

export async function registerForEvent(_: FormState, fd: FormData): Promise<FormState> {
  if (fd.get("website")) return { ok: true };
  if (!(await rateLimit("event"))) return { error: TOO_MANY };
  const parsed = registrationSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await db();
  if (!supabase) return { error: NOT_CONNECTED };
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("event_registrations").insert({ ...parsed.data, user_id: user?.id ?? null });
  if (error) return { error: dbError(error, "This email address is already registered for the event.") };
  kickQueue();
  return { ok: true };
}