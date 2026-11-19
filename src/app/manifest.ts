
import type { MetadataRoute } from "next";
import { R2_PUBLIC_URL } from "@/lib/supabase/env";

// Makes the site installable on phones and serves its icon from Cloudflare R2.
export default function manifest(): MetadataRoute.Manifest {
  const iconUrl = R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL}/site-assets/icon.png`
    : "/icon.png";

  return {
    name: "Vrutsa Foundation",
    short_name: "Vrutsa",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: iconUrl,
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
