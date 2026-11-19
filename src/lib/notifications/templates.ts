import { SITE_URL } from "../supabase/env";
import { formatDateTime, formatINR } from "../utils";

type P = Record<string, any>;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/* ── Email ─────────────────────────────────────────────────────────────── */
type Email = { subject: string; body: string; essential?: boolean };

const EMAILS: Record<string, (p: P) => Email> = {
  welcome: (p) => ({
    subject: "Welcome to Vrutsa Foundation",
    body: `<p>Hello ${esc(p.name) || "there"},</p><p>Your account is ready. You can apply to volunteer, follow your application and see your event registrations from your account page.</p><p><a href="${SITE_URL}/account">Open my account</a></p>`,
  }),
  volunteer_received: (p) => ({
    subject: "We received your volunteer application",
    body: `<p>Hello ${esc(p.name)},</p><p>Thank you for offering your time to Vrutsa Foundation. Your application has been received and will be reviewed by our team. We will write to you once a decision is made.</p>`,
  }),
  volunteer_approved: (p) => ({
    subject: "Your volunteer application is approved",
    body: `<p>Hello ${esc(p.name)},</p><p>Your application to volunteer with Vrutsa Foundation has been approved${p.district ? ` for <strong>${esc(p.district)}</strong>` : ""}. A coordinator will contact you about next steps.</p><p>If you have an account, sign in to see your responsibilities: <a href="${SITE_URL}/account">${SITE_URL}/account</a></p>`,
  }),
  leadership_appointment: (p) => ({
    subject: `Your appointment as ${p.role}`,
    body: `<p>Hello ${esc(p.name)},</p><p>You have been appointed as <strong>${esc(p.role)}</strong>${p.area ? ` for <strong>${esc(p.area)}</strong>` : ""} at Vrutsa Foundation.</p><p>Your public profile now appears on the network page: <a href="${SITE_URL}/network">${SITE_URL}/network</a></p>`,
  }),
  donation_received: (p) => ({
    subject: `Donation confirmation received (${p.reference})`,
    body: `<p>Hello ${esc(p.name)},</p><p>We have received your confirmation for a contribution of <strong>${formatINR(p.amount)}</strong> (transaction reference ${esc(p.utr)}).</p><p><strong>Status: pending verification.</strong> Our team will check it against the foundation's bank records. Once it is verified you will receive an acknowledgement. Your reference is <strong>${esc(p.reference)}</strong>.</p>`,
  }),
  donation_rejected: (p) => ({
    subject: `We could not verify your donation (${p.reference})`,
    body: `<p>Hello ${esc(p.name)},</p><p>We could not match your confirmation for ${formatINR(p.amount)} (reference ${esc(p.reference)}) with the foundation's bank records.</p>${p.note ? `<p>Note from our team: ${esc(p.note)}</p>` : ""}<p>If you did make this payment, please reply to this email with the transaction details and we will check again.</p>`,
  }),
  donation_acknowledgement: (p) => ({
    subject: `Donation acknowledgement ${p.receipt_no}`,
    body: `<p>Hello ${esc(p.name)},</p><p>Your contribution of <strong>${formatINR(p.amount)}</strong> has been verified against the foundation's bank records. Thank you.</p><p>Your acknowledgement <strong>${esc(p.receipt_no)}</strong> is attached to this email as a PDF.</p>`,
  }),
  volunteer_welcome: (p) => ({
    subject: `Welcome to Vrutsa Foundation. Your volunteer ID is ${p.membership_id}`,
    body: `<p>Hello ${esc(p.name)},</p><p>You are now a registered volunteer of Vrutsa Foundation${p.district ? ` in <strong>${esc(p.district)}</strong>` : ""}.</p><p>Your membership ID is <strong>${esc(p.membership_id)}</strong>. Your ID card is attached to this email as a PDF. You can also see and download it any time from your account.</p><p><a href="${SITE_URL}/account">Open my account</a></p>`,
  }),
  representative_welcome: (p) => ({
    subject: `Your appointment as District Representative${p.district ? `, ${p.district}` : ""}`,
    body: `<p>Hello ${esc(p.name)},</p><p>Your application has been approved. You are appointed as <strong>District Representative</strong>${p.district ? ` for <strong>${esc(p.district)}</strong>` : ""}.</p><p>Your membership ID is <strong>${esc(p.membership_id)}</strong> and your ID card is attached as a PDF.</p><p>A separate email contains the link to set your password. After that, sign in under "District Representative" to open your district dashboard: <a href="${SITE_URL}/login">${SITE_URL}/login</a></p>`,
  }),
  rep_login_link: (p) => ({
    subject: p.reset ? "Choose a new password for your Vrutsa Foundation account" : "Your Vrutsa Foundation District Representative login",
    body: `<p>Hello ${esc(p.name)},</p><p>${p.reset ? "A password reset was requested for your District Representative account." : "An account has been created for you as a District Representative of Vrutsa Foundation."} Use the button below to choose your password. The link works once and expires after a short time.</p><p><a href="${esc(p.link)}" style="display:inline-block;background:#0f5a1f;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">${p.reset ? "Choose a new password" : "Set my password"}</a></p><p>After that, sign in at <a href="${SITE_URL}/login?as=representative">${SITE_URL}/login</a> under "District Representative". If the link has expired, use "Forgot password" on that page.</p><p>If you did not expect this email, you can ignore it.</p>`,
  }),
  id_card: (p) => ({
    subject: `Your Vrutsa Foundation ID card (${p.membership_id})`,
    body: `<p>Hello ${esc(p.name)},</p><p>Your ID card is attached to this email as a PDF.</p>`,
  }),
  membership_update: (p) => ({
    subject: "An update about your Vrutsa Foundation membership",
    body: `<p>Hello ${esc(p.name)},</p><p>Your membership <strong>${esc(p.membership_id)}</strong> is now <strong>${esc({ active: "active", suspended: "suspended", removed: "closed" }[p.status as string] ?? p.status)}</strong>.</p>${p.status === "active" ? "" : "<p>While a membership is suspended or closed, its ID card is not valid. If you believe this is a mistake, reply to this email.</p>"}`,
  }),
  rep_application_received: (p) => ({
    subject: `We received your District Representative application (${p.reference})`,
    body: `<p>Hello ${esc(p.name)},</p><p>Thank you for applying to represent Vrutsa Foundation${p.district ? ` in <strong>${esc(p.district)}</strong>` : ""}. Your application reference is <strong>${esc(p.reference)}</strong>.</p><p>The founder reviews every application personally. We will write to you with the decision.</p>`,
  }),
  rep_application_rejected: (p) => ({
    subject: `About your District Representative application (${p.reference})`,
    body: `<p>Hello ${esc(p.name)},</p><p>Thank you for your interest in representing Vrutsa Foundation. After review, we are not able to take your application (${esc(p.reference)}) forward at this time.</p><p>You are welcome to join as a volunteer: <a href="${SITE_URL}/get-involved">${SITE_URL}/get-involved</a></p>`,
  }),
  founder_alert: (p) => ({
    subject: String(p.title),
    body: `<p><strong>${esc(p.title)}</strong></p>${(p.lines ?? []).length ? `<ul>${(p.lines as string[]).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}<p><a href="${SITE_URL}/admin">Open the admin panel</a></p>`,
  }),
  rep_alert: (p) => ({
    subject: String(p.title),
    body: `<p><strong>${esc(p.title)}</strong></p>${(p.lines ?? []).length ? `<ul>${(p.lines as string[]).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}<p><a href="${SITE_URL}/admin">Open my district dashboard</a></p>`,
  }),
  announcement: (p) => ({
    essential: false,
    subject: String(p.title),
    body: `<p>Hello ${esc(p.name)},</p>${String(p.body ?? "").split(/\n{2,}/).map((x) => `<p>${esc(x).replace(/\n/g, "<br>")}</p>`).join("")}`,
  }),
  event_registration: (p) => ({
    subject: `You are registered: ${p.event}`,
    body: `<p>Hello ${esc(p.name)},</p><p>You are registered for <strong>${esc(p.event)}</strong>.</p><p>${formatDateTime(p.starts_at)}${p.venue ? `<br>${esc(p.venue)}` : ""}</p><p><a href="${SITE_URL}/events/${esc(p.slug)}">Event details</a></p>`,
  }),
  event_announcement: (p) => ({
    essential: false,
    subject: `New event: ${p.event}`,
    body: `<p>Hello ${esc(p.name)},</p><p>Vrutsa Foundation has announced <strong>${esc(p.event)}</strong>.</p><p>${formatDateTime(p.starts_at)}${p.venue ? `<br>${esc(p.venue)}` : ""}</p><p><a href="${SITE_URL}/events/${esc(p.slug)}">Event details</a></p>`,
  }),
  event_update: (p) => ({
    subject: p.cancelled ? `Cancelled: ${p.event}` : `Updated details: ${p.event}`,
    body: `<p>Hello ${esc(p.name)},</p><p>${p.cancelled ? `<strong>${esc(p.event)}</strong> has been cancelled.` : `The details of <strong>${esc(p.event)}</strong> have changed. Please check the latest date, time and venue.`}</p><p><a href="${SITE_URL}/events/${esc(p.slug)}">Event details</a></p>`,
  }),
  event_reminder: (p) => ({
    subject: `Reminder: ${p.event}`,
    body: `<p>Hello ${esc(p.name)},</p><p>This is a reminder for <strong>${esc(p.event)}</strong>.</p><p>${formatDateTime(p.starts_at)}${p.venue ? `<br>${esc(p.venue)}` : ""}</p><p><a href="${SITE_URL}/events/${esc(p.slug)}">Event details</a></p>`,
  }),
};

export function renderEmail(template: string, payload: P) {
  const t = EMAILS[template]?.(payload);
  if (!t) return null;
  const footer = t.essential === false && payload.unsubscribe_token
    ? `<p style="margin:0">You receive announcements because you agreed to be contacted. <a href="${SITE_URL}/unsubscribe?token=${esc(payload.unsubscribe_token)}" style="color:#555">Stop these emails</a></p>`
    : `<p style="margin:0">This message is about something you did on the Vrutsa Foundation website.</p>`;
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#000;line-height:1.55">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<img src="${SITE_URL}/logo.png" alt="Vrutsa Foundation" width="160" style="display:block;margin:0 0 20px">
<div style="height:3px;background:#F0A500;margin:0 0 24px"></div>
<div style="font-size:16px">${t.body}</div>
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #ddd;font-size:12px;color:#555">${footer}</div>
</div></body></html>`;
  return { subject: t.subject, html };
}

/* ── WhatsApp ──────────────────────────────────────────────────────────────
   Each entry is a template that must be created and approved in WhatsApp Manager
   with EXACTLY this name and this number of {{n}} body variables, in this order.
   Suggested wording is in docs/OPERATIONS.md. WhatsApp is used for volunteers and donors only;
   the founder and district representatives are always notified by email. */
export const WHATSAPP_TEMPLATES: Record<string, { name: string; params: (p: P) => string[] }> = {
  volunteer_received:       { name: "vf_volunteer_received",   params: (p) => [p.name] },
  volunteer_approved:       { name: "vf_volunteer_approved",   params: (p) => [p.name, p.district || "your district"] },
  volunteer_welcome:        { name: "vf_volunteer_welcome",    params: (p) => [p.name, p.membership_id] },
  membership_update:        { name: "vf_membership_update",    params: (p) => [p.name, p.membership_id, p.status] },
  announcement:             { name: "vf_announcement",         params: (p) => [p.title, String(p.body ?? "").replace(/\s+/g, " ").slice(0, 180)] },
  event_announcement:       { name: "vf_event_announcement",   params: (p) => [p.event, formatDateTime(p.starts_at), p.venue || "Venue to be announced"] },
  event_update:             { name: "vf_event_update",         params: (p) => [p.event, p.cancelled ? "This event has been cancelled" : formatDateTime(p.starts_at)] },
  event_reminder:           { name: "vf_event_reminder",       params: (p) => [p.event, formatDateTime(p.starts_at), p.venue || "Venue to be announced"] },
  event_registration:       { name: "vf_event_registration",   params: (p) => [p.name, p.event, formatDateTime(p.starts_at)] },
  donation_received:        { name: "vf_donation_received",    params: (p) => [p.name, formatINR(p.amount), p.reference] },
  donation_acknowledgement: { name: "vf_donation_acknowledgement", params: (p) => [p.name, formatINR(p.amount), p.receipt_no] },
  donation_rejected:        { name: "vf_donation_not_verified", params: (p) => [p.name, p.reference] },
};