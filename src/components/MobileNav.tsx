"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-menu"
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-black" aria-label={open ? "Close menu" : "Open menu"}>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          {open ? <path d="M4 4l12 12M16 4L4 16" stroke="#000" strokeWidth="2.2" strokeLinecap="round" />
                : <path d="M2 5h16M2 10h16M2 15h16" stroke="#000" strokeWidth="2.2" strokeLinecap="round" />}
        </svg>
      </button>
      {open && (
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-[72px] z-50 overflow-y-auto bg-white">
          <nav aria-label="Mobile" className="wrap flex flex-col py-6">
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
      )}
    </div>
  );
}
