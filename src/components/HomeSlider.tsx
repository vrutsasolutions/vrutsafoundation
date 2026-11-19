"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Img } from "./Img";

export type Slide = {
  id: string; image_url: string; media_type?: string; title?: string | null; subtitle?: string | null;
  cta_label?: string | null; link_url?: string | null; cta2_label?: string | null; cta2_url?: string | null;
  focus?: string | null; is_active?: boolean;
};

/* Text sizes inside the picture. Change these numbers to resize (phones use the smaller pair). */
const HEADING_PX = { phone: 18, desktop: 30 };
const DESCRIPTION_PX = { phone: 13, desktop: 18 };
const FOCUS: Record<string, string> = { center: "object-center", top: "object-top", bottom: "object-bottom", left: "object-left", right: "object-right" };

/** Small icon for well-known social sites, so a slide link reads as "Instagram", "YouTube" and so on at a glance. */
function SocialIcon({ href }: { href: string }) {
  const h = href.toLowerCase();
  const d = h.includes("instagram.") ? "M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm5 5.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zm5.25-1.25a1 1 0 100 2 1 1 0 000-2zM12 9.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z"
    : h.includes("youtube.") || h.includes("youtu.be") ? "M23 7.2a3 3 0 00-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 001 7.2 31 31 0 00.6 12a31 31 0 00.4 4.8 3 3 0 002.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 002.1-2.1 31 31 0 00.4-4.8 31 31 0 00-.4-4.8zM9.75 15.1V8.9L15.5 12z"
    : h.includes("facebook.") ? "M14 8.5V6.6c0-.9.6-1.1 1-1.1h2.6V1.6L14 1.5c-4 0-4.9 3-4.9 4.9v2.1H6.8v4H9.1V22.5H14V12.5h3.3l.4-4z"
    : "";
  return d ? <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d={d} fill="currentColor" fillRule="evenodd" /></svg> : null;
}

/** A slide button: internal pages use the router, outside addresses (Instagram, YouTube) open in a new tab. */
function SlideLink({ href, children }: { href: string; children: React.ReactNode }) {
  const cls = "pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-black backdrop-blur transition-colors hover:bg-saffron";
  return /^https?:\/\//i.test(href)
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}><SocialIcon href={href} />{children}</a>
    : <Link href={href} className={cls}>{children}</Link>;
}

/** Homepage carousel, up to four slides managed from the admin panel, edge to edge across the screen.
    The picture, GIF or video fills the whole band (cropped around the "keep in view" point chosen in the admin
    panel, never stretched). Heading in the foundation's orange floats at the top, the description at the bottom,
    the slide links at the bottom left, arrows and dots over the picture. Advances every 7 seconds, pauses on
    hover or focus, and works with arrows, dots, keys and swipe. */
export function HomeSlider({ slides, fallbackTitle, preview = false, children }: { slides: Slide[]; fallbackTitle: string; preview?: boolean; children?: React.ReactNode }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;
  const go = useCallback((d: number) => setI((v) => (v + d + n) % n), [n]);
  const touch = useRef<number | null>(null);

  useEffect(() => {
    if (n < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => go(1), 7000);
    return () => clearInterval(t);
  }, [n, paused, go]);

  const sizes = {
    "--hp": `${HEADING_PX.phone}px`, "--hd": `${HEADING_PX.desktop}px`,
    "--dp": `${DESCRIPTION_PX.phone}px`, "--dd": `${DESCRIPTION_PX.desktop}px`,
  } as React.CSSProperties;

  return (
    <>
      <section aria-roledescription="carousel" aria-label="Vrutsa Foundation in pictures" style={sizes}
        className="relative h-[min(82vw,460px)] w-full overflow-hidden bg-neutral-900 sm:h-[clamp(420px,74vh,760px)]"
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
        onKeyDown={(e) => { if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); }}
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => { if (touch.current === null) return; const d = e.changedTouches[0].clientX - touch.current; if (Math.abs(d) > 50) go(d < 0 ? 1 : -1); touch.current = null; }}>
        <h1 className="sr-only">{fallbackTitle}</h1>
        {slides.map((sl, k) => {
          const heading = sl.title || fallbackTitle;
          const fit = `object-cover ${FOCUS[sl.focus ?? "center"] ?? "object-center"}`;
          const links = [sl.cta_label && sl.link_url ? [sl.cta_label, sl.link_url] : null, sl.cta2_label && sl.cta2_url ? [sl.cta2_label, sl.cta2_url] : null].filter(Boolean) as string[][];
          return (
            <figure key={sl.id} role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${n}: ${heading}`} aria-hidden={k !== i}
              className={`absolute inset-0 m-0 transition-opacity duration-700 motion-reduce:transition-none ${k === i ? "opacity-100" : "pointer-events-none opacity-0"}`}>
              {sl.media_type === "video"
                ? <video src={sl.image_url} muted loop playsInline autoPlay preload={k === 0 ? "auto" : "metadata"} className={`absolute inset-0 h-full w-full ${fit}`} />
                : <Img src={sl.image_url} alt={sl.subtitle || heading} sizes="100vw" priority={k === 0} className={fit} />}

              {/* Heading, floating at the top */}
              <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/75 via-black/35 to-transparent px-14 pb-16 pt-5 text-center sm:pt-8">
                <h2 className="mx-auto max-w-4xl text-[length:var(--hp)] font-semibold leading-tight text-saffron [text-shadow:0_2px_10px_rgba(0,0,0,0.55)] sm:text-[length:var(--hd)]">{heading}</h2>
                {preview && sl.is_active === false && <p className="tag mt-2 bg-kumkum text-white">Inactive: visitors do not see this slide</p>}
              </div>

              {/* Description at the bottom, links at the bottom left */}
              {(sl.subtitle || links.length > 0) && (
                <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-4 pb-12 pt-20 sm:px-8 sm:pb-14">
                  {sl.subtitle && <p className="mx-auto max-w-4xl text-center text-[length:var(--dp)] leading-snug text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.6)] sm:text-[length:var(--dd)]">{sl.subtitle}</p>}
                  {links.length > 0 && (
                    <div className="absolute bottom-3 left-4 flex flex-wrap gap-2 sm:bottom-4 sm:left-8">
                      {links.map(([label, href]) => <SlideLink key={href} href={href}>{label}</SlideLink>)}
                    </div>
                  )}
                </figcaption>
              )}
            </figure>
          );
        })}

        {n > 1 && [-1, 1].map((d) => (
          <button key={d} onClick={() => go(d)} aria-label={d < 0 ? "Previous slide" : "Next slide"}
            className={`absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-black shadow backdrop-blur transition-colors hover:bg-saffron sm:h-12 sm:w-12 ${d < 0 ? "left-3 sm:left-6" : "right-3 sm:right-6"}`}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d={d < 0 ? "M9 2L4 7l5 5" : "M5 2l5 5-5 5"} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        ))}

        {n > 1 && (
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 sm:bottom-5" role="group" aria-label="Choose a slide">
            {slides.map((sl, k) => (
              <button key={sl.id} aria-current={k === i} aria-label={`Slide ${k + 1} of ${n}`} onClick={() => setI(k)}
                className={`h-2 rounded-full transition-all ${k === i ? "w-7 bg-saffron" : "w-2 bg-white/60 hover:bg-white"}`} />
            ))}
          </div>
        )}
      </section>
      {children && <div className="wrap mt-8 flex flex-wrap justify-center gap-3 [&_.btn]:min-h-10 [&_.btn]:px-5 [&_.btn]:text-[0.95rem]">{children}</div>}
    </>
  );
}