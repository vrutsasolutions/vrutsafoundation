import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { LOGO_JPG_BASE64 } from "./logo-data";
import { SITE_URL } from "./supabase/env";

// Built-in PDF fonts cover Latin text only; other scripts are replaced so the card always builds.
const safe = (s: unknown) => String(s ?? "").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
const date = (v: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(v));

export type CardData = {
  fullName: string; membershipId: string; role: string; district?: string | null; state?: string | null;
  joinedOn: string; verifyToken: string; photo?: { bytes: Uint8Array; type: "jpg" | "png" } | null;
};

export async function buildIdCardPdf(d: CardData): Promise<Uint8Array> {
  const W = 324, H = 510;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Vrutsa Foundation ID card ${d.membershipId}`);
  const page = pdf.addPage([W, H]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const saffron = rgb(0.94, 0.65, 0), leaf = rgb(0.06, 0.35, 0.12), black = rgb(0, 0, 0), grey = rgb(0.35, 0.35, 0.35), white = rgb(1, 1, 1);
  const centre = (text: string, y: number, size: number, font = regular, color = black) => {
    let t = safe(text);
    while (font.widthOfTextAtSize(t, size) > W - 40 && t.length > 4) t = `${t.slice(0, -2)}`;
    page.drawText(t, { x: (W - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color });
  };

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: white, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
  const logo = await pdf.embedJpg(Buffer.from(LOGO_JPG_BASE64, "base64"));
  const lw = 170, lh = (logo.height / logo.width) * lw;
  page.drawImage(logo, { x: (W - lw) / 2, y: H - 22 - lh, width: lw, height: lh });
  page.drawRectangle({ x: 0, y: H - 36 - lh, width: W, height: 4, color: saffron });

  const ps = 118, px = (W - ps) / 2, py = H - 58 - lh - ps;
  page.drawRectangle({ x: px - 3, y: py - 3, width: ps + 6, height: ps + 6, color: saffron });
  let drawn = false;
  if (d.photo) {
    try {
      const img = d.photo.type === "png" ? await pdf.embedPng(d.photo.bytes) : await pdf.embedJpg(d.photo.bytes);
      const scale = Math.max(ps / img.width, ps / img.height);   // cover the square; edges are clipped by the frame below
      const w = img.width * scale, h = img.height * scale;
      page.drawImage(img, { x: px + (ps - w) / 2, y: py + (ps - h) / 2, width: w, height: h });
      // mask anything outside the square
      page.drawRectangle({ x: 1, y: py - 3, width: px - 4, height: ps + 6, color: white });
      page.drawRectangle({ x: px + ps + 3, y: py - 3, width: W - px - ps - 4, height: ps + 6, color: white });
      page.drawRectangle({ x: px - 3, y: py + ps + 3, width: ps + 6, height: 14, color: white });
      page.drawRectangle({ x: px - 3, y: py - 17, width: ps + 6, height: 14, color: white });
      page.drawRectangle({ x: px - 3, y: py - 3, width: ps + 6, height: ps + 6, borderColor: saffron, borderWidth: 3 });
      drawn = true;
    } catch { /* unreadable photograph: fall through to the initial */ }
  }
  if (!drawn) {
    page.drawRectangle({ x: px, y: py, width: ps, height: ps, color: rgb(0.99, 0.95, 0.83) });
    const ini = safe(d.fullName).slice(0, 1).toUpperCase();
    page.drawText(ini, { x: px + (ps - bold.widthOfTextAtSize(ini, 56)) / 2, y: py + ps / 2 - 20, size: 56, font: bold, color: leaf });
  }

  let y = py - 34;
  centre(d.fullName, y, 18, bold);
  y -= 30;
  const rw = bold.widthOfTextAtSize(safe(d.role), 11) + 28;
  page.drawRectangle({ x: (W - rw) / 2, y: y - 6, width: rw, height: 22, color: leaf });
  centre(d.role, y, 11, bold, white);
  y -= 34;

  const qr = await pdf.embedPng(await QRCode.toBuffer(`${SITE_URL}/verify/${d.verifyToken}`, { margin: 0, width: 300, errorCorrectionLevel: "M" }));
  const qs = 84, qx = W - 28 - qs, qy = 58;
  const rows: [string, string][] = [["Membership ID", d.membershipId], ["District", d.district || "-"], ["State", d.state || "-"], ["Joined", date(d.joinedOn)]];
  let ry = qy + qs - 6;
  for (const [k, v] of rows) {
    page.drawText(k, { x: 28, y: ry, size: 7.5, font: regular, color: grey });
    page.drawText(safe(v).slice(0, 26), { x: 28, y: ry - 12, size: 10.5, font: bold, color: black });
    ry -= 27;
  }
  page.drawImage(qr, { x: qx, y: qy, width: qs, height: qs });
  page.drawText("Scan to verify", { x: qx + (qs - regular.widthOfTextAtSize("Scan to verify", 7.5)) / 2, y: qy - 11, size: 7.5, font: regular, color: grey });

  page.drawRectangle({ x: 0, y: 0, width: W, height: 30, color: leaf });
  centre("Official identification of Vrutsa Foundation", 11, 8.5, regular, white);
  return pdf.save();
}

/** Loads one member (through `client`, so Row Level Security applies) and builds their card. */
export async function memberIdCard(client: SupabaseClient, memberId: string) {
  const { data: m } = await client.from("members").select("*, districts(name), states(name)").eq("id", memberId).maybeSingle();
  if (!m) return null;
  let photo: CardData["photo"] = null;
  if (m.photo_path && /\.(jpe?g|png)$/i.test(m.photo_path)) {
    const { data } = await client.storage.from("private-uploads").download(m.photo_path);
    if (data) photo = { bytes: new Uint8Array(await data.arrayBuffer()), type: /\.png$/i.test(m.photo_path) ? "png" : "jpg" };
  }
  // Representatives appointed directly in the panel have a public profile photograph instead of a private upload.
  if (!photo && m.member_type === "district_representative" && m.user_id) {
    const { data: appt } = await client.from("regional_appointments").select("photo_url").eq("user_id", m.user_id).not("photo_url", "is", null).limit(1).maybeSingle();
    if (appt?.photo_url) {
      try {
        const res = await fetch(appt.photo_url);
        const type = res.headers.get("content-type") ?? "";
        if (res.ok && /image\/(jpeg|png)/.test(type)) photo = { bytes: new Uint8Array(await res.arrayBuffer()), type: type.includes("png") ? "png" : "jpg" };
      } catch { /* the card is issued without a photograph */ }
    }
  }
  const pdf = await buildIdCardPdf({
    fullName: m.full_name, membershipId: m.membership_id, verifyToken: m.verify_token, joinedOn: m.joined_on,
    role: m.member_type === "district_representative" ? "District Representative" : "Volunteer",
    district: (m as any).districts?.name, state: (m as any).states?.name, photo,
  });
  return { pdf, member: m };
}