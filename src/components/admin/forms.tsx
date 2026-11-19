"use client";
import { useActionState } from "react";
import { FormMessage, Submit } from "../form";
import { FileField } from "../uploads";
import type { FormState } from "@/lib/types";

type Act = (s: FormState, fd: FormData) => Promise<FormState>;
type Opt = { id: string; name: string };

export function AddVolunteerForm({ action, districts }: { action: Act; districts: Opt[] }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="grid max-w-4xl gap-4 rounded-2xl border-2 border-black p-5 sm:grid-cols-2 lg:grid-cols-3" key={state?.ok ? state.message : "f"}>
      <div><label className="label" htmlFor="av-name">Full name</label><input id="av-name" name="full_name" required className="field" /></div>
      <div><label className="label" htmlFor="av-phone">Mobile number</label><input id="av-phone" name="phone" type="tel" className="field" /></div>
      <div><label className="label" htmlFor="av-email">Email (for the ID card)</label><input id="av-email" name="email" type="email" className="field" /></div>
      <div><label className="label" htmlFor="av-district">District</label><select id="av-district" name="district_id" required className="field">{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
      <div><label className="label" htmlFor="av-city">City or town</label><input id="av-city" name="city" className="field" /></div>
      <div><label className="label" htmlFor="av-dob">Date of birth</label><input id="av-dob" name="date_of_birth" type="date" className="field" /></div>
      <div><label className="label" htmlFor="av-occ">Occupation</label><input id="av-occ" name="occupation" className="field" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="av-int">Interest or skills</label><input id="av-int" name="interest" className="field" /></div>
      <label className="flex items-start gap-3 text-[0.95rem] sm:col-span-2 lg:col-span-3"><input type="checkbox" name="consent_contact" required className="mt-1 h-5 w-5 accent-[var(--color-leaf)]" /><span>This person asked to join and agreed that the foundation may store these details and contact them.</span></label>
      <div className="space-y-3 sm:col-span-2 lg:col-span-3"><FormMessage state={state} /><Submit className="btn btn-leaf btn-sm">Add volunteer</Submit></div>
    </form>
  );
}

export function RecordDonationForm({ action, purposes }: { action: Act; purposes: string[] }) {
  const [state, formAction] = useActionState(action, null);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} className="grid max-w-4xl gap-4 rounded-2xl border-2 border-black p-5 sm:grid-cols-2 lg:grid-cols-4" key={state?.ok ? state.message : "f"}>
      <div className="lg:col-span-2"><label className="label" htmlFor="rd-name">Donor name</label><input id="rd-name" name="donor_name" required className="field" /></div>
      <div><label className="label" htmlFor="rd-amount">Amount (₹)</label><input id="rd-amount" name="amount" inputMode="decimal" required className="field" /></div>
      <div><label className="label" htmlFor="rd-date">Date received</label><input id="rd-date" name="paid_on" type="date" required max={today} defaultValue={today} className="field" /></div>
      <div className="lg:col-span-2"><label className="label" htmlFor="rd-utr">Bank reference / UTR</label><input id="rd-utr" name="utr" required className="field uppercase" /></div>
      <div><label className="label" htmlFor="rd-email">Donor email (optional)</label><input id="rd-email" name="email" type="email" className="field" /></div>
      <div><label className="label" htmlFor="rd-phone">Donor mobile (optional)</label><input id="rd-phone" name="phone" className="field" /></div>
      <div className="lg:col-span-2"><label className="label" htmlFor="rd-purpose">Purpose (optional)</label>
        {purposes.length ? <select id="rd-purpose" name="purpose" className="field"><option value="">Not stated</option>{purposes.map((p) => <option key={p}>{p}</option>)}</select> : <input id="rd-purpose" name="purpose" className="field" />}</div>
      <div className="lg:col-span-2"><label className="label" htmlFor="rd-note">Internal note (optional)</label><input id="rd-note" name="note" className="field" placeholder="For example: statement of 16 November" /></div>
      <label className="flex items-start gap-3 text-[0.95rem] sm:col-span-2 lg:col-span-4"><input type="checkbox" name="checked" required className="mt-1 h-5 w-5 accent-[var(--color-leaf)]" /><span>I have seen this amount credited in the foundation&apos;s bank account.</span></label>
      <div className="space-y-3 sm:col-span-2 lg:col-span-4"><FormMessage state={state} /><Submit className="btn btn-leaf btn-sm">Record verified donation</Submit><p className="text-sm text-[var(--color-muted)]">With an email address, the donor receives the numbered acknowledgement PDF.</p></div>
    </form>
  );
}

export function AnnouncementForm({ action, districts, allowAll }: { action: Act; districts: Opt[]; allowAll: boolean }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="max-w-2xl space-y-4 rounded-2xl border-2 border-black p-5" key={state?.ok ? state.message : "f"}>
      <div><label className="label" htmlFor="an-to">Send to</label>
        <select id="an-to" name="district_id" className="field">{allowAll && <option value="">All active members, every district</option>}{districts.map((d) => <option key={d.id} value={d.id}>Members in {d.name}</option>)}</select></div>
      <div><label className="label" htmlFor="an-title">Subject</label><input id="an-title" name="title" required maxLength={160} className="field" /></div>
      <div><label className="label" htmlFor="an-body">Message</label><textarea id="an-body" name="body" rows={6} required maxLength={3000} className="field" /></div>
      <FormMessage state={state} />
      <Submit className="btn btn-leaf btn-sm" pending="Queueing…">Send announcement</Submit>
      <p className="text-sm text-[var(--color-muted)]">Goes by email to every active member in the selection, and by WhatsApp to volunteers who opted in. It also appears in their account. Each announcement can be sent once.</p>
    </form>
  );
}

export function RepProfileForm({ action, profile }: { action: Act; profile: any }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <div><span className="label">Profile photograph</span><FileField name="photo_url" defaultValue={profile.photo_url ?? ""} accept="image/jpeg,image/png,image/webp" folder="people" /></div>
      <div><label className="label" htmlFor="rp-bio">Professional introduction</label><textarea id="rp-bio" name="bio" rows={4} maxLength={1500} defaultValue={profile.bio ?? ""} className="field" /></div>
      <div><label className="label" htmlFor="rp-exp">Social service experience</label><textarea id="rp-exp" name="experience" rows={5} maxLength={3000} defaultValue={profile.experience ?? ""} className="field" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="rp-email">Official email</label><input id="rp-email" name="email" type="email" defaultValue={profile.email ?? ""} className="field" /></div>
        <div><label className="label" htmlFor="rp-phone">Official contact number</label><input id="rp-phone" name="phone" defaultValue={profile.phone ?? ""} className="field" /></div>
      </div>
      <label className="flex items-start gap-3"><input type="checkbox" name="show_contact" defaultChecked={profile.show_contact} className="mt-1 h-5 w-5 accent-[var(--color-leaf)]" /><span>Show this email and number on my public district page. Use official contact details, not private ones.</span></label>
      <FormMessage state={state} />
      <Submit>Save my profile</Submit>
    </form>
  );
}
