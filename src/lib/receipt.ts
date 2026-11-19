import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { LOGO_JPG_BASE64 } from "./logo-data";

export type ReceiptData = {
  receiptNo: string; issuedAt: string; donorName: string; amount: number; paidOn: string;
  utr: string; reference: string; purpose?: string | null;
  orgName: string; address?: string; registration?: string; signatory?: string; contact?: string;
};

// The built-in PDF fonts cover Latin text only. Other scripts are replaced so the PDF never fails to build.
const safe = (s: unknown) => String(s ?? "").replace(/₹/g, "INR ").replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "?");
const money = (n: number) => `INR ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
const date = (v: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(v));

export async function buildReceiptPdf(d: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Donation acknowledgement ${d.receiptNo}`);
  pdf.setAuthor(safe(d.orgName));
  const page = pdf.addPage([595.28, 841.89]); // A4
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedJpg(Buffer.from(LOGO_JPG_BASE64, "base64"));
  const saffron = rgb(0.94, 0.65, 0), leaf = rgb(0.06, 0.35, 0.12), black = rgb(0, 0, 0), grey = rgb(0.38, 0.38, 0.38);
  const L = 56, R = 539.28;
  let y = 790;

  const lw = 190, lh = (logo.height / logo.width) * lw;
  page.drawImage(logo, { x: L, y: y - lh, width: lw, height: lh });
  const right = (text: string, yy: number, size: number, font = regular, color = black) =>
    page.drawText(safe(text), { x: R - font.widthOfTextAtSize(safe(text), size), y: yy, size, font, color });
  right("Donation acknowledgement", y - 22, 15, bold);
  right(d.receiptNo, y - 42, 11, regular, grey);
  y -= lh + 18;
  page.drawRectangle({ x: L, y, width: R - L, height: 3, color: saffron });
  y -= 26;

  const wrap = (text: string, size: number, width: number, font = regular) => {
    const out: string[] = [];
    for (const para of safe(text).split(/\n/)) {
      let line = "";
      for (const w of para.split(/\s+/)) {
        const t = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = w; } else line = t;
      }
      out.push(line);
    }
    return out;
  };
  page.drawText(safe(d.orgName), { x: L, y, size: 12, font: bold });
  y -= 16;
  for (const l of [...wrap(d.address ?? "", 9.5, 300), ...(d.registration ? wrap(d.registration, 9.5, 300) : []), ...(d.contact ? [d.contact] : [])].filter(Boolean)) {
    page.drawText(l, { x: L, y, size: 9.5, font: regular, color: grey }); y -= 13;
  }
  y -= 24;

  page.drawText("Received with thanks from", { x: L, y, size: 10, font: regular, color: grey });
  y -= 22;
  page.drawText(safe(d.donorName).slice(0, 60), { x: L, y, size: 18, font: bold });
  y -= 40;

  page.drawRectangle({ x: L, y: y - 46, width: R - L, height: 66, color: leaf });
  page.drawText("Amount received", { x: L + 18, y: y - 6, size: 10, font: regular, color: rgb(1, 1, 1) });
  page.drawText(money(d.amount), { x: L + 18, y: y - 32, size: 22, font: bold, color: rgb(1, 1, 1) });
  y -= 80;

  const rows: [string, string][] = [
    ["Acknowledgement number", d.receiptNo],
    ["Date of acknowledgement", date(d.issuedAt)],
    ["Payment date", date(d.paidOn)],
    ["Payment mode", "UPI / bank transfer to the foundation's bank account"],
    ["Transaction reference (UTR)", d.utr],
    ["Donation reference", d.reference],
    ...(d.purpose ? [["Purpose", d.purpose] as [string, string]] : []),
  ];
  for (const [k, v] of rows) {
    page.drawText(k, { x: L, y, size: 10, font: regular, color: grey });
    page.drawText(safe(v).slice(0, 62), { x: L + 190, y, size: 10.5, font: regular });
    y -= 10;
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    y -= 18;
  }
  y -= 14;
  for (const l of wrap("This contribution was verified against the foundation's bank records before this acknowledgement was issued.", 10, R - L)) {
    page.drawText(l, { x: L, y, size: 10, font: regular }); y -= 14;
  }
  y -= 50;
  page.drawLine({ start: { x: R - 200, y }, end: { x: R, y }, thickness: 0.8, color: black });
  right(d.signatory || "Authorised signatory", y - 14, 10, bold);
  right(`For ${d.orgName}`, y - 28, 9.5, regular, grey);

  const note = wrap("This is a computer-generated acknowledgement of a voluntary contribution. It is not a certificate for claiming an income-tax deduction.", 8.5, R - L);
  let fy = 62 + note.length * 11;
  page.drawLine({ start: { x: L, y: fy + 8 }, end: { x: R, y: fy + 8 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  for (const l of note) { fy -= 11; page.drawText(l, { x: L, y: fy, size: 8.5, font: regular, color: grey }); }
  return pdf.save();
}
