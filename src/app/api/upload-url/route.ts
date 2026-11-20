import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/supabase/server";
import { PUBLIC_TYPES, cleanFolder, deleteObject, headObject, keyFromPublicUrl, missingR2Vars, presignPut, publicUrlFor, r2Config, safeKey } from "@/lib/r2";

/* Public media uploads go to Cloudflare R2 only: homepage slides, activity and event photographs and videos,
   posters, profile pictures, category and programme images, About-page photographs, the donation QR, GIFs.

   1. POST { folder, contentType, size }           → checks the person is staff, returns a 10-minute upload address.
   2. The browser PUTs the file straight to R2 (the R2 keys never leave this server).
   3. POST { action: "confirm", key }              → checks the stored file's size and type, returns its public URL.
   DELETE ?url=<public URL>                         → managers only; removes the file from R2 and confirms it is gone.

   There is no fallback to Supabase Storage for public files. Private files (ID photographs, application documents,
   payment proofs, receipts) never come through here: they stay in the private Supabase buckets. */

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

async function allowed(manager = false) {
  const supabase = await db();
  const { data: { user } } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (!supabase || !user) return false;
  const { data } = await supabase.rpc(manager ? "is_manager" : "is_staff");
  return Boolean(data);
}

function notConfigured() {
  const missing = missingR2Vars();
  console.error("[upload] Cloudflare R2 is not configured. Missing:", missing.join(", "));
  return json({ error: `Uploads are switched off: Cloudflare R2 is not configured on the server (missing ${missing.join(", ")}). Add them to .env.local and restart.` }, 503);
}

export async function POST(request: NextRequest) {
  const c = r2Config();
  if (!c) return notConfigured();
  if (!(await allowed())) return json({ error: "You are not allowed to upload files." }, 403);
  const body = await request.json().catch(() => ({}));

  // Step 3: confirm an upload that the browser has finished.
  if (body?.action === "confirm") {
    const key = String(body.key ?? "");
    if (!safeKey(key) || !cleanFolder(key.split("/").slice(0, -1).join("/"))) return json({ error: "Invalid file reference." }, 400);
    try {
      const obj = await headObject(c, key);
      if (!obj) return json({ error: "The file did not arrive in Cloudflare R2. Please try again." }, 409);
      const type = PUBLIC_TYPES[obj.contentType.split(";")[0].trim()];
      if (!type || obj.size === 0 || obj.size > type.max) {
        await deleteObject(c, key).catch(() => {});
        return json({ error: "The stored file failed the type or size check and was removed." }, 400);
      }
      return json({ publicUrl: publicUrlFor(c, key) });
    } catch (e) {
      console.error("[upload] confirm failed", e);
      return json({ error: "Cloudflare R2 could not be reached to confirm the upload. Please try again." }, 502);
    }
  }

  // Step 1: hand out an upload address.
  const contentType = String(body?.contentType ?? "");
  const type = PUBLIC_TYPES[contentType];
  if (!type) return json({ error: "This file type is not accepted. Use JPEG, PNG, WebP, GIF, MP4, WebM or PDF." }, 400);
  const size = Number(body?.size);
  if (!(size > 0)) return json({ error: "The file is empty." }, 400);
  if (size > type.max) return json({ error: `This file is larger than ${Math.round(type.max / 1024 / 1024)} MB.` }, 400);
  const folder = cleanFolder(body?.folder);
  if (!folder) return json({ error: "Uploads are not allowed into that folder." }, 400);
  const key = `${folder}/${randomUUID()}.${type.ext}`;      // unique name: nothing is ever overwritten
  try {
    return json({ uploadUrl: await presignPut(c, key, contentType), key, contentType });
  } catch (e) {
    console.error("[upload] signing failed", e);
    return json({ error: "The upload address could not be created. Check the R2 settings on the server." }, 500);
  }
}

/** Remove a public file (managers only). */
export async function DELETE(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url") ?? "";
  if (!(await allowed(true))) return json({ error: "Only the founder or a District Representative can delete files." }, 403);
  // Old Supabase copies are kept on purpose as the recovery copy of the R2 migration.
  if (target.includes("/storage/v1/object/public/media/")) return json({ ok: true, kept: true, message: "Old Supabase copy kept as a recovery copy." });
  if (!/^https?:\/\//i.test(target)) return json({ error: "Not a file address." }, 400);
  const c = r2Config();
  if (!c) return notConfigured();
  const key = keyFromPublicUrl(c, target);
  if (!key) return json({ ok: true, skipped: true, message: "This is an outside link, so there is no stored file to delete." });
  if (key.startsWith("site-assets/")) return json({ error: "Website logos and icons cannot be deleted here." }, 400);
  try {
    await deleteObject(c, key);
    return json({ ok: true });
  } catch (e: any) {
    console.error("[upload] delete failed", e);
    return json({ error: e?.message ?? "The file could not be deleted from Cloudflare R2." }, 502);
  }
}