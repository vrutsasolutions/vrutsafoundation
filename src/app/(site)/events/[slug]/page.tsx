import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/cards";
import { EventRegisterForm } from "@/components/EventRegisterForm";
import { Img } from "@/components/Img";
import { LazyMap } from "@/components/LazyMap";
import { getEvent } from "@/lib/data";
import { formatDateTime, paragraphs } from "@/lib/utils";

export const revalidate = 60;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const e = await getEvent((await params).slug);
  return e ? { title: e.title, description: e.description?.slice(0, 160), openGraph: e.poster_url ? { images: [e.poster_url] } : undefined } : {};
}

export default async function EventPage({ params }: Props) {
  const e = await getEvent((await params).slug);
  if (!e) notFound();
  const upcoming = e.status === "upcoming";
  const coordinators = String(e.coordinators ?? "").split(/[,;\n]+/).map((c: string) => c.trim()).filter(Boolean);
  const facts = [
    ["When", `${formatDateTime(e.starts_at)}${e.ends_at ? ` to ${formatDateTime(e.ends_at)}` : ""}`],
    ["Venue", e.venue], ["District", e.districts?.name],
  ].filter(([, v]) => v);
  return (
    <article>
      <div className="wrap pt-10 sm:pt-14">
        <Link href="/events" className="link text-sm">All events</Link>
        <p className="mt-5">
          <span className={`tag ${e.status === "upcoming" ? "bg-leaf text-white" : e.status === "cancelled" ? "bg-kumkum text-white" : "bg-neutral-200"}`}>
            {{ upcoming: "Upcoming", completed: "Completed", cancelled: "Cancelled" }[e.status as string]}
          </span>
        </p>
        <h1 className="mt-3 max-w-[22ch] text-4xl sm:text-6xl">{e.title}</h1>
      </div>
      <div className="wrap section grid gap-12 lg:grid-cols-[1fr_360px]">
        <div>
          {e.poster_url && <div className="relative mb-10 aspect-[16/10] overflow-hidden rounded-2xl bg-neutral-100"><Img src={e.poster_url} alt={`Poster for ${e.title}`} sizes="(min-width:1024px) 760px, 100vw" priority className="object-contain" /></div>}
          {e.status === "cancelled" && <p className="notice notice-err mb-8">This event has been cancelled.</p>}
          <div className="prose-plain max-w-[68ch] text-lg">{paragraphs(e.description).map((p, i) => <p key={i}>{p}</p>)}</div>
          {e.status === "completed" && (e.highlights || e.report_url) && (
            <div className="mt-10 border-l-4 border-leaf pl-6">
              <h2 className="text-2xl">Results and highlights</h2>
              <div className="prose-plain mt-3 text-lg">{paragraphs(e.highlights).map((p, i) => <p key={i}>{p}</p>)}</div>
              {e.report_url && <a href={e.report_url} className="link mt-4 inline-block" rel="noopener">Read the event report (PDF)</a>}
            </div>
          )}
          {e.media.length > 0 && <div className="mt-12"><h2 className="mb-6 text-2xl">Photographs and videos</h2><Gallery media={e.media} /></div>}
          {e.lat && e.lng && <div className="mt-12"><h2 className="mb-6 text-2xl">Where it is</h2><LazyMap height={340} zoom={14} points={[{ lat: e.lat, lng: e.lng, title: e.venue ?? e.title, kind: "event" }]} /></div>}
        </div>
        <aside className="h-fit space-y-8">
          <dl className="space-y-4 border-t-4 border-saffron pt-5">
            {facts.map(([k, v]) => <div key={k}><dt className="text-sm text-[var(--color-muted)]">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          </dl>
          {(e.contact_name || e.contact_phone) && (
            <div className="border-t border-line pt-5">
              <h2 className="text-lg">Contact person</h2>
              <dl className="mt-3 space-y-2">
                {e.contact_name && <div className="grid grid-cols-[4.5rem_1fr] gap-2"><dt className="text-sm text-[var(--color-muted)]">Name</dt><dd className="font-medium">{e.contact_name}</dd></div>}
                {e.contact_phone && <div className="grid grid-cols-[4.5rem_1fr] gap-2"><dt className="text-sm text-[var(--color-muted)]">Phone</dt><dd className="font-medium"><a href={`tel:${String(e.contact_phone).replace(/[^\d+]/g, "")}`} className="underline decoration-saffron decoration-2 underline-offset-4">{e.contact_phone}</a></dd></div>}
              </dl>
            </div>
          )}
          {coordinators.length > 0 && (
            <div className="border-t border-line pt-5">
              <h2 className="text-lg">Event coordinators</h2>
              <ul className="mt-3 space-y-1.5">{coordinators.map((c: string) => <li key={c} className="font-medium">{c}</li>)}</ul>
            </div>
          )}
          {upcoming && e.registration_mode === "form" && (
            <div className="rounded-2xl border-2 border-black p-6"><h2 className="mb-4 text-2xl">Register</h2><EventRegisterForm eventId={e.id} /></div>
          )}
          {upcoming && e.registration_mode === "link" && e.registration_url && (
            <a href={e.registration_url} rel="noopener" className="btn btn-saffron w-full">Register for this event</a>
          )}
        </aside>
      </div>
    </article>
  );
}