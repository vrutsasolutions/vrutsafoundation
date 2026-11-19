import Link from "next/link";
import { Empty, LeaderCard, PageHeader } from "@/components/cards";
import { Img } from "@/components/Img";
import { getCategories, getLeaders, getSettings } from "@/lib/data";
import { lines, paragraphs } from "@/lib/utils";

export const revalidate = 60;
export const metadata = { title: "About us" };

export default async function About() {
  const [s, leaders, categories] = await Promise.all([getSettings(), getLeaders(), getCategories()]);
  const central = leaders.filter((l) => !l.district_id && !l.state_id);
  const blocks = [["Mission", s.mission], ["Vision", s.vision], ["Our purpose", s.purpose]].filter(([, v]) => v);
  const hasContent = s.about_long || blocks.length || s.objectives || s.approach || s.commitment || s.founder_message;

  return (
    <>
      <PageHeader title="About Vrutsa Foundation" intro={s.about_short} />
      {!hasContent && <div className="wrap section"><Empty>The foundation&apos;s story, mission and vision will be published here.</Empty></div>}

      {s.about_long && (
        <section className="section">
          <div className={`wrap grid gap-12 ${s.about_image ? "lg:grid-cols-2" : ""}`}>
            <div className="prose-plain max-w-[68ch] text-lg">{paragraphs(s.about_long).map((p, i) => <p key={i}>{p}</p>)}</div>
            {s.about_image && <div className="relative aspect-[4/3] overflow-hidden rounded-2xl"><Img src={s.about_image} alt="" sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" /></div>}
          </div>
        </section>
      )}

      {blocks.length > 0 && (
        <section className="section bg-gradient-to-b from-white via-saffron-soft/35 to-white">
          <div className="wrap">
            <div className={`grid divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white shadow-[0_20px_50px_-30px_rgba(0,0,0,0.25)] sm:divide-x sm:divide-y-0 ${["", "", "sm:grid-cols-2", "sm:grid-cols-3"][blocks.length]}`}>
              {blocks.map(([k, v], i) => (
                <div key={k} className="p-8 sm:p-10">
                  <span className={`block h-1.5 w-14 rounded-full ${["bg-saffron", "bg-leaf", "bg-kumkum"][i]}`} />
                  <h2 className="mt-5 text-3xl">{k}</h2>
                  <p className="mt-3 text-lg text-[var(--color-muted)]">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {(s.objectives || s.approach) && (
        <section className="section">
          <div className="wrap grid gap-14 lg:grid-cols-2">
            {s.objectives && (
              <div>
                <h2 className="h-section">Objectives</h2>
                <ul className="mt-6 space-y-3 text-lg">
                  {lines(s.objectives).map((o, i) => <li key={i} className="flex gap-3"><span aria-hidden="true" className="mt-2.5 h-2.5 w-2.5 shrink-0 rounded-full bg-saffron" />{o}</li>)}
                </ul>
              </div>
            )}
            {s.approach && (
              <div>
                <h2 className="h-section">Our approach</h2>
                <div className="prose-plain mt-6 text-lg text-[var(--color-muted)]">{paragraphs(s.approach).map((p, i) => <p key={i}>{p}</p>)}</div>
              </div>
            )}
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <section className="section border-t border-line">
          <div className="wrap">
            <h2 className="h-section">Our focus areas</h2>
            <ul className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
              {categories.map((c) => (
                <li key={c.id} className="border-t-2 border-black pt-4">
                  <h3 className="text-xl"><Link href={`/activities?category=${c.id}`} className="hover:underline">{c.name}</Link></h3>
                  {c.description && <p className="mt-1 text-[var(--color-muted)]">{c.description}</p>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {s.commitment && (
        <section className="bg-leaf text-white">
          <div className={`wrap grid items-center gap-10 py-16 sm:py-20 ${s.commitment_image ? "lg:grid-cols-[1.15fr_1fr] lg:gap-14" : ""}`}>
            <div>
              <h2 className="h-section">Our commitment</h2>
              <p className="mt-5 max-w-[60ch] text-xl leading-relaxed text-white/90">{s.commitment}</p>
            </div>
            {s.commitment_image && (
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-[0_30px_60px_-25px_rgba(0,0,0,0.55)] ring-1 ring-white/15">
                <Img src={s.commitment_image} alt="" sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" />
              </div>
            )}
          </div>
        </section>
      )}

      {s.founder_message && (
        <section className="section">
          <div className="wrap grid gap-10 lg:grid-cols-[280px_1fr]">
            <div>
              {s.founder_photo && <div className="relative aspect-[4/5] overflow-hidden rounded-2xl"><Img src={s.founder_photo} alt={s.founder_name ?? ""} sizes="280px" className="object-cover" /></div>}
            </div>
            <div>
              <h2 className="h-section">A message from our trustee</h2>
              <div className="prose-plain mt-6 max-w-[66ch] text-lg">{paragraphs(s.founder_message).map((p, i) => <p key={i}>{p}</p>)}</div>
              {s.founder_name && <p className="mt-6 font-[family-name:var(--font-display)] text-xl font-semibold">{s.founder_name}</p>}
              {s.founder_title && <p className="text-[var(--color-muted)]">{s.founder_title}</p>}
            </div>
          </div>
        </section>
      )}

      {central.length > 0 && (
        <section className="section border-t border-line">
          <div className="wrap">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="h-section">Leadership</h2>
              <Link href="/network" className="link">See the full network</Link>
            </div>
            <div className="mt-10 grid gap-10 md:grid-cols-2">{central.map((p) => <LeaderCard key={p.id} p={p} />)}</div>
          </div>
        </section>
      )}
    </>
  );
}