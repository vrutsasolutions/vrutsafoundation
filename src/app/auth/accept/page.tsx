"use client";
import { useEffect, useState } from "react";
import { browserDb } from "@/lib/supabase/client";

// Landing page for set-password links created by the founder (invitation / recovery).
// These links carry the session in the address fragment, which only the browser can read.
export default function Accept() {
  const [msg, setMsg] = useState("Signing you in…");
  useEffect(() => {
    (async () => {
      const c = browserDb();
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const query = new URLSearchParams(window.location.search);
      if (!c) return setMsg("The website is not connected yet.");
      const access_token = hash.get("access_token"), refresh_token = hash.get("refresh_token");
      let ok = false;
      if (access_token && refresh_token) ok = !(await c.auth.setSession({ access_token, refresh_token })).error;
      else if (query.get("code")) ok = !(await c.auth.exchangeCodeForSession(query.get("code")!)).error;
      if (ok) window.location.replace("/account?notice=set-password");
      else setMsg(hash.get("error_description") ?? "This link has expired or was already used. Open the login page and choose “Forgot password”.");
    })();
  }, []);
  return <main className="wrap section max-w-xl"><h1 className="text-3xl">Vrutsa Foundation</h1><p className="mt-4 text-lg">{msg}</p></main>;
}
