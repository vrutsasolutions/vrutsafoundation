import { randomUUID } from "crypto";
import { AwsClient } from "aws4fetch";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/supabase/server";

/* Public media uploads (slides, activity and event photographs and videos, posters, profile pictures,
   programme images, the donation QR).

   When the four R2_* variables are set, files go to Cloudflare R2: this route checks who is asking, then hands
   the browser a short-lived upload address, so the R2 keys never leave the server. Until they are set it answers
   { provider: "supabase" } and the browser uploads to Supabase Storage as before.

   Private files (ID photographs, application documents, payment screenshots, receipts) always stay in private
   Supabase Storage, because they must not be publicly readable. */

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm", "application/pdf": "pdf",
};
const MAX = 50 * 1024 * 1024;
const cfg = () => {
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: key, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET: bucket, NEXT_PUBLIC_R2_PUBLIC_URL: pub } = process.env;
  return account && key && secret && bucket && pub ? { account, key, secret, bucket, pub: pub.replace(/\/$/, "") } : null;
};
const client = (c: NonNullable<ReturnType<typeof cfg>>) => new AwsClient({ accessKeyId: c.key, secretAccessKey: c.secret, service: "s3", region: "auto" });

async function staff(manager = false) {
  const supabase = await db();
  const { data: { user } } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (!supabase || !user) return false;
  const { data } = await supabase.rpc(manager ? "is_manager" : "is_staff");
  return Boolean(data);
}

export async function POST(request: NextRequest) {
  const c = cfg();
  if (!c) return NextResponse.json({ provider: "supabase" });
  if (!(await staff())) return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  const { folder, contentType, size } = await request.json().catch(() => ({}));
  const ext = TYPES[String(contentType)];
  if (!ext) return NextResponse.json({ error: "This file type is not accepted." }, { status: 400 });
  if (!(Number(size) > 0) || Number(size) > MAX) return NextResponse.json({ error: "This file is larger than 50 MB." }, { status: 400 });
  const dir = String(folder ?? "uploads").replace(/[^a-z0-9/_-]/gi, "").replace(/^\/+|\/+$/g, "").slice(0, 80) || "uploads";
  const key = `${dir}/${randomUUID()}.${ext}`;
  const url = new URL(`https://${c.account}.r2.cloudflarestorage.com/${c.bucket}/${key}`);
  url.searchParams.set("X-Amz-Expires", "600");
  const signed = await client(c).sign(new Request(url, { method: "PUT", headers: { "content-type": String(contentType) } }), { aws: { signQuery: true } });
  return NextResponse.json({ provider: "r2", uploadUrl: signed.url, publicUrl: `${c.pub}/${key}` });
}

/** Remove a file from R2 (managers only). */
export async function DELETE(request: NextRequest) {
  const c = cfg();
  const target = request.nextUrl.searchParams.get("url") ?? "";
  if (!c || !target.startsWith(`${c.pub}/`)) return NextResponse.json({ ok: false });
  if (!(await staff(true))) return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  const key = target.slice(c.pub.length + 1).split("?")[0];
  if (!/^[\w\-./]+$/.test(key) || key.includes("..")) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const res = await client(c).fetch(`https://${c.account}.r2.cloudflarestorage.com/${c.bucket}/${key}`, { method: "DELETE" });
  return NextResponse.json({ ok: res.ok });
}