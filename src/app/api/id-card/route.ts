import { NextResponse, type NextRequest } from "next/server";
import { memberIdCard } from "@/lib/idcard";
import { db } from "@/lib/supabase/server";

// ID card PDF. Built with the caller's session: a member gets their own card,
// a representative their district's, the founder anyone's. Suspended or removed members get no card.
export async function GET(request: NextRequest) {
  const supabase = await db();
  const { data: { user } } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (!supabase || !user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  let id = request.nextUrl.searchParams.get("member");
  if (!id) id = (await supabase.from("members").select("id").eq("user_id", user.id).maybeSingle()).data?.id ?? null;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const card = await memberIdCard(supabase, id);
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (card.member.status !== "active") return NextResponse.json({ error: "This membership is not active, so no ID card is issued." }, { status: 403 });
  return new NextResponse(Buffer.from(card.pdf), { headers: {
    "content-type": "application/pdf", "cache-control": "private, no-store",
    "content-disposition": `inline; filename="Vrutsa-ID-${card.member.membership_id}.pdf"`,
  } });
}
