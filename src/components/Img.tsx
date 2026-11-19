import Image from "next/image";
import { SUPABASE_URL } from "@/lib/supabase/env";

const hostOf = (v: string) => { try { return new URL(v).host; } catch { return ""; } };
const supabase = hostOf(SUPABASE_URL);
const r2 = hostOf(process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "");

/** Photographs from our own storage (Supabase or Cloudflare R2) are resized and served as modern formats;
    anything else, and animated GIFs, load lazily as they are. */
export function Img({ src, alt, className, sizes = "(min-width: 1024px) 33vw, 100vw", priority = false, natural = false, onSize }:
  { src: string; alt: string; className?: string; sizes?: string; priority?: boolean;
    /** Called with the picture's real width and height once it has loaded. */ onSize?: (w: number, h: number) => void;
    /** Keep the picture's own shape (no cropping) instead of filling the parent box. */ natural?: boolean }) {
  let optimisable = false;
  try {
    const u = new URL(src);
    optimisable = (Boolean(supabase) && u.host === supabase && u.pathname.includes("/object/public/")) || (Boolean(r2) && u.host === r2);
    if (/\.gif$/i.test(u.pathname)) optimisable = false;
  } catch { /* relative or invalid address */ }
  if (natural) return optimisable
    ? <Image src={src} alt={alt} width={1600} height={1000} sizes={sizes} priority={priority} className={className} />
    // eslint-disable-next-line @next/next/no-img-element
    : <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" className={className} />;
  const report = (el: HTMLImageElement | null) => { if (el && onSize && el.complete && el.naturalWidth) onSize(el.naturalWidth, el.naturalHeight); };
  if (optimisable) return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={className}
    onLoad={onSize ? (e) => report(e.currentTarget) : undefined} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={onSize ? report : undefined} onLoad={onSize ? (e) => report(e.currentTarget) : undefined} src={src} alt={alt}
    loading={priority ? "eager" : "lazy"} decoding="async" className={`absolute inset-0 h-full w-full ${className ?? ""}`} />;
}