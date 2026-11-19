import { Empty, EventRow, PageHeader } from "@/components/cards";
import { listEvents } from "@/lib/data";

export const revalidate = 60;
export const metadata = { title: "Events", description: "Upcoming and past events of Vrutsa Foundation." };

export default async function Events() {
  const { upcoming, past } = await listEvents();
  return (
    <>
      <PageHeader title="Events" intro="Come to an upcoming event, or look back at the ones we have held." />
      <section className="section">
        <div className="wrap">
          <h2 className="h-section">Upcoming events</h2>
          <div className="mt-4">{upcoming.length ? upcoming.map((e) => <EventRow key={e.id} e={e} />) : <div className="mt-6"><Empty>No events are scheduled right now.</Empty></div>}</div>
        </div>
      </section>
      <section className="section border-t border-line" id="past">
        <div className="wrap">
          <h2 className="h-section">Past events</h2>
          <div className="mt-4">{past.length ? past.map((e) => <EventRow key={e.id} e={e} />) : <div className="mt-6"><Empty>Completed events, with photographs and results, will be listed here.</Empty></div>}</div>
        </div>
      </section>
    </>
  );
}
