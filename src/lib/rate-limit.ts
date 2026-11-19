import "server-only";
import { headers } from "next/headers";

// First line of defence for public forms: per-IP, in memory. On serverless hosting each instance
// keeps its own counter, so the database throttle (5 per email per hour) is the hard limit.
const hits = new Map<string, number[]>();

export async function rateLimit(bucket: string, max = 5, windowMs = 10 * 60_000): Promise<boolean> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const key = `${bucket}:${ip}`, now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t > windowMs)) hits.delete(k);
  return true;
}
