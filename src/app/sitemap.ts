import type { MetadataRoute } from "next";
import { getDistricts, listActivities, listEvents } from "@/lib/data";
import { SITE_URL } from "@/lib/supabase/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [activities, events, districts] = await Promise.all([listActivities({ limit: 500 }), listEvents(), getDistricts()]);
  const fixed = ["", "/about", "/activities", "/events", "/network", "/donate", "/get-involved", "/privacy", "/terms"];
  return [
    ...fixed.map((p) => ({ url: `${SITE_URL}${p}` })),
    ...activities.map((a) => ({ url: `${SITE_URL}/activities/${a.slug}`, lastModified: a.updated_at })),
    ...[...events.upcoming, ...events.past].map((e) => ({ url: `${SITE_URL}/events/${e.slug}`, lastModified: e.updated_at })),
    ...districts.map((d) => ({ url: `${SITE_URL}/network/${d.slug}` })),
  ];
}
