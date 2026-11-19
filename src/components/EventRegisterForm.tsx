"use client";
import { useActionState } from "react";
import { registerForEvent } from "@/app/actions/public";
import { FormMessage, Honeypot, Submit } from "./form";

export function EventRegisterForm({ eventId }: { eventId: string }) {
  const [state, action] = useActionState(registerForEvent, null);
  if (state?.ok) return <p className="notice notice-ok" role="status">You are registered. A confirmation will be sent to your email address.</p>;
  return (
    <form action={action} className="relative space-y-4">
      <Honeypot />
      <input type="hidden" name="event_id" value={eventId} />
      <div><label className="label" htmlFor="r-name">Your name</label><input id="r-name" name="full_name" required autoComplete="name" className="field" /></div>
      <div><label className="label" htmlFor="r-email">Email</label><input id="r-email" name="email" type="email" required autoComplete="email" className="field" /></div>
      <div><label className="label" htmlFor="r-phone">Mobile number (optional)</label><input id="r-phone" name="phone" type="tel" autoComplete="tel" className="field" /></div>
      <label className="flex items-start gap-3 text-[0.95rem]">
        <input type="checkbox" name="whatsapp_opt_in" className="mt-1 h-5 w-5 accent-[var(--color-leaf)]" />
        <span>Send event updates on WhatsApp as well.</span>
      </label>
      <FormMessage state={state} />
      <Submit className="btn btn-saffron w-full" pending="Registering…">Register for this event</Submit>
    </form>
  );
}
