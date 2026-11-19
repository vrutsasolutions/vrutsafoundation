"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { changePassword, emailMyIdCard, login, register, requestPasswordReset, updateMembership, updateProfile } from "@/app/actions/auth";
import { PrivateUpload } from "./uploads";
import { browserDb } from "@/lib/supabase/client";

/** "Continue with Google". Shown only when NEXT_PUBLIC_GOOGLE_LOGIN=on, after Google is enabled in Supabase. */
export function GoogleButton() {
  const [err, setErr] = useState("");
  if (process.env.NEXT_PUBLIC_GOOGLE_LOGIN !== "on") return null;
  async function go() {
    const c = browserDb();
    if (!c) return setErr("Sign-in is not available right now.");
    // After Google, /login sends each person to the right place for their role.
    const { error } = await c.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=/login` } });
    if (error) setErr(error.message);
  }
  return (
    <div>
      <div className="my-5 flex items-center gap-3 text-sm text-[var(--color-muted)]"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <button type="button" onClick={go} className="btn btn-line w-full">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.96 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"/></svg>
        Continue with Google
      </button>
      {err && <p className="mt-2 text-sm text-kumkum" role="alert">{err}</p>}
      <p className="mt-2 text-sm text-[var(--color-muted)]">Use the Google account with the same email address as your Vrutsa Foundation account.</p>
    </div>
  );
}
import { FormMessage, Submit } from "./form";

export function LoginForm({ next, portal = "member" }: { next?: string; portal?: "member" | "representative" | "founder" }) {
  const [state, action] = useActionState(login, null);
  const [reset, resetAction] = useActionState(requestPasswordReset, null);
  const [forgot, setForgot] = useState(false);
  if (forgot) return (
    <form action={resetAction} className="space-y-4">
      <div><label className="label" htmlFor="reset-email">Email</label><input id="reset-email" name="email" type="email" required autoComplete="email" className="field" /></div>
      <FormMessage state={reset} />
      <Submit className="btn btn-leaf w-full" pending="Sending…">Email me a reset link</Submit>
      <button type="button" className="link text-sm" onClick={() => setForgot(false)}>Back to sign in</button>
    </form>
  );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="portal" value={portal} />
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" className="field" /></div>
      <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" className="field" /></div>
      <FormMessage state={state} />
      <Submit className="btn btn-leaf w-full" pending="Signing in…">Sign in</Submit>
      <p className="flex justify-between text-sm">
        <button type="button" className="link" onClick={() => setForgot(true)}>Forgot password</button>
        {portal === "member" && <Link href="/get-involved" className="link">Register as a volunteer</Link>}
      </p>
      <GoogleButton />
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(register, null);
  if (state?.ok) return <p className="notice notice-ok" role="status">{state.message}</p>;
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="full_name">Full name</label><input id="full_name" name="full_name" required autoComplete="name" className="field" /></div>
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" className="field" /></div>
      <div><label className="label" htmlFor="phone">Mobile number (optional)</label><input id="phone" name="phone" type="tel" autoComplete="tel" className="field" /></div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className="field" aria-describedby="pw-help" />
        <p id="pw-help" className="help">At least 10 characters, with uppercase, lowercase and a number.</p>
      </div>
      <FormMessage state={state} />
      <Submit className="btn btn-leaf w-full" pending="Creating…">Create my account</Submit>
      <p className="text-sm">Already registered? <Link href="/login" className="link">Sign in</Link></p>
    </form>
  );
}

type Opt = { id: string; name: string; state_id?: string };
export function ProfileForm({ profile, states, districts }: { profile: any; states: Opt[]; districts: Opt[] }) {
  const [state, action] = useActionState(updateProfile, null);
  const [stateId, setStateId] = useState(profile?.state_id ?? "");
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div><label className="label" htmlFor="p-name">Full name</label><input id="p-name" name="full_name" defaultValue={profile?.full_name ?? ""} className="field" /></div>
      <div><label className="label" htmlFor="p-phone">Mobile number</label><input id="p-phone" name="phone" defaultValue={profile?.phone ?? ""} className="field" /></div>
      <div><label className="label" htmlFor="p-state">State</label>
        <select id="p-state" name="state_id" value={stateId} onChange={(e) => setStateId(e.target.value)} className="field"><option value="">Not set</option>{states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div><label className="label" htmlFor="p-district">District</label>
        <select id="p-district" name="district_id" defaultValue={profile?.district_id ?? ""} key={stateId} className="field"><option value="">Not set</option>{districts.filter((d) => !stateId || d.state_id === stateId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
      <div><label className="label" htmlFor="p-city">City or town</label><input id="p-city" name="city" defaultValue={profile?.city ?? ""} className="field" /></div>
      <div className="space-y-3 sm:col-span-2"><FormMessage state={state} /><Submit>Save profile</Submit></div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, null);
  return (
    <form action={action} className="max-w-sm space-y-3">
      <label className="label" htmlFor="new-password">New password</label>
      <input id="new-password" name="password" type="password" required minLength={10} autoComplete="new-password" className="field" />
      <p className="help">At least 10 characters, with uppercase, lowercase and a number.</p>
      <FormMessage state={state} />
      <Submit className="btn btn-line btn-sm">Change password</Submit>
    </form>
  );
}

export function MembershipForm({ member }: { member: any }) {
  const [state, action] = useActionState(updateMembership, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div><label className="label" htmlFor="m-phone">Mobile number</label><input id="m-phone" name="phone" defaultValue={member.phone ?? ""} className="field" /></div>
      <div><label className="label" htmlFor="m-city">City or town</label><input id="m-city" name="city" defaultValue={member.city ?? ""} className="field" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="m-address">House address</label><textarea id="m-address" name="address" rows={2} defaultValue={member.address ?? ""} className="field" /></div>
      <div><label className="label" htmlFor="m-occ">Occupation</label><input id="m-occ" name="occupation" defaultValue={member.occupation ?? ""} className="field" /></div>
      <div><label className="label" htmlFor="m-av">Availability</label><input id="m-av" name="availability" defaultValue={member.availability ?? ""} className="field" /></div>
      <div><label className="label" htmlFor="m-int">Interest in volunteering</label><input id="m-int" name="interest" defaultValue={member.interest ?? ""} className="field" /></div>
      <div><label className="label" htmlFor="m-sk">Skills</label><input id="m-sk" name="skills" defaultValue={member.skills ?? ""} className="field" /></div>
      <div className="sm:col-span-2"><span className="label">{member.photo_path ? "Replace my ID photograph" : "Add my ID photograph"}</span><PrivateUpload name="photo_path" prefix="applicants" accept="image/jpeg,image/png" label="Upload photograph" /></div>
      <label className="flex items-start gap-3 text-[0.95rem] sm:col-span-2"><input type="checkbox" name="whatsapp_opt_in" defaultChecked={member.whatsapp_opt_in} className="mt-1 h-5 w-5 accent-[var(--color-leaf)]" /><span>Send me foundation updates on WhatsApp.</span></label>
      <p className="text-sm text-[var(--color-muted)] sm:col-span-2">Your name, date of birth and district are part of your ID card. To change them, contact your District Representative.</p>
      <div className="space-y-3 sm:col-span-2"><FormMessage state={state} /><Submit>Save my details</Submit></div>
    </form>
  );
}

export function EmailCardButton() {
  const [state, action] = useActionState(emailMyIdCard, null);
  return <form action={action} className="space-y-2"><Submit className="btn btn-line btn-sm" pending="Sending…">Email me my ID card</Submit><FormMessage state={state} /></form>;
}