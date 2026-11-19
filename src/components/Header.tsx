
import Image from "next/image";
import Link from "next/link";
import { MobileNav } from "./MobileNav";
import { R2_PUBLIC_URL } from "@/lib/supabase/env";

export const NAV = [
  { href: "/about", label: "About us" },
  { href: "/activities", label: "Our activities" },
  { href: "/events", label: "Events" },
  { href: "/network", label: "Our network" },
  { href: "/get-involved", label: "Get involved" },
];

export function Header() {
  const logoSrc = R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL}/site-assets/logo.png`
    : "/logo.png";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-black focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <div className="wrap flex h-[72px] items-center justify-between gap-6">
        <Link
          href="/"
          aria-label="Vrutsa Foundation home"
          className="shrink-0"
        >
          <Image
            src={logoSrc}
            alt="Vrutsa Foundation"
            width={414}
            height={148}
            priority
            className="h-11 w-auto sm:h-12"
          />
        </Link>

        <nav
          aria-label="Main"
          className="hidden items-center gap-7 lg:flex"
        >
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-[0.97rem] font-medium text-black underline-offset-8 decoration-saffron decoration-[3px] hover:underline"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden px-2 text-[0.97rem] font-semibold text-black hover:text-leaf sm:block"
          >
            Login
          </Link>

          <Link
            href="/donate"
            className="btn btn-saffron btn-sm sm:min-h-11 sm:px-6 sm:text-base"
          >
            Donate
          </Link>

          <MobileNav
            items={[
              { href: "/", label: "Home" },
              ...NAV,
              { href: "/donate", label: "Donate" },
              { href: "/login", label: "Login" },
            ]}
          />
        </div>
      </div>
    </header>
  );
}