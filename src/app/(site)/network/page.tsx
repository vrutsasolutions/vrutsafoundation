import Link from "next/link";
import { Empty, LeaderCard, PageHeader } from "@/components/cards";
import { NetworkExplorer } from "@/components/NetworkExplorer";
import { getDistricts, getLeaders, getStates } from "@/lib/data";

export const revalidate = 60;
export const metadata = { title: "Our network", description: "Find the Vrutsa Foundation representatives, activities and events in your district." };

export default async function Network() {
  const [states, districts, leaders] = await Promise.all([getStates(), getDistricts(), getLeaders()]);
  const first = (districtId: string) => leaders.find((l) => l.district_id === districtId); // already ordered by seniority
  const central = leaders.filter((l) => !l.district_id && !l.state_id);
  const stateLevel = leaders.filter((l) => !l.district_id && l.state_id);
  const stateName = (id: string) => states.find((s) => s.id === id)?.name;

  return (
    <>
      <PageHeader title="Our network" intro="Vrutsa Foundation is organised district by district. Choose yours to meet its representatives and see local activities, events and ways to help." />
      <section className="section">
        <div className="wrap">
          {districts.length ? (
            <NetworkExplorer states={states as any} districts={districts.map((d) => ({
              id: d.id, name: d.name, slug: d.slug, state_id: d.state_id, lat: d.lat, lng: d.lng,
              leader: first(d.id)?.full_name ?? null, role: first(d.id)?.designation || first(d.id)?.role_name || null,
            }))} />
          ) : <Empty>Districts will be listed here once the network is set up.</Empty>}
        </div>
      </section>

      {(central.length > 0 || stateLevel.length > 0) && (
        <section className="section border-t border-line">
          <div className="wrap">
            <h2 className="h-section">Central and state leadership</h2>
            <div className="mt-10 grid gap-10 md:grid-cols-2">
              {central.map((p) => <LeaderCard key={p.id} p={p} />)}
              {stateLevel.map((p) => <LeaderCard key={p.id} p={p} area={stateName(p.state_id)} />)}
            </div>
          </div>
        </section>
      )}

      {districts.length > 0 && (
        <section className="section border-t border-line">
          <div className="wrap">
            <h2 className="h-section">All districts</h2>
            <ul className="mt-8 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
              {districts.map((d) => {
                const l = first(d.id);
                return (
                  <li key={d.id} className="border-b border-line">
                    <Link href={`/network/${d.slug}`} className="group flex items-center justify-between gap-3 py-3.5">
                      <span>
                        <span className="font-semibold decoration-saffron decoration-[3px] underline-offset-4 group-hover:underline">{d.name}</span>
                        <span className="block text-sm text-[var(--color-muted)]">{l ? `${l.designation || l.role_name}: ${l.full_name}` : "No representative appointed yet"}</span>
                      </span>
                      <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full ${l ? "bg-saffron" : "bg-neutral-300"}`} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
