import Link from "next/link";
import { ActivityCard, Empty, EventCard, RepCard } from "@/components/cards";
import { Carousel } from "@/components/Carousel";
import { HomeSlider } from "@/components/HomeSlider";
import { Img } from "@/components/Img";
import { Mesh } from "@/components/Mesh";
import { getCategories, getDistricts, getHeroSlides, getLeaders, getSettings, listActivities, listEvents } from "@/lib/data";

export const revalidate = 60;

const TILE = ["bg-saffron text-black", "bg-leaf text-white", "bg-kumkum text-white", "bg-peacock text-white"];
// Shown when the founder has not picked featured representatives yet.
const DEFAULT_FEATURED = ["chennai", "coimbatore", "madurai", "tiruchirappalli", "salem"];

export default async function Home() {
  const [s, slides, categories, activities, events, leaders, districts] = await Promise.all([
    getSettings(), getHeroSlides(), getCategories(), listActivities({ limit: 3 }), listEvents(), getLeaders(), getDistricts(),
  ]);
  const district = (id?: string) => districts.find((d) => d.id === id);
  const districtReps = leaders.filter((l) => l.district_id);
  const picked = districtReps.filter((l) => l.is_featured).sort((a, b) => a.featured_order - b.featured_order);
  const featured = (picked.length ? picked
    : DEFAULT_FEATURED.map((slug) => districtReps.find((l) => district(l.district_id)?.slug === slug)).filter(Boolean) as typeof leaders).slice(0, 5);
  const led = new Set(districtReps.map((l) => l.district_id)).size;
  const hasFounder = Boolean(s.founder_name && (s.founder_intro || s.founder_quote || s.founder_photo));

  const buttons = (
    <>
      <Link href="/activities" className="btn btn-line">Explore our work</Link>
      <Link href="/donate" className="btn btn-saffron">Donate now</Link>
      <Link href="/get-involved" className="btn btn-leaf">Get involved</Link>
    </>
  );

  return (
    <>
      {slides.length > 0 ? (
        <HomeSlider slides={slides as any} fallbackTitle={s.org_name}>{buttons}</HomeSlider>
      ) : (
        <section className="overflow-hidden">
          <div className="wrap grid items-center gap-6 py-12 sm:py-16 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <h1 className="h-display rise">{s.org_name}</h1>
              <div className="rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: "160ms" }}>{buttons}</div>
            </div>
            <Mesh className="mx-auto w-full max-w-[380px] lg:max-w-[460px]" />
          </div>
        </section>
      )}

      {(s.about_short || s.mission || s.vision) && (
        <section className="section">
          <div className="wrap grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
            <div>
              <h2 className="h-section">Who we are</h2>
              {s.about_short && <p className="mt-5 text-xl leading-relaxed">{s.about_short}</p>}
              <Link href="/about" className="btn btn-line mt-7">Read more about us</Link>
            </div>
            <dl className="space-y-7 self-end">
              {[["Our mission", s.mission], ["Our vision", s.vision], ["Our purpose", s.purpose], ["Our commitment to society", s.commitment]].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="border-l-4 border-saffron pl-5">
                  <dt className="font-[family-name:var(--font-display)] text-lg font-semibold">{k}</dt>
                  <dd className="mt-1 text-[var(--color-muted)]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <section className="section border-t border-line">
          <div className="wrap">
            <h2 className="h-section">Our focus areas</h2>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((c, i) => (
                <li key={c.id}>
                  <Link href={`/activities?category=${c.id}`} className={`group flex h-full min-h-[230px] flex-col justify-between overflow-hidden rounded-2xl ${TILE[i % TILE.length]}`}>
                    {c.image_url && <div className="relative aspect-[16/10]"><Img src={c.image_url} alt="" sizes="(min-width:1024px) 25vw, 50vw" className="object-cover" /></div>}
                    <div className="mt-auto p-6">
                      <h3 className="text-2xl decoration-2 underline-offset-4 group-hover:underline">{c.name}</h3>
                      {c.description && <p className="mt-2 text-[0.95rem] opacity-90">{c.description}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="section border-t border-line">
        <div className="wrap">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="h-section">Our work on the ground</h2>
            <Link href="/activities" className="link">See all activities</Link>
          </div>
          <div className="mt-10">
            {activities.length ? (
              <div className="grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">{activities.slice(0, 3).map((a) => <ActivityCard key={a.id} a={a} />)}</div>
            ) : <Empty>Photographs and reports of our activities will be published here.</Empty>}
          </div>
        </div>
      </section>

      <section className="section border-t border-line">
        <div className="wrap">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="h-section">Upcoming events</h2>
            <Link href="/events" className="link">See all events</Link>
          </div>
          <div className="mt-8">
            {events.upcoming.length ? <Carousel label="Upcoming events">{events.upcoming.slice(0, 10).map((e) => <li key={e.id}><EventCard e={e} /></li>)}</Carousel>
              : <Empty>No events are scheduled right now.</Empty>}
          </div>
        </div>
      </section>

      <section className="section border-t border-line">
        <div className="wrap">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="h-section">Past events</h2>
            <Link href="/events#past" className="link">See all past events</Link>
          </div>
          <div className="mt-8">
            {events.past.length ? <Carousel label="Past events">{events.past.slice(0, 10).map((e) => <li key={e.id}><EventCard e={e} /></li>)}</Carousel>
              : <Empty>Completed events, with photographs and results, will be shown here.</Empty>}
          </div>
        </div>
      </section>

      <section className="section border-t border-line">
        <div className="wrap">
          <h2 className="h-section">The people behind the foundation</h2>
          {hasFounder && (
            <div className="mt-10 grid items-center gap-8 md:grid-cols-[220px_1fr]">
              <div className="relative mx-auto aspect-square w-48 overflow-hidden rounded-2xl bg-saffron-soft md:w-full">
                {s.founder_photo ? <Img src={s.founder_photo} alt="" sizes="220px" className="object-cover" />
                  : <span className="flex h-full w-full items-center justify-center font-[family-name:var(--font-display)] text-6xl font-semibold text-leaf">{s.founder_name.slice(0, 1)}</span>}
              </div>
              <div>
                <h3 className="text-3xl">{s.founder_name}</h3>
                <p className="mt-1 font-medium text-leaf">{s.founder_title || "Founder"}</p>
                {s.founder_intro && <p className="mt-4 max-w-[64ch] text-lg">{s.founder_intro}</p>}
                {s.founder_quote && <blockquote className="mt-5 max-w-[56ch] border-l-4 border-saffron pl-5 font-[family-name:var(--font-display)] text-xl font-medium leading-snug">{s.founder_quote}</blockquote>}
              </div>
            </div>
          )}
          <div className={hasFounder ? "mt-14" : "mt-10"}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h3 className="text-2xl">District Representatives</h3>
              <Link href="/network" className="link">View our network</Link>
            </div>
            <div className="mt-6">
              {featured.length ? (
                <Carousel label="District Representatives">
                  {featured.map((p) => <li key={p.id}><RepCard p={p} district={district(p.district_id)?.name} slug={district(p.district_id)?.slug} /></li>)}
                </Carousel>
              ) : <Empty>District Representatives appear here as they are appointed.</Empty>}
            </div>
            {districts.length > 0 && (
              <p className="mt-6 text-[0.97rem]"><strong>{districts.length}</strong> districts listed{led > 0 && <>, <strong>{led}</strong> with an appointed representative</>}.</p>
            )}
          </div>
        </div>
      </section>

      <section className="bg-leaf text-white">
        <div className="wrap flex flex-col gap-8 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
          <div>
            <h2 className="h-section">Give directly to the foundation</h2>
            <p className="mt-5 max-w-[56ch] text-lg text-white/90">
              Your contribution goes straight to the foundation&apos;s bank account. Every payment is checked against our bank records, and you receive a written acknowledgement.
            </p>
          </div>
          <div className="shrink-0">
            <Link href="/donate" className="btn btn-saffron">Donate now</Link>
          </div>
        </div>
      </section>

      <section className="bg-saffron text-black">
        <div className="wrap flex flex-col gap-6 py-14 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="h-section">Give your time</h2>
            <p className="mt-3 max-w-[56ch] text-lg">Register as a volunteer in your district. It takes a few minutes and your ID card arrives by email.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link href="/get-involved" className="btn btn-white">Register as a volunteer</Link>
            <Link href="/join-representative" className="btn btn-line">Join as District Representative</Link>
          </div>
        </div>
      </section>
    </>
  );
}