import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { serviceDb } from "../supabase/server";
import { renderEmail, WHATSAPP_TEMPLATES } from "./templates";
import { memberIdCard } from "../idcard";

const CARD_TEMPLATES = ["volunteer_welcome", "representative_welcome", "id_card"];

export const channelStatus = () => ({
  email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  whatsapp: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
});

class NotConfigured extends Error {}
const MAX_ATTEMPTS = 5;

async function sendEmail(client: SupabaseClient, job: any) {
  if (!channelStatus().email) throw new NotConfigured("Email is not configured: set RESEND_API_KEY and EMAIL_FROM");
  const mail = renderEmail(job.template, job.payload ?? {});
  if (!mail) throw new NotConfigured(`No email template named "${job.template}"`);

  const attachments: { filename: string; content: string }[] = [];
  if (job.template === "donation_acknowledgement" && job.payload?.pdf_path) {
    const { data, error } = await client.storage.from("receipts").download(job.payload.pdf_path);
    if (error || !data) throw new Error(`Receipt PDF could not be read: ${error?.message ?? "missing"}`);
    attachments.push({ filename: `${job.payload.receipt_no}.pdf`, content: Buffer.from(await data.arrayBuffer()).toString("base64") });
  }
  if (CARD_TEMPLATES.includes(job.template) && job.payload?.member_id) {
    const card = await memberIdCard(client, job.payload.member_id);
    if (!card) throw new Error("The member record for this ID card was not found");
    attachments.push({ filename: `Vrutsa-ID-${card.member.membership_id}.pdf`, content: Buffer.from(card.pdf).toString("base64") });
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": job.id },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM, to: [job.recipient], subject: mail.subject, html: mail.html, attachments,
      ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function sendWhatsApp(job: any) {
  if (!channelStatus().whatsapp) throw new NotConfigured("WhatsApp is not configured: set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID");
  const t = WHATSAPP_TEMPLATES[job.template];
  if (!t) throw new NotConfigured(`No WhatsApp template mapped for "${job.template}"`);
  let to = String(job.recipient).replace(/\D/g, "");
  if (to.length === 10) to = `91${to}`;
  const version = process.env.WHATSAPP_API_VERSION ?? "v21.0";
  const res = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to, type: "template",
      template: {
        name: t.name, language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "en" },
        components: [{ type: "body", parameters: t.params(job.payload ?? {}).map((text) => ({ type: "text", text: String(text ?? "").slice(0, 200) })) }],
      },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** Sends one batch from the queue. `client` must be the service-role client or the founder's session. */
export async function processQueue(client: SupabaseClient, limit = 20) {
  const result = { claimed: 0, sent: 0, failed: 0, retrying: 0, reminders: 0 };
  const { data: reminders } = await client.rpc("enqueue_event_reminders");
  result.reminders = reminders ?? 0;

  const { data: jobs, error } = await client.rpc("claim_notifications", { p_limit: limit });
  if (error) throw new Error(error.message);
  result.claimed = jobs?.length ?? 0;

  for (const job of jobs ?? []) {
    let status = "sent", err: string | null = null, next: string | null = null;
    try {
      if (job.channel === "email") await sendEmail(client, job); else await sendWhatsApp(job);
      result.sent++;
    } catch (e: any) {
      err = String(e?.message ?? e).slice(0, 500);
      // A missing integration will not fix itself: stop, and let an admin press Retry once it is set up.
      if (e instanceof NotConfigured || job.attempts >= MAX_ATTEMPTS) { status = "failed"; result.failed++; }
      else { status = "queued"; next = new Date(Date.now() + 2 ** job.attempts * 5 * 60_000).toISOString(); result.retrying++; }
    }
    await client.from("notification_queue").update({
      status, last_error: err, sent_at: status === "sent" ? new Date().toISOString() : null,
      ...(next ? { next_attempt_at: next } : {}),
    }).eq("id", job.id);
    await client.from("notification_logs").insert({
      queue_id: job.id, channel: job.channel, template: job.template, recipient: job.recipient,
      status: status === "queued" ? "retry_scheduled" : status, error: err,
    });
  }
  return result;
}

/** Sends whatever is waiting, right after the current request has been answered, so people do not wait
    for the scheduled run. Does nothing until the service key and an email provider are configured. */
export function kickQueue() {
  const client = serviceDb();
  if (!client || !channelStatus().email) return;
  try {
    after(async () => { try { await processQueue(client, 25); } catch (e) { console.error("[notifications]", e); } });
  } catch { /* called outside a request: the scheduled run will pick the messages up */ }
}