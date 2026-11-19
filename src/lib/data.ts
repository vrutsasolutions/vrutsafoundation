import "server-only";
import { cache } from "react";
import { publicDb } from "./supabase/server";
import { SETTING_DEFAULTS, type Settings } from "./settings";
import { eventStatus } from "./utils";

/* Public, read-only queries. They run as the anonymous role, so they can only
   ever return published content, whatever is asked for. */

type Row = Record<string, any>;
async function rows(build: (c: NonNullable<ReturnType<typeof publicDb>>) => PromiseLike<{ data: any; error: any }>): Promise<Row[]> {
  const c = publicDb();
  if (!c) return [];
  try {
    const { data, error } = await build(c);
    if (error) { console.error("[data]", error.message); return []; }
    return data ?? [];
  } catch (e) { console.error("[data]", e); return []; }
}

export const getSettings = cache(async (): Promise<Settings> => {
  const list = await rows((c) => c.from("foundation_settings").select("key,value").eq("is_public", true));
  const out: Settings = { ...SETTING_DEFAULTS };
  for (const r of list) if (r.value != null && r.value !== "") out[r.key] = r.value;
  return out;
});

export const getHeroSlides = async () => {
  const now = Date.now();
  return (await rows((c) => c.from("hero_slides").select("*").eq("is_active", true).order("sort_order").order("id").limit(4)))
    .filter((s) => (!s.publish_from || +new Date(s.publish_from) <= now) && (!s.publish_until || +new Date(s.publish_until) >= now));
};

export const getCategories = cache(() =>
  rows((c) => c.from("categories").select("*").eq("is_active", true).order("sort_order").order("name")));

export const getStates = cache(() => rows((c) => c.from("states").select("*").eq("is_active", true).order("name")));
export const getDistricts = cache(() =>
  rows((c) => c.from("districts").select("*, states(name)").eq("is_active", true).order("name")));
export const getDistrict = async (slug: string) =>
  (await rows((c) => c.from("districts").select("*, states(name)").eq("slug", slug).eq("is_active", true).limit(1)))[0] ?? null;

export const getLeaders = cache(() =>
  rows((c) => c.from("public_appointments").select("*").order("role_rank").order("appointed_on").limit(500)));

const ACTIVITY = "*, categories(name,slug), districts(name,slug)";
export type ActivityFilter = { category?: string; district?: string; year?: string; month?: string; limit?: number };
function activityQuery(c: NonNullable<ReturnType<typeof publicDb>>, f: ActivityFilter, count = false) {
  let q = c.from("activities").select(ACTIVITY, count ? { count: "exact" } : undefined).eq("publish_status", "published")
    .order("activity_date", { ascending: false }).order("created_at", { ascending: false });
  if (f.category) q = q.eq("category_id", f.category);
  if (f.district) q = q.eq("district_id", f.district);
  const y = f.year && /^\d{4}$/.test(f.year) ? Number(f.year) : null;
  const m = f.month && /^(0?[1-9]|1[0-2])$/.test(f.month) ? Number(f.month) : null;
  if (y && m) {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    q = q.gte("activity_date", `${y}-${String(m).padStart(2, "0")}-01`).lte("activity_date", `${y}-${String(m).padStart(2, "0")}-${last}`);
  } else if (y) q = q.gte("activity_date", `${y}-01-01`).lte("activity_date", `${y}-12-31`);
  return q;
}
export const listActivities = (f: ActivityFilter = {}) => rows((c) => activityQuery(c, f).limit(f.limit ?? 60));

/** One page of activities, newest first. A month chosen without a year is matched across all years. */
export async function pageActivities(f: ActivityFilter, page: number, size = 12) {
  const c = publicDb();
  if (!c) return { rows: [] as Row[], total: 0 };
  const monthOnly = f.month && !f.year;
  if (monthOnly) {
    // Rare combination: filter in memory over a bounded window instead of adding a generated column.
    const all = (await rows((cc) => activityQuery(cc, { ...f, month: undefined }).limit(1000)))
      .filter((a) => Number(String(a.activity_date).slice(5, 7)) === Number(f.month));
    return { rows: all.slice((page - 1) * size, page * size), total: all.length };
  }
  const { data, count, error } = await activityQuery(c, f, true).range((page - 1) * size, page * size - 1);
  if (error) { console.error("[data]", error.message); return { rows: [], total: 0 }; }
  return { rows: (data ?? []) as Row[], total: count ?? 0 };
}
export async function getActivity(slug: string) {
  const a = (await rows((c) => c.from("activities")
    .select(`${ACTIVITY}, events(title,slug)`)
    .eq("slug", slug).eq("publish_status", "published").limit(1)))[0];
  if (!a) return null;
  a.media = await rows((c) => c.from("activity_media").select("*").eq("activity_id", a.id).order("sort_order").order("created_at"));
  return a;
}
export const activityYears = async () => {
  const list = await rows((c) => c.from("activities").select("activity_date").eq("publish_status", "published"));
  return [...new Set(list.map((r) => String(r.activity_date).slice(0, 4)))].sort().reverse();
};

export async function listEvents(f: { district?: string } = {}) {
  const list = await rows((c) => {
    let q = c.from("events").select("*, districts(name,slug)").eq("publish_status", "published").order("starts_at", { ascending: false });
    if (f.district) q = q.eq("district_id", f.district);
    return q.limit(200);
  });
  const withStatus: Row[] = list.map((e) => ({ ...e, status: eventStatus(e as any) }));
  return {
    upcoming: withStatus.filter((e) => e.status === "upcoming").sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
    past: withStatus.filter((e) => e.status !== "upcoming"),
  };
}
export async function getEvent(slug: string) {
  const e = (await rows((c) => c.from("events").select("*, districts(name,slug)").eq("slug", slug).eq("publish_status", "published").limit(1)))[0];
  if (!e) return null;
  e.status = eventStatus(e as any);
  e.media = await rows((c) => c.from("activity_media").select("*").eq("event_id", e.id).order("sort_order").order("created_at"));
  return e;
}

export type DonationStats = {
  month: { donors: number; amount: number }; year: { donors: number; amount: number };
  total: { donors: number; amount: number; donations: number };
  monthly: { period: string; donors: number; amount: number }[]; yearly: { period: string; donors: number; amount: number }[];
  updated_at: string | null;
};

/** Cards for "What your donations support" on the Donate page. */
export const getProgrammes = () =>
  rows((c) => c.from("donation_programmes").select("*").eq("is_active", true).order("sort_order").order("title"));