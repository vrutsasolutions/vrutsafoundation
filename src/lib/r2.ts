import "server-only";
import { AwsClient } from "aws4fetch";

/* Cloudflare R2: permanent home of every public image, GIF and video on the website.
   Server-side only. The four secret R2_* variables never reach the browser; visitors read files through the
   Cloudflare Worker at NEXT_PUBLIC_R2_PUBLIC_URL, and the bucket itself stays private.
   Private files (ID photographs, application documents, payment proofs, receipts) are NOT stored here:
   they stay in the private Supabase buckets "private-uploads" and "receipts". */

export type R2Config = { account: string; key: string; secret: string; bucket: string; pub: string };

/** Every allowed public file type, with its extension and size limit. */
export const PUBLIC_TYPES: Record<string, { ext: string; max: number }> = {
  "image/jpeg": { ext: "jpg", max: 15 * 1024 * 1024 },
  "image/png": { ext: "png", max: 15 * 1024 * 1024 },
  "image/webp": { ext: "webp", max: 15 * 1024 * 1024 },
  "image/gif": { ext: "gif", max: 25 * 1024 * 1024 },
  "video/mp4": { ext: "mp4", max: 50 * 1024 * 1024 },
  "video/webm": { ext: "webm", max: 50 * 1024 * 1024 },
  "application/pdf": { ext: "pdf", max: 20 * 1024 * 1024 },   // public event reports
};

/** Top-level folders an upload may go into (sub-folders such as activities/<id> are allowed under them). */
export const PUBLIC_FOLDERS = ["slides", "activities", "events", "people", "settings", "categories", "programmes", "library", "reports", "uploads"];

/** Which R2 variables are missing, by name only (never their values). */
export function missingR2Vars(): string[] {
  return ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "NEXT_PUBLIC_R2_PUBLIC_URL"].filter((k) => !process.env[k]);
}

export function r2Config(): R2Config | null {
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: key, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET: bucket, NEXT_PUBLIC_R2_PUBLIC_URL: pub } = process.env;
  return account && key && secret && bucket && pub ? { account, key, secret, bucket, pub: pub.replace(/\/+$/, "") } : null;
}

const client = (c: R2Config) => new AwsClient({ accessKeyId: c.key, secretAccessKey: c.secret, service: "s3", region: "auto" });
const objectUrl = (c: R2Config, key: string) => `https://${c.account}.r2.cloudflarestorage.com/${c.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;

/** A safe object key: letters, digits, "-", "_", "." and "/" only, no "..", no leading "/". */
export const safeKey = (key: string) => /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,300}$/.test(key) && !key.includes("..") && !key.includes("//");

/** Clean an upload folder and check it is one of PUBLIC_FOLDERS. Returns null when it is not allowed. */
export function cleanFolder(folder: unknown): string | null {
  const dir = String(folder ?? "uploads").replace(/[^A-Za-z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/").slice(0, 120) || "uploads";
  return PUBLIC_FOLDERS.includes(dir.split("/")[0]) ? dir : null;
}

export const publicUrlFor = (c: R2Config, key: string) => `${c.pub}/${key}`;

/** The object key of a URL served by our Worker, or null if the URL is not one of ours. */
export function keyFromPublicUrl(c: R2Config, url: string): string | null {
  if (!url.startsWith(`${c.pub}/`)) return null;
  const key = decodeURIComponent(url.slice(c.pub.length + 1).split(/[?#]/)[0]);
  return safeKey(key) ? key : null;
}

/** A presigned PUT address valid for 10 minutes. The content type is part of the signature, so the browser
    must upload exactly the type it declared. */
export async function presignPut(c: R2Config, key: string, contentType: string): Promise<string> {
  const url = new URL(objectUrl(c, key));
  url.searchParams.set("X-Amz-Expires", "600");
  const signed = await client(c).sign(new Request(url, { method: "PUT", headers: { "content-type": contentType } }), { aws: { signQuery: true, allHeaders: true } });
  return signed.url;
}

/** Size and type of a stored object, or null if it does not exist. Throws if R2 cannot be reached. */
export async function headObject(c: R2Config, key: string): Promise<{ size: number; contentType: string; etag: string } | null> {
  const res = await client(c).fetch(objectUrl(c, key), { method: "HEAD" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Cloudflare R2 answered ${res.status} when checking the file.`);
  return { size: Number(res.headers.get("content-length") ?? 0), contentType: res.headers.get("content-type") ?? "", etag: res.headers.get("etag") ?? "" };
}

/** Upload from the server (used when the website itself copies a file, e.g. an approved representative's photo). */
export async function putObject(c: R2Config, key: string, body: ArrayBuffer | Uint8Array | Blob, contentType: string) {
  const res = await client(c).fetch(objectUrl(c, key), {
    method: "PUT", body: body as BodyInit,
    headers: { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" },
  });
  if (!res.ok) throw new Error(`Cloudflare R2 refused the upload (${res.status}).`);
}

/** Delete an object and confirm it is gone. Throws with a readable message when it is not. */
export async function deleteObject(c: R2Config, key: string) {
  const res = await client(c).fetch(objectUrl(c, key), { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`Cloudflare R2 refused the deletion (${res.status}).`);
  if (await headObject(c, key)) throw new Error("Cloudflare R2 reported success but the file is still there.");
}