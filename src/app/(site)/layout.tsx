import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { hasSupabase } from "@/lib/supabase/env";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {!hasSupabase && (
        <p className="bg-black px-4 py-2 text-center text-sm text-white">
          Setup: the website is not connected to Supabase yet. Add the keys from .env.example to see live content.
        </p>
      )}
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
