"use client";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { submitRepApplication } from "@/app/actions/public";
import { FormMessage, Honeypot, Submit } from "./form";
import { Turnstile } from "./Turnstile";
import { PrivateUpload } from "./uploads";
import { ageFrom } from "./VolunteerForm";

type Opt = { id: string; name: string; state_id?: string };
const STEPS = ["About you", "Your work", "Your experience", "Review and submit"];
const EMPLOYMENT: [string, string][] = [["salaried", "Salaried employee"], ["self_employed", "Self-employed"], ["business_owner", "Business owner"], ["student", "Student"], ["other", "Other"]];

export function RepApplicationForm({ states, districts }: { states: Opt[]; districts: Opt[] }) {
  const [state, action] = useActionState(submitRepApplication, null);
  const [step, setStep] = useState(0);
  const [stateId, setStateId] = useState(states[0]?.id ?? "");
  const [dob, setDob] = useState("");
  const [employment, setEmployment] = useState("");
  const [stepError, setStepError] = useState("");
  const [summary, setSummary] = useState<[string, string][]>([]);
  const form = useRef<HTMLFormElement>(null);
  const panels = useRef<(HTMLFieldSetElement | null)[]>([]);
  const list = districts.filter((d) => !stateId || d.state_id === stateId);
  const age = ageFrom(dob);

  // All steps stay in the page (hidden, not removed), so nothing typed is lost when moving back and forth.
  function next() {
    setStepError("");
    const fields = Array.from(panels.current[step]?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea") ?? []);
    const bad = fields.find((f) => !f.checkValidity());
    if (bad) { bad.reportValidity(); return; }
    if (step === 0 && (age === null || age < 18)) return setStepError("Applicants must be 18 or older.");
    if (step === 0 && !new FormData(form.current!).get("photo_path")) return setStepError("Upload a passport-size photograph to continue.");
    if (step === 2) {
      const fd = new FormData(form.current!);
      const v = (k: string) => String(fd.get(k) ?? "");
      setSummary([["Name", v("full_name")], ["Date of birth", `${v("date_of_birth")} (age ${age})`], ["Email", v("email")], ["Mobile", v("phone")],
        ["District", districts.find((d) => d.id === v("district_id"))?.name ?? ""], ["City", v("city")],
        ["Employment", EMPLOYMENT.find(([k]) => k === v("employment_type"))?.[1] ?? ""], ["Photograph", v("photo_path") ? "Attached" : "Missing"],
        ["Supporting document", v("document_path") ? "Attached" : "None"]]);
    }
    setStep(step + 1);
    form.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (state?.ok) {
    return (
      <div className="rounded-2xl border-2 border-black p-6 sm:p-10" role="status">
        <p className="tag bg-leaf text-white">Application submitted</p>
        <h2 className="mt-4 text-3xl">Thank you. Your application is with the founder.</h2>
        <p className="mt-3 max-w-[60ch]">Every application is reviewed personally. We have emailed you an acknowledgement and will write again with the decision.</p>
        <p className="mt-5 text-sm text-[var(--color-muted)]">Your application reference</p>
        <p className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-wide">{state.reference}</p>
      </div>
    );
  }
  const hide = (i: number) => (step === i ? "grid gap-4 sm:grid-cols-2" : "hidden");
  return (
    <form ref={form} action={action} className="relative scroll-mt-24">
      <Honeypot />
      <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}>
            <span className={`block h-1.5 rounded-full ${i <= step ? "bg-leaf" : "bg-neutral-200"}`} />
            <span className={`mt-2 block text-sm ${i === step ? "font-semibold" : "text-[var(--color-muted)]"}`}><span className="sm:hidden">{i + 1}</span><span className="hidden sm:inline">{i + 1}. {s}</span></span>
          </li>
        ))}
      </ol>
      <h2 className="mb-5 text-2xl">{STEPS[step]}</h2>

      <fieldset ref={(el) => { panels.current[0] = el; }} className={hide(0)}>
        <div className="sm:col-span-2"><label className="label" htmlFor="a-name">Full name</label><input id="a-name" name="full_name" required autoComplete="name" className="field" /></div>
        <div><label className="label" htmlFor="a-dob">Date of birth</label><input id="a-dob" name="date_of_birth" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="field" /></div>
        <div><label className="label" htmlFor="a-age">Age</label><input id="a-age" readOnly tabIndex={-1} value={age ?? ""} placeholder="Calculated automatically" className="field bg-neutral-100" /></div>
        <div><label className="label" htmlFor="a-email">Email address</label><input id="a-email" name="email" type="email" required autoComplete="email" className="field" /></div>
        <div><label className="label" htmlFor="a-phone">Mobile number</label><input id="a-phone" name="phone" type="tel" required pattern="\+?[0-9][0-9\s\-]{8,15}" autoComplete="tel" className="field" /></div>
        <div><label className="label" htmlFor="a-state">State</label>
          <select id="a-state" name="state_id" className="field" value={stateId} onChange={(e) => setStateId(e.target.value)}>{states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div><label className="label" htmlFor="a-district">District you want to represent</label>
          <select id="a-district" name="district_id" required className="field" defaultValue="" key={stateId}><option value="">Choose a district</option>{list.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div><label className="label" htmlFor="a-city">City</label><input id="a-city" name="city" required className="field" autoComplete="address-level2" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="a-address">Complete house address</label><textarea id="a-address" name="address" rows={3} required minLength={10} className="field" autoComplete="street-address" /><p className="help">Seen only by the founder. Never published.</p></div>
        <div className="sm:col-span-2"><span className="label">Passport-size photograph</span><PrivateUpload name="photo_path" prefix="applicants" accept="image/jpeg,image/png" label="Upload photograph" /><p className="help">JPEG or PNG, under 5 MB. If you are appointed, this photograph appears on your public profile and ID card.</p></div>
      </fieldset>

      <fieldset ref={(el) => { panels.current[1] = el; }} className={hide(1)}>
        <div className="sm:col-span-2"><label className="label" htmlFor="a-emp">Employment type</label>
          <select id="a-emp" name="employment_type" required className="field max-w-sm" value={employment} onChange={(e) => setEmployment(e.target.value)}><option value="">Choose one</option>{EMPLOYMENT.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        {employment === "salaried" && <>
          <div><label className="label" htmlFor="a-org">Organisation or company name</label><input id="a-org" name="organisation" required className="field" /></div>
          <div><label className="label" htmlFor="a-des">Designation</label><input id="a-des" name="designation" required className="field" /></div></>}
        {employment === "business_owner" && <>
          <div><label className="label" htmlFor="a-bn">Business name</label><input id="a-bn" name="business_name" required className="field" /></div>
          <div><label className="label" htmlFor="a-bt">Business type</label><input id="a-bt" name="business_type" required className="field" /></div></>}
        {employment === "self_employed" && <div className="sm:col-span-2"><label className="label" htmlFor="a-prof">Profession or nature of work</label><input id="a-prof" name="profession" required className="field" /></div>}
        {employment === "student" && <>
          <div><label className="label" htmlFor="a-inst">College or institution name</label><input id="a-inst" name="institution" required className="field" /></div>
          <div><label className="label" htmlFor="a-course">Course</label><input id="a-course" name="course" required className="field" /></div></>}
        {employment === "other" && <div className="sm:col-span-2"><label className="label" htmlFor="a-other">Tell us what you do</label><input id="a-other" name="profession" required className="field" /></div>}
        {employment && employment !== "student" && (
          <div className="sm:col-span-2"><label className="label" htmlFor="a-income">{employment === "business_owner" ? "Annual business turnover" : "Annual income"} (optional)</label>
            <select id="a-income" name="annual_income" className="field max-w-sm" defaultValue=""><option value="">Prefer not to say</option><option>Below ₹3 lakh</option><option>₹3 to 6 lakh</option><option>₹6 to 12 lakh</option><option>₹12 to 25 lakh</option><option>Above ₹25 lakh</option></select>
            <p className="help">Seen only by the founder.</p></div>
        )}
      </fieldset>

      <fieldset ref={(el) => { panels.current[2] = el; }} className={hide(2)}>
        <div className="sm:col-span-2"><label className="label" htmlFor="a-mot">Why do you want to represent Vrutsa Foundation?</label><textarea id="a-mot" name="motivation" rows={4} required minLength={20} maxLength={2000} className="field" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="a-past">What social activities have you conducted before?</label><textarea id="a-past" name="past_activities" rows={3} maxLength={2000} className="field" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="a-ngo">Previous NGO or social organisation experience</label><textarea id="a-ngo" name="ngo_experience" rows={3} maxLength={2000} className="field" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="a-intro">Short personal introduction</label><textarea id="a-intro" name="introduction" rows={4} required minLength={20} maxLength={1500} className="field" /><p className="help">If you are appointed, this becomes the introduction on your public profile. You can edit it later.</p></div>
        <div className="sm:col-span-2"><span className="label">Supporting document (optional)</span><PrivateUpload name="document_path" prefix="documents" accept="image/jpeg,image/png,image/webp,application/pdf" label="Attach a document" /><p className="help">For example a certificate or a letter of reference. PDF or image, under 5 MB.</p></div>
      </fieldset>

      <div className={step === 3 ? "" : "hidden"}>
        <dl className="grid gap-x-8 gap-y-3 rounded-xl border border-line p-5 sm:grid-cols-2">
          {summary.map(([k, v]) => <div key={k}><dt className="text-sm text-[var(--color-muted)]">{k}</dt><dd className="font-medium break-words">{v || "Not given"}</dd></div>)}
        </dl>
        <label className="mt-5 flex items-start gap-3 text-[0.95rem]">
          <input type="checkbox" name="consent" required={step === 3} className="mt-1 h-5 w-5 accent-[var(--color-leaf)]" />
          <span>I confirm that these details are true, and I agree that Vrutsa Foundation may store and review them to consider my application, as described in the <Link href="/privacy" className="link">privacy policy</Link>.</span>
        </label>
        <div className="mt-4"><Turnstile /></div>
      </div>

      <div className="mt-6 space-y-4">
        {stepError && <p className="notice notice-err" role="alert">{stepError}</p>}
        <FormMessage state={state} />
        <div className="flex flex-wrap gap-3">
          {step > 0 && <button type="button" className="btn btn-line" onClick={() => { setStepError(""); setStep(step - 1); }}>Back</button>}
          {step < 3 ? <button type="button" className="btn btn-leaf" onClick={next}>Continue</button> : <Submit className="btn btn-saffron" pending="Submitting…">Submit my application</Submit>}
        </div>
      </div>
    </form>
  );
}
