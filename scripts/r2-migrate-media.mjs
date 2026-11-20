#!/usr/bin/env node
/* Copy the public Supabase "media" bucket to Cloudflare R2 and prepare the database URL update.

   Run from the project folder (Node 20+), reading secrets from .env.local:
     node --env-file=.env.local scripts/r2-migrate-media.mjs inventory   # dry run: lists everything, changes nothing
     node --env-file=.env.local scripts/r2-migrate-media.mjs copy        # copies files to R2 and verifies each one
     node --env-file=.env.local scripts/r2-migrate-media.mjs sql         # writes the database update + rollback SQL
     node --env-file=.env.local scripts/r2-migrate-media.mjs verify      # after the SQL is applied: checks every reference

   Safe to re-run: files already copied and verified are skipped, the manifest is saved after every file, and the
   SQL only changes rows that still hold the exact old address. Nothing is ever deleted from Supabase, and the
   private buckets ("private-uploads", "receipts") are never read.

   Output (folder ./migration):
     r2-media-manifest.json   old Supabase path + URL → new R2 key + URL, status of each file   (the mapping backup)
     r2-dry-run-report.md     counts: files, references, unreferenced files, conflicts
     r2-errors.json           files that could not be copied, with the reason
     r2-update.sql            database update, one transaction, verified files only
     r2-rollback.sql          puts every updated address back to the Supabase one */

import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const BUCKET = "media";                       // the ONLY bucket this script reads
const OUT = process.env.MIGRATION_DIR || "migration";
const MANIFEST = join(OUT, "r2-media-manifest.json");

/* Every database field that can hold a public media address (found by scanning all text and JSON columns).
   audit_logs.details is deliberately left alone: it is a historical record of past changes. */
const REF_COLUMNS = [
  ["hero_slides", "image_url"], ["regional_appointments", "photo_url"], ["categories", "image_url"],
  ["events", "poster_url"], ["events", "report_url"], ["activities", "cover_url"], ["activity_media", "url"],
  ["donation_programmes", "image_url"],
];

/* ───────────── setup ───────────── */
const env = process.env;
const need = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "NEXT_PUBLIC_R2_PUBLIC_URL"];
const missing = need.filter((k) => !env[k]);
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(", ")}\nRun with: node --env-file=.env.local scripts/r2-migrate-media.mjs <command>`);
  process.exit(1);
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");
const PUB = env.NEXT_PUBLIC_R2_PUBLIC_URL.replace(/\/+$/, "");
const R2_ENDPOINT = (env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
const supa = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const r2 = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: "s3", region: "auto", retries: 3 });
const objUrl = (key) => `${R2_ENDPOINT}/${env.R2_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
const MARKER = "/storage/v1/object/public/media/";
const oldUrlFor = (path) => `${SUPABASE_URL}${MARKER}${path.split("/").map(encodeURIComponent).join("/")}`;
const keyFor = (path) => path;                // stable mapping: the R2 key is the same path as in Supabase
const newUrlFor = (key) => `${PUB}/${key}`;
const SAFE = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,300}$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sqlStr = (v) => `'${String(v).replace(/'/g, "''")}'`;

mkdirSync(OUT, { recursive: true });
const loadManifest = () => (existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : null);
const saveManifest = (m) => { m.updatedAt = new Date().toISOString(); writeFileSync(MANIFEST, JSON.stringify(m, null, 2)); };

async function withRetry(label, fn, tries = 4) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < tries) await sleep(500 * 2 ** i); }
  }
  throw new Error(`${label}: ${last?.message ?? last}`);
}

/* ───────────── inventory ───────────── */
async function listBucket(prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await withRetry(`list ${prefix || "/"}`, async () => {
      const r = await supa.storage.from(BUCKET).list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
      if (r.error) throw r.error; return r;
    });
    if (error) throw error;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await listBucket(path)));       // a folder
      else if (item.name !== ".emptyFolderPlaceholder") out.push({ path, size: Number(item.metadata?.size ?? 0), contentType: item.metadata?.mimetype ?? "", etag: item.metadata?.eTag ?? "" });
    }
    if (data.length < 100) break;
  }
  return out;
}

const pathFromValue = (v) => {
  const m = typeof v === "string" ? v.match(/\/storage\/v1\/object\/public\/media\/([^?#"\s]+)/) : null;
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
};

async function readReferences() {
  const refs = [];
  for (const [table, column] of REF_COLUMNS) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supa.from(table).select(`id, ${column}`).like(column, `%${MARKER}%`).range(from, from + 999);
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) { console.log(`  (skipping ${table}.${column}: not in this database)`); break; }
        throw new Error(`${table}.${column}: ${error.message}`);
      }
      for (const row of data) refs.push({ table, column, id: row.id, value: row[column], path: pathFromValue(row[column]) });
      if (data.length < 1000) break;
    }
  }
  const { data: settings, error } = await supa.from("foundation_settings").select("key, value").like("value", `%${MARKER}%`);
  if (error) throw new Error(`foundation_settings: ${error.message}`);
  for (const row of settings) refs.push({ table: "foundation_settings", column: "value", key: row.key, value: row.value, path: pathFromValue(row.value) });
  return refs;
}

async function r2Head(key) {
  const res = await r2.fetch(objUrl(key), { method: "HEAD" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 HEAD ${res.status}`);
  return { size: Number(res.headers.get("content-length") ?? 0), contentType: res.headers.get("content-type") ?? "" };
}

async function inventory() {
  console.log(`Listing Supabase bucket "${BUCKET}"…`);
  const files = await listBucket();
  console.log(`  ${files.length} files`);
  console.log("Reading database references…");
  const refs = await readReferences();
  console.log(`  ${refs.length} references`);

  const old = loadManifest();
  const prev = new Map((old?.files ?? []).map((f) => [f.path, f]));
  const byPath = new Map(files.map((f) => [f.path, f]));
  const lower = new Map();
  const conflicts = [];
  for (const f of files) {
    const l = f.path.toLowerCase();
    if (lower.has(l)) conflicts.push({ path: f.path, reason: `differs only by letter case from ${lower.get(l)}` });
    lower.set(l, f.path);
    if (!SAFE.test(f.path) || f.path.includes("..")) conflicts.push({ path: f.path, reason: "name has characters the Worker will not serve" });
    if (f.path.startsWith("site-assets/")) conflicts.push({ path: f.path, reason: "collides with the site-assets/ folder in R2" });
  }

  console.log("Checking which files are already in R2…");
  const entries = [];
  let i = 0;
  for (const f of files) {
    const key = keyFor(f.path);
    const p = prev.get(f.path);
    let status = p?.status === "verified" ? "verified" : "pending";
    let r2Info = null;
    try { r2Info = await withRetry(`HEAD ${key}`, () => r2Head(key)); } catch (e) { status = "r2-unreachable"; }
    if (r2Info && status !== "verified") status = r2Info.size === f.size ? "already-in-r2" : "conflict";
    if (!r2Info && status === "verified") status = "pending";            // was copied before but is gone now
    if (status === "conflict") conflicts.push({ path: f.path, reason: `R2 already has ${key} with a different size (${r2Info.size} vs ${f.size})` });
    entries.push({
      path: f.path, key, oldUrl: oldUrlFor(f.path), newUrl: newUrlFor(key), contentType: f.contentType, size: f.size,
      status, verifiedAt: status === "verified" ? p.verifiedAt : null,
      references: refs.filter((r) => r.path === f.path).map(({ table, column, id, key: k, value }) => ({ table, column, ...(id ? { id } : { key: k }), value })),
    });
    if (++i % 25 === 0) console.log(`  ${i}/${files.length}`);
  }
  const brokenRefs = refs.filter((r) => !r.path || !byPath.has(r.path));
  const manifest = { bucket: BUCKET, supabaseUrl: SUPABASE_URL, r2Bucket: env.R2_BUCKET, publicUrl: PUB, createdAt: old?.createdAt ?? new Date().toISOString(), files: entries, brokenReferences: brokenRefs, conflicts };
  saveManifest(manifest);

  const count = (s) => entries.filter((e) => e.status === s).length;
  const unref = entries.filter((e) => !e.references.length);
  const byCol = {};
  for (const r of refs) { const k = `${r.table}.${r.column}${r.key ? ` (${r.key})` : ""}`; byCol[k] = (byCol[k] ?? 0) + 1; }
  const report = `# R2 media migration — dry run

Generated ${new Date().toISOString()}. Nothing was changed.

| | Count |
|---|---:|
| Files in Supabase bucket \`${BUCKET}\` | ${files.length} |
| Total size | ${(files.reduce((a, f) => a + f.size, 0) / 1024 / 1024).toFixed(1)} MB |
| Files still to copy (pending) | ${count("pending")} |
| Files already in R2 with the same size | ${count("already-in-r2")} |
| Files already copied and verified | ${count("verified")} |
| Conflicts | ${conflicts.length} |
| R2 not reachable for | ${count("r2-unreachable")} |
| Database references to update | ${refs.length - brokenRefs.length} |
| References pointing to a missing file | ${brokenRefs.length} |
| Files not referenced by any record (copied anyway) | ${unref.length} |

## References by field
${Object.entries(byCol).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "- none"}

## File types
${Object.entries(entries.reduce((a, e) => ((a[e.contentType || "unknown"] = (a[e.contentType || "unknown"] ?? 0) + 1), a), {})).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

## Conflicts
${conflicts.map((c) => `- ${c.path}: ${c.reason}`).join("\n") || "- none"}

## References to missing files
${brokenRefs.map((r) => `- ${r.table}.${r.column} ${r.id ?? r.key}: ${r.value}`).join("\n") || "- none"}

## Unreferenced files
${unref.map((e) => `- ${e.path}`).join("\n") || "- none"}

The full old → new mapping is in \`${MANIFEST}\`. Keep a copy of it: it is the backup for rolling back.
`;
  writeFileSync(join(OUT, "r2-dry-run-report.md"), report);
  console.log(`\n${report}`);
}

/* ───────────── copy ───────────── */
async function verifyPublic(url, size) {
  const res = await fetch(url, { method: "HEAD" });
  if (!res.ok) throw new Error(`Worker answered ${res.status} for ${url}`);
  const len = Number(res.headers.get("content-length") ?? -1);
  if (len !== -1 && len !== size) throw new Error(`Worker reports ${len} bytes, expected ${size}`);
}

async function copyOne(e) {
  const { data, error } = await withRetry(`download ${e.path}`, async () => {
    const r = await supa.storage.from(BUCKET).download(e.path); if (r.error) throw r.error; return r;
  });
  if (error) throw error;
  const body = new Uint8Array(await data.arrayBuffer());
  if (e.size && body.byteLength !== e.size) throw new Error(`downloaded ${body.byteLength} bytes, expected ${e.size}`);
  const type = e.contentType || data.type || "application/octet-stream";
  await withRetry(`upload ${e.key}`, async () => {
    const res = await r2.fetch(objUrl(e.key), {
      method: "PUT", body,
      headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable", "x-amz-meta-source": `supabase:${BUCKET}/${e.path}` },
    });
    if (!res.ok) throw new Error(`R2 PUT ${res.status} ${await res.text().catch(() => "")}`.trim());
  });
  const head = await withRetry(`verify ${e.key}`, () => r2Head(e.key));
  if (!head) throw new Error("not found in R2 after upload");
  if (head.size !== body.byteLength) throw new Error(`R2 holds ${head.size} bytes, expected ${body.byteLength}`);
  if (head.contentType && type && head.contentType.split(";")[0] !== type.split(";")[0]) throw new Error(`R2 content type ${head.contentType}, expected ${type}`);
  await withRetry(`public check ${e.newUrl}`, () => verifyPublic(e.newUrl, body.byteLength), 3);
}

async function copy() {
  const m = loadManifest();
  if (!m) { console.error("Run the inventory first."); process.exit(1); }
  const blocked = new Set(m.conflicts.map((c) => c.path));
  const todo = m.files.filter((e) => e.status !== "verified" && !blocked.has(e.path));
  console.log(`${todo.length} files to copy (${m.files.length - todo.length} already verified or blocked by a conflict).`);
  const errors = [];
  let done = 0;
  const queue = [...todo];
  const worker = async () => {
    for (let e; (e = queue.shift()); ) {
      try {
        if (e.status === "already-in-r2") {           // same size already there: just verify it end to end
          const head = await r2Head(e.key);
          if (!head || head.size !== e.size) throw new Error("R2 copy changed since the inventory");
          await verifyPublic(e.newUrl, e.size);
        } else await copyOne(e);
        e.status = "verified"; e.verifiedAt = new Date().toISOString(); delete e.error;
      } catch (err) {
        e.status = "failed"; e.error = String(err.message ?? err); errors.push({ path: e.path, key: e.key, error: e.error });
      }
      saveManifest(m);
      console.log(`  [${++done}/${todo.length}] ${e.status.padEnd(8)} ${e.path}${e.error ? ` — ${e.error}` : ""}`);
    }
  };
  await Promise.all(Array.from({ length: Number(env.MIGRATION_CONCURRENCY || 4) }, worker));
  writeFileSync(join(OUT, "r2-errors.json"), JSON.stringify({ at: new Date().toISOString(), errors, blockedByConflict: [...blocked] }, null, 2));
  const c = (s) => m.files.filter((e) => e.status === s).length;
  console.log(`\nVerified: ${c("verified")}  Failed: ${c("failed")}  Blocked by conflict: ${blocked.size}  Total: ${m.files.length}`);
  if (errors.length) console.log(`Details in ${join(OUT, "r2-errors.json")}. Re-run "copy" to retry the failed files.`);
}

/* ───────────── SQL ───────────── */
function sql() {
  const m = loadManifest();
  if (!m) { console.error("Run the inventory and copy first."); process.exit(1); }
  const upd = [], back = [];
  let refs = 0, skipped = 0;
  for (const e of m.files) {
    for (const r of e.references) {
      if (e.status !== "verified") { skipped++; continue; }
      const nv = r.value.split(r.value.match(/https?:\/\/[^\s"]*\/storage\/v1\/object\/public\/media\/[^?#"\s]+/)?.[0] ?? "\u0000").join(e.newUrl);
      if (nv === r.value) { skipped++; continue; }
      const where = r.table === "foundation_settings" ? `key = ${sqlStr(r.key)}` : `id = ${sqlStr(r.id)}`;
      upd.push(`update public.${r.table} set ${r.column} = ${sqlStr(nv)} where ${where} and ${r.column} = ${sqlStr(r.value)};`);
      back.push(`update public.${r.table} set ${r.column} = ${sqlStr(r.value)} where ${where} and ${r.column} = ${sqlStr(nv)};`);
      refs++;
    }
  }
  const head = (title) => `-- ${title}\n-- Generated ${new Date().toISOString()} from ${MANIFEST}\n-- Only rows that still hold the exact expected value are changed, so running it twice is harmless.\nbegin;\n`;
  const remaining = `\n-- Supabase media addresses left in the database after this script (expected 0 after the update):\nselect\n${REF_COLUMNS.map(([t, c]) => `  (select count(*) from public.${t} where ${c} like '%${MARKER}%')`).concat([`  (select count(*) from public.foundation_settings where value like '%${MARKER}%')`]).join(" +\n")} as supabase_media_refs_left;\n`;
  writeFileSync(join(OUT, "r2-update.sql"), `${head(`R2 migration: ${refs} database references → Cloudflare R2`)}${upd.join("\n")}\ncommit;\n${remaining}`);
  writeFileSync(join(OUT, "r2-rollback.sql"), `${head(`ROLLBACK of the R2 migration: ${refs} references back to Supabase Storage`)}${back.join("\n")}\ncommit;\n`);
  console.log(`Wrote ${join(OUT, "r2-update.sql")} (${refs} updates) and ${join(OUT, "r2-rollback.sql")}. Skipped ${skipped} references whose files are not verified yet.`);
  console.log("Review the file, then apply it in Supabase → SQL Editor (or ask Claude to apply it).");
}

/* ───────────── verify ───────────── */
async function verify() {
  const refs = await readReferences();
  console.log(`Supabase media addresses still in the database: ${refs.length}`);
  for (const r of refs.slice(0, 20)) console.log(`  ${r.table}.${r.column} ${r.id ?? r.key}`);
  const m = loadManifest();
  const urls = new Set();
  for (const [table, column] of REF_COLUMNS) {
    const { data, error } = await supa.from(table).select(column).like(column, `${PUB}/%`).limit(10000);
    if (!error) for (const row of data) urls.add(row[column]);
  }
  const { data: s } = await supa.from("foundation_settings").select("value").like("value", `${PUB}/%`);
  for (const row of s ?? []) urls.add(row.value);
  let ok = 0; const bad = [];
  for (const u of urls) {
    try { const res = await fetch(u, { method: "HEAD" }); if (res.ok) ok++; else bad.push(`${res.status} ${u}`); } catch (e) { bad.push(`unreachable ${u}`); }
  }
  console.log(`R2 addresses in the database: ${urls.size}. Served by the Worker: ${ok}. Problems: ${bad.length}`);
  bad.slice(0, 30).forEach((b) => console.log(`  ${b}`));
  if (m) console.log(`Manifest: ${m.files.filter((e) => e.status === "verified").length}/${m.files.length} files verified in R2.`);
  process.exitCode = refs.length || bad.length ? 1 : 0;
}

const cmd = process.argv[2] ?? "inventory";
const run = { inventory, copy, sql, verify }[cmd];
if (!run) { console.error("Commands: inventory | copy | sql | verify"); process.exit(1); }
Promise.resolve().then(run).catch((e) => { console.error(`\nStopped: ${e.message ?? e}`); process.exit(1); });