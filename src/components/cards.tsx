import Link from "next/link";
import { Img } from "./Img";
import { dateParts, formatDate, youtubeEmbed } from "@/lib/utils";

export function PageHeader({ title, intro, children }: { title: string; intro?: string | null; children?: React.ReactNode }) {
  return (
    <div className="border-b border-line">
      <div className="wrap py-12 sm:py-16">
        <h1 className="text-4xl sm:text-6xl">{title}</h1>
        {intro && <p className="lede mt-4">{intro}</p>}
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-neutral-400 px-6 py-10 text-center text-[var(--color-muted)]">{children}</p>;
}

export function ActivityCard({ a }: { a: any }) {
  return (
    <article className="group flex flex-col">
      <Link href={`/activities/${a.slug}`} className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-leaf-soft">
        {a.cover_url
          ? <Img src={a.cover_url} alt="" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          : <span className="absolute inset-0 flex items-end p-5 font-[family-name:var(--font-display)] text-2xl font-semibold text-leaf">{a.categories?.name ?? "Activity"}</span>}
      </Link>
      <p className="mt-4 text-sm text-[var(--color-muted)]">
        {formatDate(a.activity_date)}{a.districts?.name ? `, ${a.districts.name}` : ""}
      </p>
      <h3 className="mt-1 text-xl"><Link href={`/activities/${a.slug}`} className="decoration-saffron decoration-[3px] underline-offset-4 hover:underline">{a.title}</Link></h3>
      {a.summary && <p className="mt-2 text-[0.97rem] text-[var(--color-muted)]">{a.summary}</p>}
    </article>
  );
}

const STATUS_STYLE: Record<string, string> = { upcoming: "bg-leaf text-white", completed: "bg-neutral-200 text-black", cancelled: "bg-kumkum text-white" };
const STATUS_LABEL: Record<string, string> = { upcoming: "Upcoming", completed: "Completed", cancelled: "Cancelled" };

export function EventRow({ e }: { e: any }) {
  const d = dateParts(e.starts_at);
  return (
    <article className="grid grid-cols-[84px_1fr] gap-5 border-b border-line py-6 sm:grid-cols-[96px_1fr_auto] sm:items-center">
      <div className={`flex h-[84px] w-[84px] flex-col items-center justify-center rounded-xl sm:h-24 sm:w-24 ${e.status === "upcoming" ? "bg-saffron" : "bg-neutral-100"}`}>
        <span className="font-[family-name:var(--font-display)] text-3xl font-bold leading-none">{d.day}</span>
        <span className="mt-1 text-sm font-semibold">{d.month} {d.year}</span>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {e.status !== "upcoming" && <span className={`tag ${STATUS_STYLE[e.status]}`}>{STATUS_LABEL[e.status]}</span>}
          <span className="text-sm text-[var(--color-muted)]">{d.time}{e.venue ? `, ${e.venue}` : ""}{e.districts?.name ? ` (${e.districts.name})` : ""}</span>
        </div>
        <h3 className="mt-1 text-xl sm:text-2xl"><Link href={`/events/${e.slug}`} className="decoration-saffron decoration-[3px] underline-offset-4 hover:underline">{e.title}</Link></h3>
        {(e.status === "completed" ? e.highlights : e.description) && (
          <p className="mt-1 line-clamp-2 text-[0.97rem] text-[var(--color-muted)]">{e.status === "completed" ? e.highlights : e.description}</p>
        )}
      </div>
      <Link href={`/events/${e.slug}`} className="btn btn-line btn-sm col-start-2 w-fit sm:col-start-3">View details</Link>
    </article>
  );
}

export function LeaderCard({ p, area }: { p: any; area?: string }) {
  const row = "grid grid-cols-[6.5rem_1fr] gap-2";
  const label = "text-sm text-[var(--color-muted)]";
  return (
    <article className="flex gap-4">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-saffron-soft">
        {p.photo_url ? <Img src={p.photo_url} alt="" sizes="80px" className="object-cover" />
          : <span className="flex h-full w-full items-center justify-center font-[family-name:var(--font-display)] text-2xl font-semibold text-leaf">{String(p.full_name).slice(0, 1)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-xl leading-snug">{p.full_name}</h3>
        <dl className="mt-2 space-y-1.5 text-[0.95rem]">
          <div className={row}><dt className={label}>Designation</dt><dd className="font-medium text-leaf">{p.designation || p.role_name}</dd></div>
          {area && <div className={row}><dt className={label}>District</dt><dd>{area}</dd></div>}
          {p.phone && <div className={row}><dt className={label}>Phone</dt><dd><a className="underline decoration-saffron decoration-2 underline-offset-4" href={`tel:${String(p.phone).replace(/[^\d+]/g, "")}`}>{p.phone}</a></dd></div>}
          {p.email && <div className={row}><dt className={label}>Email</dt><dd className="break-all"><a className="underline decoration-saffron decoration-2 underline-offset-4" href={`mailto:${p.email}`}>{p.email}</a></dd></div>}
          <div className={row}><dt className={label}>Appointed</dt><dd>{formatDate(p.appointed_on)}</dd></div>
        </dl>
        {p.bio && <p className="mt-3 text-[0.95rem] text-[var(--color-muted)]">{p.bio}</p>}
        {p.responsibilities && <p className="mt-2 text-sm text-[var(--color-muted)]"><span className="font-semibold text-black">Responsibilities</span><br />{p.responsibilities}</p>}
      </div>
    </article>
  );
}

export function Gallery({ media }: { media: any[] }) {
  if (!media?.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {media.map((m) => {
        const yt = m.media_type === "video" ? youtubeEmbed(m.url) : null;
        return (
          <figure key={m.id}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-neutral-100">
              {m.media_type === "image" ? <Img src={m.url} alt={m.caption ?? ""} sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" />
                : yt ? <iframe src={yt} title={m.caption ?? "Video"} loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen className="absolute inset-0 h-full w-full" />
                : <video src={m.url} controls preload="metadata" className="absolute inset-0 h-full w-full bg-black object-contain" />}
            </div>
            {m.caption && <figcaption className="mt-2 text-sm text-[var(--color-muted)]">{m.caption}</figcaption>}
          </figure>
        );
      })}
    </div>
  );
}

export function EventCard({ e }: { e: any }) {
  const d = dateParts(e.starts_at);
  const past = e.status !== "upcoming";
  return (
    <article className="flex h-full flex-col">
      <Link href={`/events/${e.slug}`} tabIndex={-1} aria-hidden="true" className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-saffron-soft">
        {e.poster_url ? <Img src={e.poster_url} alt="" className="object-cover" />
          : <span className="absolute inset-0 flex flex-col items-center justify-center font-[family-name:var(--font-display)] font-bold text-leaf"><span className="text-6xl leading-none">{d.day}</span><span className="mt-1 text-xl">{d.month} {d.year}</span></span>}
        {e.status === "cancelled" && <span className="tag absolute left-3 top-3 bg-kumkum text-white">Cancelled</span>}
      </Link>
      <p className="mt-4 text-sm text-[var(--color-muted)]">{d.day} {d.month} {d.year}{past ? "" : `, ${d.time}`}</p>
      <h3 className="mt-1 text-xl"><Link href={`/events/${e.slug}`} className="decoration-saffron decoration-[3px] underline-offset-4 hover:underline">{e.title}</Link></h3>
      {(e.venue || e.districts?.name) && <p className="mt-1 text-[0.95rem]">{[e.venue, e.districts?.name].filter(Boolean).join(", ")}</p>}
      {(past ? e.highlights || e.description : e.description) && <p className="mt-2 line-clamp-2 text-[0.95rem] text-[var(--color-muted)]">{past ? e.highlights || e.description : e.description}</p>}
      <Link href={`/events/${e.slug}`} className="link mt-3 w-fit text-[0.95rem]" aria-label={`${past ? "Photos and summary" : "Details"}: ${e.title}`}>{past ? "View photos and summary" : "View details"}</Link>
    </article>
  );
}

export function RepCard({ p, district, slug }: { p: any; district?: string; slug?: string }) {
  return (
    <article className="h-full rounded-2xl border border-line p-5 text-center">
      <div className="relative mx-auto h-28 w-28 overflow-hidden rounded-full bg-saffron-soft">
        {p.photo_url ? <Img src={p.photo_url} alt="" sizes="112px" className="object-cover" />
          : <span className="flex h-full w-full items-center justify-center font-[family-name:var(--font-display)] text-4xl font-semibold text-leaf">{String(p.full_name).slice(0, 1)}</span>}
      </div>
      <h3 className="mt-4 text-xl">{p.full_name}</h3>
      <p className="mt-0.5 text-[0.95rem] font-medium text-leaf">{p.designation || p.role_name}</p>
      {district && <p className="text-[0.95rem] text-[var(--color-muted)]">{district}</p>}
      {slug && <Link href={`/network/${slug}`} className="link mt-3 inline-block text-[0.95rem]" aria-label={`View profile of ${p.full_name}`}>View profile</Link>}
    </article>
  );
}