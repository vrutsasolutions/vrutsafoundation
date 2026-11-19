"use client";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/types";

export function Submit({ children, className = "btn btn-leaf", pending = "Saving…" }: { children: React.ReactNode; className?: string; pending?: string }) {
  const s = useFormStatus();
  return <button type="submit" disabled={s.pending} className={className}>{s.pending ? pending : children}</button>;
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.error && !state?.message) return null;
  return <p role={state.error ? "alert" : "status"} className={`notice ${state.error ? "notice-err" : "notice-ok"}`}>{state.error ?? state.message}</p>;
}

/** Hidden field that only bots fill in. */
export const Honeypot = () => (
  <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
    <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
  </div>
);
