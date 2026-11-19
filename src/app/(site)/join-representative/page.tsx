import { PageHeader } from "@/components/cards";
import { RepApplicationForm } from "@/components/RepApplicationForm";
import { getDistricts, getStates } from "@/lib/data";

export const revalidate = 300;
export const metadata = { title: "Join as District Representative", description: "Apply to represent Vrutsa Foundation in your district." };

export default async function JoinRepresentative() {
  const [states, districts] = await Promise.all([getStates(), getDistricts()]);
  return (
    <>
      <PageHeader title="Join as District Representative" intro="District Representatives lead the foundation's work in their district. The founder reviews every application and makes each appointment personally." />
      <section className="section">
        <div className="wrap grid gap-14 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <h2 className="text-2xl">What a representative does</h2>
            <ul className="mt-5 space-y-3">
              {["Welcomes and coordinates the volunteers of the district", "Records the district's activities with photographs and videos", "Announces and runs district events", "Keeps a public profile so people in the district know whom to contact"].map((t) => (
                <li key={t} className="flex gap-3"><span aria-hidden="true" className="mt-2.5 h-2.5 w-2.5 shrink-0 rounded-full bg-saffron" />{t}</li>
              ))}
            </ul>
            <h2 className="mt-10 text-2xl">After you apply</h2>
            <p className="mt-3 text-[var(--color-muted)]">You receive an acknowledgement with a reference number. If the founder approves your application, you receive your login, your ID card and access to your district dashboard by email.</p>
          </div>
          <RepApplicationForm states={states as any} districts={districts as any} />
        </div>
      </section>
    </>
  );
}
