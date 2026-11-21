"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* Menu for phones and tablets.
   The panel is rendered into <body> with a portal, not inside the header. The header uses backdrop-blur, and a
   backdrop filter makes that element the reference box for any position:fixed child, which collapsed this panel
   to zero height: the icon changed but nothing appeared. From <body> the panel is measured against the screen. */
export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);          // portals need the browser
  const path = usePathname();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); button.current?.focus(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      // Keep the keyboard inside the open menu.
      const stops = [button.current, ...Array.from(panel.current.querySelectorAll<HTMLAnchorElement>("a"))].filter(Boolean) as HTMLElement[];
      const i = stops.indexOf(document.activeElement as HTMLElement);
      if (i === -1) return;
      const next = stops[(i + (e.shiftKey ? -1 : 1) + stops.length) % stops.length];
      e.preventDefault();
      next.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const menu = (
    <div id="mobile-menu" ref={panel} role="dialog" aria-modal="true" aria-label="Menu"
      className="fixed inset-x-0 bottom-0 top-[72px] z-[60] overflow-y-auto overscroll-contain bg-white lg:hidden">
      <nav aria-label="Mobile" className="wrap flex flex-col py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {items.map((n, i) => (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
            className="rise flex items-center justify-between border-b border-line py-4 font-[family-name:var(--font-display)] text-3xl font-semibold"
            style={{ animationDelay: `${i * 35}ms`, animationDuration: "0.35s" }}>
            {n.label}
            <span aria-hidden="true" className={`h-3 w-3 rounded-full ${path === n.href ? "bg-leaf" : "bg-saffron"}`} />
          </Link>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="lg:hidden">
      <button ref={button} type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-menu"
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-black" aria-label={open ? "Close menu" : "Open menu"}>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          {open ? <path d="M4 4l12 12M16 4L4 16" stroke="#000" strokeWidth="2.2" strokeLinecap="round" />
                : <path d="M2 5h16M2 10h16M2 15h16" stroke="#000" strokeWidth="2.2" strokeLinecap="round" />}
        </svg>
      </button>
      {open && mounted && createPortal(menu, document.body)}
    </div>
  );
}