import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { hasSupabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/** Client bound to the visitor's session cookie. Row Level Security decides what it can do. */
export async function db(): Promise<SupabaseClient | null> {
  if (!hasSupabase) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* called from a Server Component: the proxy refreshes the session instead */ }
      },
    },
  });
}

/** Cookie-less anonymous client for public pages, so they can be cached. Sees published content only. */
let anon: SupabaseClient | null = null;
export function publicDb(): SupabaseClient | null {
  if (!hasSupabase) return null;
  anon ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return anon;
}

/** Service-role client. Bypasses Row Level Security: used only by the notification worker route. */
export function serviceDb(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
