"use client";
import { createBrowserClient } from "@supabase/ssr";
import { hasSupabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

export function browserDb() {
  if (!hasSupabase) return null;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
