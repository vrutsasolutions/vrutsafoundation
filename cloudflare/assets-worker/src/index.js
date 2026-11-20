/* Vrutsa Foundation public media Worker.
   Serves files from the private R2 bucket (binding MEDIA_BUCKET) to anyone, read-only:
   - GET and HEAD, with HTTP range requests (video seeking), ETag / If-None-Match, long browser caching
   - OPTIONS for CORS preflight; every other method is refused (no uploads or deletions through the Worker) */

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,300}$/;
const TYPES = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml",
  ico: "image/x-icon", mp4: "video/mp4", webm: "video/webm", pdf: "application/pdf",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, If-None-Match, If-Modified-Since",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Content-Type, ETag, Accept-Ranges",
  "Access-Control-Max-Age": "86400",
};

function plain(status, text, extra = {}) {
  return new Response(text, { status, headers: { ...cors, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...extra } });
}

function metaHeaders(object, key) {
  const h = new Headers(cors);
  object.writeHttpMetadata(h);
  if (!h.get("Content-Type")) h.set("Content-Type", TYPES[key.split(".").pop().toLowerCase()] ?? "application/octet-stream");
  if (!h.get("Cache-Control")) h.set("Cache-Control", key.startsWith("site-assets/") ? "public, max-age=86400" : "public, max-age=31536000, immutable");
  h.set("ETag", object.httpEtag);
  h.set("Accept-Ranges", "bytes");
  h.set("X-Content-Type-Options", "nosniff");
  if (object.uploaded) h.set("Last-Modified", object.uploaded.toUTCString());
  return h;
}

export default {
  async fetch(request, env) {
    const method = request.method;
    if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (method !== "GET" && method !== "HEAD") return plain(405, "Method not allowed", { Allow: "GET, HEAD, OPTIONS" });

    let key;
    try { key = decodeURIComponent(new URL(request.url).pathname.slice(1)); } catch { return plain(400, "Bad request"); }
    if (!key || !SAFE_KEY.test(key) || key.includes("..") || key.includes("//")) return plain(404, "Not found");

    try {
      if (method === "HEAD") {
        const head = await env.MEDIA_BUCKET.head(key);
        if (!head) return plain(404, "Not found");
        const h = metaHeaders(head, key);
        h.set("Content-Length", String(head.size));
        return new Response(null, { status: 200, headers: h });
      }

      const object = await env.MEDIA_BUCKET.get(key, { range: request.headers, onlyIf: request.headers });
      if (!object) return plain(404, "Not found");
      const h = metaHeaders(object, key);
      if (!("body" in object) || !object.body) return new Response(null, { status: 304, headers: h });   // If-None-Match matched

      const size = object.size;
      const r = object.range;
      const asked = request.headers.get("Range");
      if (asked) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(asked.trim());
        if (m && m[1] !== "" && Number(m[1]) >= size) return plain(416, "Range not satisfiable", { "Content-Range": `bytes */${size}` });
      }
      if (asked && r) {
        const start = r.suffix !== undefined ? Math.max(size - r.suffix, 0) : (r.offset ?? 0);
        const length = r.suffix !== undefined ? Math.min(r.suffix, size) : (r.length ?? size - start);
        h.set("Content-Range", `bytes ${start}-${start + length - 1}/${size}`);
        h.set("Content-Length", String(length));
        return new Response(object.body, { status: 206, headers: h });
      }
      h.set("Content-Length", String(size));
      return new Response(object.body, { status: 200, headers: h });
    } catch (e) {
      // An impossible range (for example past the end of the file) lands here.
      if (request.headers.has("Range")) return plain(416, "Range not satisfiable");
      console.error("media worker error", e);
      return plain(500, "Media temporarily unavailable");
    }
  },
};