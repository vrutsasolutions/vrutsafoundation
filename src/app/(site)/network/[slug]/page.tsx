import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityCard, Empty, EventRow, LeaderCard } from "@/components/cards";
import { LazyMap } from "@/components/LazyMap";
import type { MapPoint } from "@/components/MapView";
import { getDistrict, getLeaders, listActivities, listEvents } from "@/lib/data";

export const revalidate = 60;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const d = await getDistrict((await params).slug);
  return d ? { title: `${d.name} district`, description: `Vrutsa Foundation representatives, activities and events in ${d.name}.` } : {};
}

export default async function DistrictPage({ params }: Props) {
  const d = await getDistrict((await params).slug);
  if (!d) notFound();
  const [leaders, activities, events] = await Promise.all([getLeaders(), listActivities({ district: d.id, limit: 6 }), listEvents({ district: d.id })]);
  const team = leaders.filter((l) => l.district_id === d.id);
  const points: MapPoint[] = [
    ...(d.lat && d.lng ? [{ lat: d.lat, lng: d.lng, title: `${d.name} district`, text: d.office_address ?? undefined, kind: d.office_address ? "office" : "led" } as MapPoint] : []),
    ...events.upcoming.filter((e) => e.lat && e.lng).map((e) => ({ lat: e.lat, lng: e.lng, title: e.title, text: e.venue, href: `/events/${e.slug}`, kind: "event" } as MapPoint)),
  ];
  return (
    <>
      <div className="border-b border-line">
        <div className="wrap py-12 sm:py-16">
          <Link href="/network" className="link text-sm">Our network</Link>
          <h1 className="mt-4 text-4xl sm:text-6xl">{d.name}</h1>
          <p className="lede mt-3">{d.states?.name}</p>
        </div>
      </div>

      <section className="section">
        <div className="wrap grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="h-section">District representatives</h2>
            <div className="mt-8 space-y-8">
              {team.length ? team.map((p) => (
                <div key={p.id}>
                  <LeaderCard p={p} area={d.name} />
                  {p.experience && <div className="mt-3 pl-24"><h3 className="text-base">Social service experience</h3><p className="mt-1 whitespace-pre-line text-[0.95rem] text-[var(--color-muted)]">{p.experience}</p></div>}
                </div>
              )) : <Empty>No representative has been appointed for {d.name} yet.</Empty>}
            </div>
            {d.office_address && <p className="mt-8 whitespace-pre-line text-[0.97rem]"><strong>District office</strong><br />{d.office_address}</p>}
          </div>
          <div>{points.length > 0 && <LazyMap points={points} height={380} zoom={points.length === 1 ? 10 : undefined} />}</div>
        </div>
      </section>

      <section className="bg-saffron">
        <div className="wrap flex flex-col gap-5 py-12 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-3xl">Volunteer in {d.name}</h2>
            <p className="mt-2 max-w-[56ch]">Register as a volunteer in this district and receive your membership ID card.</p>
          </div>
          <Link href={`/get-involved?district=${d.slug}`} className="btn btn-white w-fit">Register as a volunteer here</Link>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2 className="h-section">Upcoming events in {d.name}</h2>
          <div className="mt-4">{events.upcoming.length ? events.upcoming.map((e) => <EventRow key={e.id} e={e} />) : <div className="mt-6"><Empty>No events are scheduled in this district right now.</Empty></div>}</div>
        </div>
      </section>

      <section className="section border-t border-line">
        <div className="wrap">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="h-section">Activities in {d.name}</h2>
            {activities.length > 0 && <Link href={`/activities?district=${d.id}`} className="link">See all</Link>}
          </div>
          <div className="mt-10">{activities.length ? <div className="grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">{activities.map((a) => <ActivityCard key={a.id} a={a} />)}</div> : <Empty>Activities from this district will appear here.</Empty>}</div>
        </div>
      </section>
    </>
  );
}