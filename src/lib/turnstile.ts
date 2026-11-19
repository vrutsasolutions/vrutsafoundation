import "server-only";
import { headers } from "next/headers";

/** Cloudflare Turnstile check for public forms. Passes when no secret is configured (local development). */
export async function verifyTurnstile(fd: FormData): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  const token = String(fd.get("cf-turnstile-response") ?? "");
  if (!token) return false;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
    });
    return Boolean((await res.json()).success);
  } catch { return false; }
}
