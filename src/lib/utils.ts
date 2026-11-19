const TZ = "Asia/Kolkata";

export const formatDate = (v?: string | null) =>
  v ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(new Date(v)) : "";

export const formatDateTime = (v?: string | null) =>
  v ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(v)) : "";

export const dateParts = (v: string) => {
  const d = new Date(v);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { ...o, timeZone: TZ }).format(d);
  return { day: f({ day: "2-digit" }), month: f({ month: "short" }), year: f({ year: "numeric" }), time: f({ hour: "numeric", minute: "2-digit" }) };
};

export const formatINR = (n: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n));

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "item";

export type EventStatus = "upcoming" | "completed" | "cancelled";
/** Mirrors the SQL function public.event_status(). */
export function eventStatus(e: { is_cancelled: boolean; starts_at: string; ends_at?: string | null }): EventStatus {
  if (e.is_cancelled) return "cancelled";
  const end = e.ends_at ? new Date(e.ends_at).getTime() : new Date(e.starts_at).getTime() + 6 * 3600_000;
  return end < Date.now() ? "completed" : "upcoming";
}

/** <input type="datetime-local"> has no time zone; the admin panel works in Indian Standard Time. */
export const toISTInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600_000);
  return d.toISOString().slice(0, 16);
};
export const fromISTInput = (local: string) => (local ? new Date(`${local}:00+05:30`).toISOString() : null);

export function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

export const paragraphs = (text?: string | null) => (text ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
export const lines = (text?: string | null) => (text ?? "").split(/\n/).map((p) => p.trim()).filter(Boolean);
