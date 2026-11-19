"use server";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireManager, requireStaff, requireSuper, type Session } from "@/lib/auth";
import { serviceDb } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/supabase/env";
import { canAccess, RESOURCES } from "@/lib/resources";
import { ALL_SETTING_KEYS } from "@/lib/settings";
import { buildReceiptPdf } from "@/lib/receipt";
import { kickQueue, processQueue } from "@/lib/notifications/process";
import { fromISTInput, slugify } from "@/lib/utils";
import type { FormState } from "@/lib/types";

/* Every action checks the caller's role first for a clear message, then performs the write
   with the caller's own session, so Row Level Security makes the final decision. */

const friendly = (e: { code?: string; message: string }) => {
  if (e.code === "42501" || /row-level security|not authorised/i.test(e.message)) return "You do not have permission to do that.";
  if (e.code === "23505") return "Something with the same name already exists.";
  if (e.code === "23503") return "This is still in use elsewhere, so it cannot be removed.";
  if (e.code === "23514") return "Choose an activity or an event to attach this to.";
  return e.message;
};
function back(path: string, params: Record<string, string>): never {
  kickQueue();   // anything this action queued (welcome mails, ID cards, alerts) goes out straight away
  redirect(`${path}?${new URLSearchParams(params)}`);
}
const refreshSite = () => revalidatePath("/", "layout");

/* ───────────── Generic create / update / delete for the modules in lib/resources.ts ───────────── */
export async function saveResource(key: string, id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const r = RESOURCES[key];
  const s = await requireStaff();
  if (!r || !canAccess(r, s)) return { error: "You do not have permission to do that." };

  const row: Record<string, unknown> = {};
  for (const f of r.fields) {
    const raw = String(fd.get(f.name) ?? "").trim();
    if (f.required && !raw && f.type !== "checkbox") return { error: `${f.label} is required.` };
    switch (f.type) {
      case "checkbox": row[f.name] = fd.get(f.name) === "on"; break;
      case "number": row[f.name] = raw === "" ? (f.default !== undefined ? Number(f.default) : null) : Number(raw); break;
      case "datetime": row[f.name] = fromISTInput(raw); break;
      case "user": {
        if (!raw) { row[f.name] = null; break; }
        const { data } = await s.supabase.from("profiles").select("id").ilike("email", raw).maybeSingle();
        if (!data) return { error: `No registered account uses ${raw}. Ask the person to register first, or leave that field empty.` };
        row[f.name] = data.id; break;
      }
      default: row[f.name] = raw === "" ? null : raw;
    }
    if (typeof row[f.name] === "number" && Number.isNaN(row[f.name])) return { error: `${f.label} must be a number.` };
  }
  // A display window that is already over (or ends before it starts) would hide the item silently: say so instead.
  if ("publish_until" in row && row.publish_until) {
    const until = +new Date(String(row.publish_until));
    if (row.publish_from && until <= +new Date(String(row.publish_from)))
      return { error: "\"Stop showing after\" must be later than \"Start showing from\". Clear it to keep the slide on the homepage." };
    if (row.is_active !== false && until < Date.now())
      return { error: "\"Stop showing after\" is already in the past, so this slide would not appear on the homepage. Clear that date (press Clear under it) or choose a future date, then save." };
  }
  if (r.slugFrom && !id) row.slug = `${slugify(String(row[r.slugFrom]))}${r.publishable ? `-${randomBytes(2).toString("hex")}` : ""}`;
  if (key === "media") row.uploaded_by = s.user.id;

  const q = id ? s.supabase.from(r.table).update(row).eq("id", id).select("id") : s.supabase.from(r.table).insert(row).select("id");
  const { data, error } = await q;
  if (error) return { error: friendly(error) };
  if (!data?.length) return { error: "You do not have permission to change this item." };
  refreshSite();
  // New activities and events stay open so photographs and videos can be added next.
  redirect(!id && r.media ? `/admin/manage/${key}/${data[0].id}?saved=1` : `/admin/manage/${key}?saved=1`);
}

export async function deleteResource(key: string, id: string) {
  const r = RESOURCES[key];
  const s = await requireStaff();
  if (!r || !canAccess(r, s)) back(`/admin`, { error: "You do not have permission to do that." });
  const { data, error } = await s.supabase.from(r.table).delete().eq("id", id).select("id");
  if (error || !data?.length) back(`/admin/manage/${key}`, { error: error ? friendly(error) : "You do not have permission to delete this item." });
  refreshSite();
  back(`/admin/manage/${key}`, { saved: "1" });
}

/** Founder approval of content submitted by a district. */
export async function approveContent(key: string, id: string) {
  const r = RESOURCES[key];
  const s = await requireManager();
  if (!r?.publishable) return;
  const { error } = await s.supabase.from(r.table).update({ publish_status: "published" }).eq("id", id);
  refreshSite();
  back(`/admin/manage/${key}`, error ? { error: friendly(error) } : { saved: "1" });
}

/* ───────────── Website content and settings (founder) ───────────── */
export async function saveSettings(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireSuper();
  const rows = [...fd.entries()]
    .filter(([k, v]) => ALL_SETTING_KEYS.has(k) && typeof v === "string")
    .map(([key, value]) => ({ key, value: String(value).trim(), updated_by: s.user.id, updated_at: new Date().toISOString() }));
  const { error } = await s.supabase.from("foundation_settings").upsert(rows);
  if (error) return { error: friendly(error) };
  refreshSite();
  return { ok: true, message: "Saved. The website shows the new content now." };
}

/* ───────────── Members: volunteers and representatives ───────────── */
export async function addVolunteer(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireManager();
  const text = (k: string, max: number) => String(fd.get(k) ?? "").trim().replace(/[<>]/g, "").slice(0, max) || null;
  const full_name = text("full_name", 120), district_id = text("district_id", 36), phone = text("phone", 20);
  if (!full_name || !district_id) return { error: "Enter the volunteer's name and district." };
  if (phone) {
    const { data: taken } = await s.supabase.rpc("volunteer_phone_taken", { p_phone: phone });
    if (taken) return { error: "This mobile number is already registered." };
  }
  const { error } = await s.supabase.from("members").insert({
    membership_id: "", full_name, district_id, phone, email: text("email", 160)?.toLowerCase() ?? null,
    city: text("city", 80), occupation: text("occupation", 120), interest: text("interest", 300),
    date_of_birth: text("date_of_birth", 10), consent_contact: fd.get("consent_contact") === "on",
  });
  if (error) return { error: friendly(error) };
  revalidatePath("/admin/volunteers");
  kickQueue();
  return { ok: true, message: `${full_name} added. If an email address was given, the ID card is on its way.` };
}

export async function setMemberStatus(id: string, status: "active" | "suspended" | "removed", fd: FormData) {
  const s = await requireManager();
  const note = String(fd.get("note") ?? "").trim() || null;
  if (status !== "active" && !note) back("/admin/volunteers", { error: "Add a short reason. It is kept in the audit log." });
  const { data, error } = await s.supabase.from("members").update({ status, status_note: note }).eq("id", id).select("id");
  back("/admin/volunteers", error ? { error: friendly(error) } : !data?.length ? { error: "You cannot change this member." } : { saved: "1" });
}

export async function setMemberFlag(id: string, flagged: boolean) {
  const s = await requireManager();
  const { error } = await s.supabase.from("members").update({ flagged }).eq("id", id);
  back("/admin/volunteers", error ? { error: friendly(error) } : { saved: "1" });
}

/* ───────────── District Representative applications (founder) ───────────── */
export async function reviewRepApplication(id: string, status: "under_review" | "rejected", fd: FormData) {
  const s = await requireSuper();
  const { error } = await s.supabase.from("representative_applications")
    .update({ status, review_note: String(fd.get("note") ?? "").trim() || null }).eq("id", id).neq("status", "approved");
  back("/admin/applications", error ? { error: friendly(error) } : { saved: "1" });
}

/** Approve: create the login, publish the profile, grant district rights, issue the ID card. */
export async function approveRepApplication(id: string) {
  const s = await requireSuper();
  const svc = serviceDb();
  if (!svc) back("/admin/applications", { error: "Add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart the server. It is needed to create the representative's login." });
  const { data: app } = await s.supabase.from("representative_applications").select("*").eq("id", id).maybeSingle();
  if (!app) back("/admin/applications", { error: "Application not found." });

  // 1. Login: reuse an existing account for that email, otherwise create one. No password is ever emailed.
  let userId: string | undefined = (await s.supabase.from("profiles").select("id").ilike("email", app.email).maybeSingle()).data?.id;
  const link = await svc.auth.admin.generateLink({
    type: userId ? "recovery" : "invite", email: app.email,
    options: { redirectTo: `${SITE_URL}/auth/accept`, ...(userId ? {} : { data: { full_name: app.full_name, phone: app.phone } }) },
  } as any);
  if (link.error || !link.data?.user) back("/admin/applications", { error: `The login could not be created: ${link.error?.message ?? "unknown error"}` });
  userId = link.data.user!.id;
  const setPasswordLink = link.data.properties?.action_link ?? "";

  // 2. Public copy of the photograph for the profile page (the original stays private).
  let photoUrl: string | null = null;
  if (app.photo_path) {
    const file = await svc.storage.from("private-uploads").download(app.photo_path);
    if (file.data) {
      const ext = app.photo_path.split(".").pop();
      const path = `people/${app.id}.${ext}`;
      const up = await svc.storage.from("media").upload(path, file.data, { contentType: file.data.type || "image/jpeg", upsert: true });
      if (!up.error) photoUrl = svc.storage.from("media").getPublicUrl(path).data.publicUrl;
    }
  }

  // 3. Profile, rights, membership and ID card in one database transaction.
  const { error } = await s.supabase.rpc("approve_representative", { p_application: id, p_user: userId, p_photo_url: photoUrl });
  if (error) back("/admin/applications", { error: friendly(error) });

  // 4. Send the set-password link through our own mail queue.
  if (setPasswordLink) await svc.from("notification_queue").insert({
    channel: "email", template: "rep_login_link", recipient: app.email.toLowerCase(),
    payload: { name: app.full_name, link: setPasswordLink }, dedupe_key: `email:rep_login_link:${id}:${Date.now()}`,
  });
  refreshSite();
  back("/admin/applications", { status: "approved", notice: `Approved. ${app.full_name} now appears on the network page and will receive the ID card and a set-password link by email.`, link: setPasswordLink });
}

/* ───────────── Announcements ───────────── */
export async function sendAnnouncement(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireManager();
  const district = String(fd.get("district_id") ?? "") || null;
  if (!district && !s.isSuper) return { error: "Choose your district." };
  const { data, error } = await s.supabase.rpc("send_announcement", { p_title: String(fd.get("title") ?? ""), p_body: String(fd.get("body") ?? ""), p_district: district });
  if (error) return { error: friendly(error) };
  revalidatePath("/admin/announcements");
  kickQueue();
  return { ok: true, message: `Queued for ${data ?? 0} member${data === 1 ? "" : "s"}. Delivery status is under Email and WhatsApp.` };
}

/* ───────────── A representative's own public profile ───────────── */
export async function updateRepProfile(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireManager();
  const v = (k: string) => String(fd.get(k) ?? "").trim();
  const { data, error } = await s.supabase.rpc("update_my_rep_profile", {
    p_bio: v("bio"), p_experience: v("experience"), p_email: v("email"), p_phone: v("phone"),
    p_show_contact: fd.get("show_contact") === "on", p_photo_url: v("photo_url"),
  });
  if (error) return { error: friendly(error) };
  if (!data) return { error: "No active public profile is linked to your account. Ask the founder to link it." };
  refreshSite();
  return { ok: true, message: "Profile saved. It is live on your district page." };
}

/* ───────────── Donations (founder) ───────────── */
async function issueReceiptPdf(s: Session, submissionId: string) {
  const [{ data: sub }, { data: rec }, { data: settings }] = await Promise.all([
    s.supabase.from("donation_submissions").select("*").eq("id", submissionId).single(),
    s.supabase.from("donation_receipts").select("*").eq("submission_id", submissionId).single(),
    s.supabase.from("foundation_settings").select("key,value"),
  ]);
  if (!sub || !rec) throw new Error("The receipt record was not found.");
  const st = Object.fromEntries((settings ?? []).map((x) => [x.key, x.value ?? ""]));
  const pdf = await buildReceiptPdf({
    receiptNo: rec.receipt_no, issuedAt: rec.issued_at, donorName: sub.donor_name, amount: Number(sub.amount),
    paidOn: sub.paid_on, utr: sub.utr, reference: sub.reference, purpose: sub.purpose,
    orgName: st.org_name || "Vrutsa Foundation", address: st.address, registration: st.registration_details,
    signatory: st.receipt_signatory, contact: [st.email, st.phone].filter(Boolean).join("  |  "),
  });
  const path = `${rec.receipt_no}.pdf`;
  const up = await s.supabase.storage.from("receipts").upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (up.error) throw new Error(`The receipt PDF could not be stored: ${up.error.message}`);
  // Setting pdf_path is what queues the acknowledgement email / WhatsApp (database trigger).
  const { error } = await s.supabase.from("donation_receipts").update({ pdf_path: path }).eq("id", rec.id);
  if (error) throw new Error(error.message);
}

export async function verifyDonation(id: string, fd: FormData) {
  const s = await requireSuper();
  if (fd.get("checked") !== "on") back("/admin/donations", { error: "Tick the box to confirm you found this payment in the bank records." });
  const { error } = await s.supabase.rpc("verify_donation", { p_id: id, p_note: String(fd.get("note") ?? "").trim() || null });
  if (error) back("/admin/donations", { error: friendly(error) });
  try { await issueReceiptPdf(s, id); }
  catch (e: any) { back("/admin/donations", { status: "verified", error: `Verified, but the receipt was not created: ${e.message} Use "Create receipt again".` }); }
  refreshSite();
  back("/admin/donations", { status: "verified", saved: "1" });
}

export async function regenerateReceipt(id: string) {
  const s = await requireSuper();
  try { await issueReceiptPdf(s, id); }
  catch (e: any) { back("/admin/donations", { status: "verified", error: e.message }); }
  back("/admin/donations", { status: "verified", saved: "1" });
}

export async function rejectDonation(id: string, fd: FormData) {
  const s = await requireSuper();
  const note = String(fd.get("note") ?? "").trim();
  if (!note) back("/admin/donations", { error: "Add a short reason so the donor knows what to do next." });
  const { error } = await s.supabase.rpc("reject_donation", { p_id: id, p_note: note });
  back("/admin/donations", error ? { error: friendly(error) } : { status: "rejected", saved: "1" });
}

/** The founder records a donation seen in the bank statement. Public totals update immediately. */
export async function recordDonation(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireSuper();
  const v = (k: string) => String(fd.get(k) ?? "").trim();
  const amount = Number(v("amount"));
  if (!v("donor_name") || !(amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(v("paid_on")) || !/^[A-Za-z0-9]{6,30}$/.test(v("utr")))
    return { error: "Enter the donor name, a positive amount, the payment date and the bank reference (6 to 30 letters and digits)." };
  if (fd.get("checked") !== "on") return { error: "Tick the box to confirm this money is in the foundation's bank account." };
  const { data, error } = await s.supabase.rpc("record_donation", {
    p_name: v("donor_name"), p_amount: amount, p_paid_on: v("paid_on"), p_utr: v("utr"),
    p_email: v("email") || null, p_phone: v("phone") || null, p_purpose: v("purpose") || null, p_note: v("note") || null,
  });
  if (error) return { error: error.code === "23505" ? "A donation with this bank reference is already recorded." : friendly(error) };
  let extra = "";
  try { await issueReceiptPdf(s, data as string); } catch (e: any) { extra = ` The acknowledgement PDF was not created (${e.message}); use "Create receipt again".`; }
  refreshSite();
  kickQueue();
  return { ok: true, message: `Recorded.${extra}` };
}

export async function correctDonation(id: string, fd: FormData) {
  const s = await requireSuper();
  const { error } = await s.supabase.rpc("correct_donation", {
    p_id: id, p_amount: Number(fd.get("amount")), p_paid_on: String(fd.get("paid_on") ?? ""), p_note: String(fd.get("note") ?? ""),
  });
  if (!error) { try { await issueReceiptPdf(s, id); } catch { /* the old PDF stays until "Create receipt again" */ } }
  refreshSite();
  back("/admin/donations", error ? { status: "verified", error: friendly(error) } : { status: "verified", saved: "1" });
}

export async function voidDonation(id: string, fd: FormData) {
  const s = await requireSuper();
  const { error } = await s.supabase.rpc("void_donation", { p_id: id, p_note: String(fd.get("note") ?? "") });
  refreshSite();
  back("/admin/donations", error ? { status: "verified", error: friendly(error) } : { status: "rejected", saved: "1" });
}

/* ───────────── Administrators and permissions (founder) ───────────── */
export async function grantRole(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireSuper();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const role_key = String(fd.get("role_key") ?? "");
  const state_id = String(fd.get("state_id") ?? "") || null;
  const district_id = String(fd.get("district_id") ?? "") || null;
  const { data: role } = await s.supabase.from("roles").select("*").eq("key", role_key).maybeSingle();
  if (!role) return { error: "Choose a role." };
  if (role.scope === "state" && !state_id) return { error: `${role.name} needs a state.` };
  if (role.scope === "district" && !district_id) return { error: `${role.name} needs a district.` };
  const { data: profile } = await s.supabase.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (!profile) return { error: "No registered account uses that email address. The person must register on the website first." };

  const scope = { state_id: role.scope === "state" ? state_id : null, district_id: role.scope === "district" ? district_id : null };
  let find = s.supabase.from("user_roles").select("id").eq("user_id", profile.id).eq("role_key", role_key);
  find = scope.state_id ? find.eq("state_id", scope.state_id) : find.is("state_id", null);
  find = scope.district_id ? find.eq("district_id", scope.district_id) : find.is("district_id", null);
  const { data: existing } = await find.maybeSingle();
  const { error } = existing
    ? await s.supabase.from("user_roles").update({ is_active: true }).eq("id", existing.id)
    : await s.supabase.from("user_roles").insert({ user_id: profile.id, role_key, ...scope, assigned_by: s.user.id });
  if (error) return { error: friendly(error) };
  revalidatePath("/admin/users");
  return { ok: true, message: `${role.name} granted to ${email}.` };
}

export async function setRoleActive(id: string, active: boolean) {
  const s = await requireSuper();
  const { data: row } = await s.supabase.from("user_roles").select("user_id,role_key").eq("id", id).maybeSingle();
  if (row?.user_id === s.user.id && row.role_key === "super_admin" && !active)
    back("/admin/users", { error: "You cannot remove your own founder access." });
  const { error } = await s.supabase.from("user_roles").update({ is_active: active }).eq("id", id);
  back("/admin/users", error ? { error: friendly(error) } : { saved: "1" });
}

/* ───────────── Notifications ───────────── */
export async function sendQueuedNow() {
  const s = await requireSuper();
  let msg: Record<string, string>;
  try {
    const r = await processQueue(s.supabase, 25);
    msg = { result: `${r.claimed} picked up: ${r.sent} sent, ${r.retrying} will retry, ${r.failed} failed.` };
  } catch (e: any) { msg = { error: e.message }; }
  back("/admin/notifications", msg);
}

export async function retryNotification(id: string) {
  const s = await requireSuper();
  const { error } = await s.supabase.from("notification_queue")
    .update({ status: "queued", attempts: 0, last_error: null, next_attempt_at: new Date().toISOString() }).eq("id", id).neq("status", "sent");
  back("/admin/notifications", error ? { error: friendly(error) } : { result: "Queued again. Press “Send queued messages now” or wait for the scheduled run." });
}

export async function sendEventNotice(id: string, kind: "announcement" | "update") {
  const s = await requireManager();
  const { data, error } = await s.supabase.rpc("enqueue_event_notice", { p_event: id, p_kind: kind });
  back(`/admin/manage/events/${id}`, error ? { error: friendly(error) } : { notice: `${data ?? 0} ${kind === "announcement" ? "volunteers" : "registered people"} queued for this message.` });
}