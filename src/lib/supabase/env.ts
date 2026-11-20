export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const R2_PUBLIC_URL = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "").replace(/\/$/, "");
/** Website logo and icon, served from Cloudflare R2 (site-assets/) when R2 is configured, otherwise from /public. */
export const LOGO_URL = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/site-assets/logo.png` : "/logo.png";
export const ICON_URL = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/site-assets/icon.png` : "/icon.png";