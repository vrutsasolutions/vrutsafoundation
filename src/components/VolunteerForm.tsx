"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { registerVolunteer } from "@/app/actions/public";
import { FormMessage, Honeypot, Submit } from "./form";
import { Turnstile } from "./Turnstile";
import { PrivateUpload } from "./uploads";

type Opt = { id: string; name: string; state_id?: string; slug?: string };
export const ageFrom = (dob: string) => {
  if (!dob) return null;
  const b = new Date(dob), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return Number.isFinite(a) && a >= 0 && a < 120 ? a : null;
};

export function VolunteerForm({ states, districts, preselect, profile, signedIn }: { states: Opt[]; districts: Opt[]; preselect?: string; profile?: any; signedIn: boolean }) {
  const [state, action] = useActionState(registerVolunteer, null);
  const pre = districts.find((d) => d.slug === preselect);
  const [stateId, setStateId] = useState(pre?.state_id ?? profile?.state_id ?? states[0]?.id ?? "");
  const [dob, setDob] = useState("");
  const list = districts.filter((d) => !stateId || d.state_id === stateId);
  const age = ageFrom(dob);

  if (state?.ok) {
    const confirm = state.message === "confirm-email";
    return (
      <div className="rounded-2xl border-2 border-black p-6 sm:p-10" role="status">
        <p className="tag bg-leaf text-white">{confirm ? "One step left" : "Registered"}</p>
        <h2 className="mt-4 text-3xl">{confirm ? "Confirm your email address" : "Welcome to Vrutsa Foundation"}</h2>
        <p className="mt-3 max-w-[60ch]">
          {confirm
            ? "We have sent a confirmation link to your email address. Open it to activate your membership. Your membership ID and ID card are emailed to you straight after."
            : <>You are a registered volunteer{state.reference ? <> with membership ID <strong>{state.reference}</strong></> : null}. Your ID card is in your account and on its way by email.</>}
        </p>
        {!confirm && <Link href="/account" className="btn btn-leaf mt-6">Open my account</Link>}
      </div>
    );
  }
  return (
    <form action={action} className="relative grid gap-4 sm:grid-cols-2">
      <Honeypot />
      <div className="sm:col-span-2"><label className="label" htmlFor="full_name">Full name (as it should appear on your ID card)</label><input id="full_name" name="full_name" required autoComplete="name" defaultValue={profile?.full_name ?? ""} className="field" /></div>
      <div>
        <label className="label" htmlFor="date_of_birth">Date of birth</label>
        <input id="date_of_birth" name="date_of_birth" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="field" />
      </div>
      <div><label className="label" htmlFor="age">Age</label><input id="age" readOnly tabIndex={-1} value={age ?? ""} placeholder="Calculated from date of birth" className="field bg-neutral-100" aria-describedby="age-help" /><p id="age-help" className="help">Volunteers must be 18 or older.</p></div>
      <div><label className="label" htmlFor="v-email">Email</label><input id="v-email" name="email" type="email" required autoComplete="email" defaultValue={profile?.email ?? ""} readOnly={signedIn} className={`field ${signedIn ? "bg-neutral-100" : ""}`} /></div>
      <div><label className="label" htmlFor="v-phone">Mobile number</label><input id="v-phone" name="phone" type="tel" required autoComplete="tel" defaultValue={profile?.phone ?? ""} className="field" /></div>
      <div>
        <label className="label" htmlFor="gender">Gender (optional)</label>
        <select id="gender" name="gender" className="field" defaultValue=""><option value="">Prefer not to say</option><option>Female</option><option>Male</option><option>Other</option></select>
      </div>
      <div><label className="label" htmlFor="occupation">Occupation</label><input id="occupation" name="occupation" className="field" /></div>
      <div>
        <label className="label" htmlFor="state_id">State</label>
        <select id="state_id" className="field" value={stateId} onChange={(e) => setStateId(e.target.value)}>
          {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="district_id">District</label>
        <select id="district_id" name="district_id" required className="field" defaultValue={pre?.id ?? profile?.district_id ?? ""} key={stateId}>
          <option value="">Choose your district</option>
          {list.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div><label className="label" htmlFor="city">City or town</label><input id="city" name="city" className="field" autoComplete="address-level2" /></div>
      <div><label className="label" htmlFor="availability">When are you available?</label><input id="availability" name="availability" className="field" placeholder="For example: weekends" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="address">House address</label><textarea id="address" name="address" rows={2} className="field" autoComplete="street-address" /><p className="help">Seen only by you, your District Representative and the foundation office. Never shown on the website.</p></div>
      <div><label className="label" htmlFor="interest">Why would you like to volunteer?</label><input id="interest" name="interest" className="field" /></div>
      <div><label className="label" htmlFor="skills">Skills and areas of interest</label><input id="skills" name="skills" className="field" placeholder="For example: teaching, first aid" /></div>
      <div className="sm:col-span-2">
        <span className="label">Photograph for your ID card</span>
        <PrivateUpload name="photo_path" prefix="applicants" accept="image/jpeg,image/png" label="Upload photograph" />
        <p className="help">A clear face photograph, JPEG or PNG, under 5 MB. You can add it later from your account.</p>
      </div>
      {!signedIn && (
        <div className="sm:col-span-2">
          <label className="label" htmlFor="password">Choose a password for your volunteer account</label>
          <input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className="field max-w-sm" />
          <p className="help">At least 10 characters, with uppercase, lowercase and a number.</p>
        </div>
      )}
      <label className="flex items-start gap-3 text-[0.95rem] sm:col-span-2">
        <input type="checkbox" name="consent_contact" required className="mt-1 h-5 w-5 accent-[var(--color-leaf)]" />
        <span>I am 18 or older, the details above are true, and I agree that Vrutsa Foundation may store them and contact me about volunteering, as described in the <Link href="/privacy" className="link">privacy policy</Link>.</span>
      </label>
      <label className="flex items-start gap-3 text-[0.95rem] sm:col-span-2">
        <input type="checkbox" name="whatsapp_opt_in" className="mt-1 h-5 w-5 accent-[var(--color-leaf)]" />
        <span>Send me foundation updates on WhatsApp as well.</span>
      </label>
      <div className="space-y-4 sm:col-span-2">
        <Turnstile />
        <FormMessage state={state} />
        <Submit className="btn btn-leaf" pending="Registering…">Register as a volunteer</Submit>
      </div>
    </form>
  );
}
