import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/supabase/server";
import { kickQueue } from "@/lib/notifications/process";

// Landing point for email confirmation and password-reset links.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = searchParams.get("next") ?? "/account";
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  const supabase = await db();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (supabase && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) { kickQueue(); return NextResponse.redirect(`${origin}${target}`); }   // email confirmed: the welcome mail and ID card are waiting
  }
  if (supabase && tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any });
    if (!error) { kickQueue(); return NextResponse.redirect(`${origin}${target}`); }
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}