"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useRef } from "react";
import { FileField } from "../uploads";
import { FormMessage, Submit } from "../form";
import type { Field } from "@/lib/resources";
import type { SettingGroup } from "@/lib/settings";
import type { FormState } from "@/lib/types";
import { toISTInput } from "@/lib/utils";

export function AdminNav({ groups }: { groups: { title: string; items: { href: string; label: string; badge?: number }[] }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="space-y-6">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="px-3 text-xs font-semibold text-[var(--color-muted)]">{g.title}</p>
          <ul className="mt-1.5">
            {g.items.map((i) => {
              const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
              return (
                <li key={i.href}>
                  <Link href={i.href} aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-between rounded-lg border-l-4 px-3 py-2 text-[0.95rem] ${active ? "border-saffron bg-saffron-soft font-semibold" : "border-transparent hover:bg-neutral-100"}`}>
                    {i.label}
                    {!!i.badge && <span className="tag bg-kumkum text-white">{i.badge}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function ConfirmButton({ children, message, className = "btn btn-line btn-sm" }: { children: React.ReactNode; message: string; className?: string }) {
  return <button type="submit" className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>{children}</button>;
}

/** Date and time input with a Clear button: browsers give no easy way to empty a date-time field. */
function DateTimeField({ id, name, required, defaultValue }: { id: string; name: string; required?: boolean; defaultValue: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3">
      <input ref={ref} id={id} name={name} type="datetime-local" required={required} defaultValue={defaultValue} className="field" />
      {!required && <button type="button" className="btn btn-line btn-sm shrink-0" onClick={() => { if (ref.current) ref.current.value = ""; }}>Clear</button>}
    </div>
  );
}

type Options = Record<string, { value: string; label: string }[]>;
export function ResourceForm({ action, fields, row, options, allowEmptyDistrict }:
  { action: (s: FormState, fd: FormData) => Promise<FormState>; fields: Field[]; row: any; options: Options; allowEmptyDistrict: boolean }) {
  const [state, formAction] = useActionState(action, null);
  const val = (f: Field) => row?.[f.name] ?? f.default ?? "";
  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {fields.map((f) => {
        const id = `f-${f.name}`;
        if (f.type === "checkbox") return (
          <label key={f.name} className="flex items-start gap-3">
            <input type="checkbox" name={f.name} defaultChecked={row ? Boolean(row[f.name]) : f.default === "true"} className="mt-1 h-5 w-5 accent-[var(--color-leaf)]" />
            <span className="font-medium">{f.label}</span>
          </label>
        );
        const opts = f.type === "ref" ? options[f.ref!] ?? [] : f.options ?? [];
        const emptyOk = f.type === "ref" && (f.nullable ? (f.ref !== "districts" || allowEmptyDistrict) : false);
        return (
          <div key={f.name}>
            <label className="label" htmlFor={id}>{f.label}{f.required && <span aria-hidden="true"> *</span>}</label>
            {f.type === "textarea" ? <textarea id={id} name={f.name} rows={f.rows ?? 4} required={f.required} defaultValue={val(f)} className="field" />
              : f.type === "select" || f.type === "ref" ? (
                <select id={id} name={f.name} required={f.required} defaultValue={val(f)} className="field">
                  {(emptyOk || (f.type === "ref" && !f.nullable && !row)) && <option value="">{f.ref === "districts" && emptyOk ? "Foundation-wide (no district)" : f.nullable ? "None" : "Choose"}</option>}
                  {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === "file" ? <FileField name={f.name} defaultValue={val(f)} accept={f.accept} folder={f.folder} required={f.required} />
              : f.type === "user" ? <input id={id} name={f.name} type="email" defaultValue={row?.profiles?.email ?? ""} className="field" autoComplete="off" />
              : f.type === "datetime" ? <DateTimeField id={id} name={f.name} required={f.required} defaultValue={toISTInput(row?.[f.name])} />
              : <input id={id} name={f.name} required={f.required} className="field"
                  type={f.type === "number" ? "text" : f.type}
                  inputMode={f.type === "number" ? "decimal" : undefined}
                  defaultValue={val(f)} />}
            {f.help && <p className="help">{f.help}</p>}
          </div>
        );
      })}
      <FormMessage state={state} />
      <Submit>Save</Submit>
    </form>
  );
}

export function SettingsForm({ action, groups, values }: { action: (s: FormState, fd: FormData) => Promise<FormState>; groups: SettingGroup[]; values: Record<string, string> }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="max-w-2xl space-y-12">
      {groups.map((g) => (
        <fieldset key={g.title} className="space-y-5">
          <legend className="font-[family-name:var(--font-display)] text-2xl font-semibold">{g.title}</legend>
          {g.description && <p className="text-[var(--color-muted)]">{g.description}</p>}
          {g.fields.map((f) => (
            <div key={f.key}>
              <label className="label" htmlFor={`s-${f.key}`}>{f.label}</label>
              {f.type === "textarea" ? <textarea id={`s-${f.key}`} name={f.key} rows={f.rows ?? 4} defaultValue={values[f.key] ?? ""} className="field" />
                : f.type === "image" ? <FileField name={f.key} defaultValue={values[f.key] ?? ""} accept="image/jpeg,image/png,image/webp" folder="settings" />
                : f.type === "select" ? <select id={`s-${f.key}`} name={f.key} defaultValue={values[f.key] ?? f.options?.[0]?.value} className="field">{f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                : <input id={`s-${f.key}`} name={f.key} defaultValue={values[f.key] ?? ""} className="field" />}
              {f.help && <p className="help">{f.help}</p>}
            </div>
          ))}
        </fieldset>
      ))}
      <div className="sticky bottom-0 -mx-2 space-y-3 border-t border-line bg-white px-2 py-4">
        <FormMessage state={state} />
        <Submit>Save changes</Submit>
      </div>
    </form>
  );
}

export function GrantRoleForm({ action, roles, states, districts }: { action: (s: FormState, fd: FormData) => Promise<FormState>;
  roles: { key: string; name: string; scope: string }[]; states: { id: string; name: string }[]; districts: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="grid max-w-4xl gap-4 rounded-2xl border-2 border-black p-5 sm:grid-cols-2 lg:grid-cols-4">
      <div><label className="label" htmlFor="g-email">Registered email</label><input id="g-email" name="email" type="email" required className="field" /></div>
      <div><label className="label" htmlFor="g-role">Role</label><select id="g-role" name="role_key" required className="field">{roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select></div>
      <div><label className="label" htmlFor="g-state">State (state roles)</label><select id="g-state" name="state_id" className="field"><option value="">None</option>{states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div><label className="label" htmlFor="g-district">District (district roles)</label><select id="g-district" name="district_id" className="field"><option value="">None</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
      <div className="space-y-3 sm:col-span-2 lg:col-span-4"><FormMessage state={state} /><Submit className="btn btn-leaf btn-sm">Grant role</Submit></div>
    </form>
  );
}