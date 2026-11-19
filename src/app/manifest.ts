import type { MetadataRoute } from "next";

// Makes the site installable on phones today and gives a future app shell a starting point.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vrutsa Foundation", short_name: "Vrutsa", start_url: "/", display: "standalone",
    background_color: "#ffffff", theme_color: "#ffffff",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
