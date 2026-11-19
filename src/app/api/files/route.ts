import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/supabase/server";

// Opens a private file (payment proof, applicant photograph, receipt) through a 60-second signed link.
// The link is created with the visitor's own session, so storage policies decide who may see what.
export async function GET(request: NextRequest) {
  const bucket = request.nextUrl.searchParams.get("bucket") ?? "";
  const path = request.nextUrl.searchParams.get("path") ?? "";
  if (!["private-uploads", "receipts"].includes(bucket) || !/^[\w\-./]+$/.test(path) || path.includes(".."))
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const supabase = await db();
  const { data: { user } } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (!supabase || !user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
