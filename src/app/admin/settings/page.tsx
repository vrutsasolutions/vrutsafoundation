import { saveSettings } from "@/app/actions/admin";
import { SettingsForm } from "@/components/admin/ui";
import { requireSuper } from "@/lib/auth";
import { SETTINGS_GROUPS, SETTING_DEFAULTS } from "@/lib/settings";

export const metadata = { title: "Settings" };

export default async function Page() {
  const s = await requireSuper();
  const { data } = await s.supabase.from("foundation_settings").select("key,value");
  const values = { ...SETTING_DEFAULTS, ...Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? ""])) };
  return (
    <>
      <h1 className="text-4xl">Settings</h1>
      <p className="mb-10 mt-2 max-w-[70ch] text-[var(--color-muted)]">Donation details, contact details and how district content is published.</p>
      <SettingsForm action={saveSettings} groups={SETTINGS_GROUPS} values={values} />
    </>
  );
}
