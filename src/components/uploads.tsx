"use client";
import { useState } from "react";
import { browserDb } from "@/lib/supabase/client";

const rid = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const extOf = (f: File) => (f.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Uploads a public media file to Cloudflare R2 and returns its web address. The server checks who is asking,
    hands out a short-lived upload address, then confirms the stored file. Throws an Error with a message that can
    be shown to the person. There is no fallback to Supabase Storage for public files. */
export async function uploadPublic(f: File, folder: string): Promise<string> {
  const post = async (body: object) => {
    const res = await fetch("/api/upload-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "The upload was not allowed.");
    return data;
  };
  const plan = await post({ folder, contentType: f.type, size: f.size });
  let put: Response;
  try { put = await fetch(plan.uploadUrl, { method: "PUT", headers: { "content-type": plan.contentType }, body: f }); }
  catch { throw new Error("The upload to Cloudflare R2 was blocked. Check the bucket's CORS settings allow this website's address."); }
  if (!put.ok) throw new Error(`Cloudflare R2 refused the upload (${put.status}). Please try again.`);
  const done = await post({ action: "confirm", key: plan.key });
  return done.publicUrl as string;
}

/** Deletes a public media file. Returns null when it worked (or nothing needed deleting), otherwise the reason. */
export async function removePublic(url: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/upload-url?url=${encodeURIComponent(url)}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    return res.ok ? null : (data.error ?? `The file could not be deleted (${res.status}).`);
  } catch { return "The file could not be deleted: the server did not answer."; }
}

/** Admin upload of public media (Cloudflare R2). Stores the public address in a normal form field, or accepts a pasted link. */
export function FileField({ name, defaultValue = "", accept, folder = "uploads", required }:
  { name: string; defaultValue?: string; accept?: string; folder?: string; required?: boolean }) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function onFile(f?: File) {
    if (!f) return;
    setErr(""); setBusy(true);
    try { setUrl(await uploadPublic(f, folder)); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  }
  const isImage = /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && isImage && <img src={url} alt="" className="h-16 w-24 rounded-md border border-line object-cover" />}
        <label className="btn btn-line btn-sm">
          {busy ? "Uploading…" : url ? "Replace file" : "Upload file"}
          <input type="file" accept={accept} className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {url && <button type="button" className="text-sm underline" onClick={() => setUrl("")}>Remove</button>}
      </div>
      <input name={name} value={url} onChange={(e) => setUrl(e.target.value)} required={required} placeholder="or paste a link" className="field mt-2 text-sm" />
      {err && <p className="mt-1 text-sm text-kumkum" role="alert">{err}</p>}
    </div>
  );
}

/** Visitor upload to the private bucket (payment proof, applicant photograph). Only the storage path is submitted. */
export function PrivateUpload({ name, prefix, accept, label }: { name: string; prefix: "proofs" | "applicants" | "documents"; accept: string; label: string }) {
  const [path, setPath] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function onFile(f?: File) {
    if (!f) return;
    setErr("");
    if (f.size > 5 * 1024 * 1024) return setErr("Please choose a file smaller than 5 MB.");
    if (!accept.split(",").includes(f.type)) return setErr("This file type is not accepted.");
    const c = browserDb();
    if (!c) return setErr("Uploads are not available right now. You can still submit the form.");
    setBusy(true);
    const p = `${prefix}/${rid()}.${extOf(f)}`;
    const { error } = await c.storage.from("private-uploads").upload(p, f, { contentType: f.type });
    setBusy(false);
    if (error) return setErr("The upload failed. You can still submit the form without it.");
    setPath(p); setFileName(f.name);
  }
  return (
    <div>
      <label className="btn btn-line btn-sm">
        {busy ? "Uploading…" : path ? "Choose a different file" : label}
        <input type="file" accept={accept} className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {fileName && <span className="ml-3 text-sm">{fileName} attached</span>}
      <input type="hidden" name={name} value={path} />
      {err && <p className="mt-1 text-sm text-kumkum" role="alert">{err}</p>}
    </div>
  );
}

/** Adds many photographs / videos to one activity or event, straight from the browser. */
export function MediaManager({ column, id, initial }: { column: "activity_id" | "event_id"; id: string; initial: any[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  async function add(files: FileList | null) {
    const c = browserDb();
    if (!files?.length || !c) return;
    setErr("");
    const { data: { user } } = await c.auth.getUser();
    let n = 0;
    for (const f of Array.from(files)) {
      setBusy(`Uploading ${++n} of ${files.length}…`);
      let url: string;
      try { url = await uploadPublic(f, `${column === "activity_id" ? "activities" : "events"}/${id}`); }
      catch (e: any) { setErr(e.message); continue; }
      const { data, error } = await c.from("activity_media").insert({
        [column]: id, url, media_type: f.type.startsWith("video") ? "video" : "image", uploaded_by: user?.id, sort_order: items.length + n,
      }).select().single();
      if (error) setErr(error.message); else setItems((v) => [...v, data]);
    }
    setBusy("");
  }
  async function remove(m: any) {
    const c = browserDb();
    if (!c || !confirm("Remove this file from the website?")) return;
    const { error } = await c.from("activity_media").delete().eq("id", m.id);
    if (error) return setErr(error.message);
    setItems((v) => v.filter((x) => x.id !== m.id));
    const problem = await removePublic(m.url);
    if (problem) setErr(`Removed from the website, but the stored file was not deleted: ${problem}`);
  }
  return (
    <div>
      <label className="btn btn-leaf btn-sm">
        {busy || "Add photographs or videos"}
        <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" className="sr-only" disabled={!!busy} onChange={(e) => add(e.target.files)} />
      </label>
      <p className="help">JPEG, PNG, WebP or GIF images and MP4 or WebM videos, up to 50 MB each.</p>
      {err && <p className="mt-2 text-sm text-kumkum" role="alert">{err}</p>}
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((m) => (
          <li key={m.id} className="relative overflow-hidden rounded-lg border border-line">
            {m.media_type === "image"
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={m.url} alt="" className="aspect-[4/3] w-full object-cover" />
              : <div className="flex aspect-[4/3] items-center justify-center bg-neutral-100 text-sm font-semibold">Video</div>}
            <button type="button" onClick={() => remove(m)} className="absolute right-1.5 top-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold shadow">Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}