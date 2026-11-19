import { NextResponse, type NextRequest } from "next/server";
import { processQueue } from "@/lib/notifications/process";
import { serviceDb } from "@/lib/supabase/server";

// The notification worker. Call it on a schedule (Vercel Cron, Supabase pg_cron + pg_net, or any
// scheduler) with the header  Authorization: Bearer <CRON_SECRET>.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const client = serviceDb();
  if (!client) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 503 });
  try { return NextResponse.json(await processQueue(client, 40)); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
export const GET = run;
export const POST = run;
