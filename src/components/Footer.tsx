import Image from "next/image";
import Link from "next/link";
import { getSettings } from "@/lib/data";
import { MeshStrip } from "./Mesh";
import { NAV } from "./Header";
import { R2_PUBLIC_URL } from "@/lib/supabase/env";

export async function Footer() {
  const s = await getSettings();

  const email = s.email || "vrutsafoundation@gmail.com";

  const logoSrc = R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL}/site-assets/logo.png`
    : "/logo.png";

  const social = [
    ["Facebook", s.social_facebook],
    ["Instagram", s.social_instagram],
    ["YouTube", s.social_youtube],
    ["LinkedIn", s.social_linkedin],
    ["X", s.social_x],
  ].filter(([, v]) => v);

  const head = "text-base font-semibold";
  const col = "mt-4 space-y-2.5 text-[0.95rem] text-neutral-800";

  return (
    <footer className="mt-8 bg-white">
      <MeshStrip className="block h-3.5 w-full" />

      <div className="wrap grid gap-x-12 gap-y-10 py-14 sm:grid-cols-2 md:grid-cols-[auto_auto_minmax(0,1fr)_auto] md:gap-x-10 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:gap-x-14">

        {/* Logo with the tagline */}
        <div className="sm:col-span-2 md:col-span-4 lg:col-span-1">
          <div className="inline-flex flex-col items-center">
            <Image
              src={logoSrc}
              alt="Vrutsa Foundation"
              width={414}
              height={148}
              className="h-14 w-auto"
            />

            {s.address && (
              <address className="mt-4 whitespace-pre-line text-center not-italic text-[0.95rem] text-[var(--color-muted)]">
                {s.address}
              </address>
            )}
          </div>
        </div>

        <nav aria-label="Explore">
          <h2 className={head}>Explore</h2>
          <ul className={col}>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className="hover:text-leaf hover:underline"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className={head}>Contact</h2>

          <ul className={`${col} whitespace-nowrap`}>
            {s.phone && (
              <li>
                <a
                  href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}
                  className="hover:text-leaf hover:underline"
                >
                  {s.phone}
                </a>
              </li>
            )}

            <li>
              <a
                href={`mailto:${email}`}
                className="hover:text-leaf hover:underline"
              >
                {email}
              </a>
            </li>

            {s.whatsapp && (
              <li>
                <a
                  href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-leaf hover:underline"
                >
                  WhatsApp
                </a>
              </li>
            )}

            {social.map(([label, url]) => (
              <li key={label}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-leaf hover:underline"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label="Giving and participation">
          <h2 className={head}>Giving and participation</h2>

          <ul className={`${col} lg:whitespace-nowrap`}>
            <li>
              <Link href="/donate" className="hover:text-leaf hover:underline">
                Donate
              </Link>
            </li>

            <li>
              <Link
                href="/get-involved"
                className="hover:text-leaf hover:underline"
              >
                Register as a volunteer
              </Link>
            </li>

            <li>
              <Link
                href="/join-representative"
                className="hover:text-leaf hover:underline"
              >
                Join as District Representative
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Legal">
          <h2 className={head}>Legal</h2>

          <ul className={`${col} whitespace-nowrap`}>
            <li>
              <Link href="/privacy" className="hover:text-leaf hover:underline">
                Privacy Policy
              </Link>
            </li>

            <li>
              <Link href="/terms" className="hover:text-leaf hover:underline">
                Terms &amp; Conditions
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="wrap flex flex-col gap-1 py-5 text-sm text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {s.org_name}
          </p>

          <p>
            Developed by{" "}
            <a
              href="https://www.vrutsasolutions.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-black underline-offset-4 hover:text-leaf hover:underline"
            >
              Vrutsa Solutions
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
