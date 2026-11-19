import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/cards";
import { Img } from "@/components/Img";
import { getActivity } from "@/lib/data";
import { formatDate, paragraphs } from "@/lib/utils";

export const revalidate = 60;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const a = await getActivity((await params).slug);
  return a ? { title: a.title, description: a.summary ?? undefined, openGraph: a.cover_url ? { images: [a.cover_url] } : undefined } : {};
}

export default async function ActivityPage({ params }: Props) {
  const a = await getActivity((await params).slug);
  if (!a) notFound();
  const facts = [
    ["Date", formatDate(a.activity_date)], ["Location", a.location], ["District", a.districts?.name],
    ["Category", a.categories?.name], ["Published", formatDate(a.published_at)],
    ["Published by", a.districts?.name ? `Vrutsa Foundation, ${a.districts.name} district team` : "Vrutsa Foundation"],
  ].filter(([, v]) => v);
  return (
    <article>
      <div className="wrap pt-10 sm:pt-14">
        <Link href="/activities" className="link text-sm">All activities</Link>
        <h1 className="mt-4 max-w-[22ch] text-4xl sm:text-6xl">{a.title}</h1>
        {a.summary && <p className="lede mt-5">{a.summary}</p>}
      </div>
      {a.cover_url && (
        <div className="wrap mt-10"><div className="relative aspect-[16/9] overflow-hidden rounded-2xl"><Img src={a.cover_url} alt="" sizes="(min-width:1200px) 1140px, 100vw" priority className="object-cover" /></div></div>
      )}
      <div className="wrap section grid gap-12 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="prose-plain max-w-[68ch] text-lg">{paragraphs(a.description).map((p, i) => <p key={i}>{p}</p>)}</div>
          {a.media.length > 0 && <div className="mt-12"><h2 className="mb-6 text-2xl">Photographs and videos</h2><Gallery media={a.media} /></div>}
        </div>
        <aside className="h-fit border-t-4 border-saffron pt-5">
          <dl className="space-y-4">
            {facts.map(([k, v]) => <div key={k}><dt className="text-sm text-[var(--color-muted)]">{k}</dt><dd className="font-medium">{v}</dd></div>)}
            {a.events && <div><dt className="text-sm text-[var(--color-muted)]">Related event</dt><dd><Link className="link" href={`/events/${a.events.slug}`}>{a.events.title}</Link></dd></div>}
          </dl>
        </aside>
      </div>
    </article>
  );
}
