import Link from "next/link";
import { HomeSlider } from "@/components/HomeSlider";
import { requireSuper } from "@/lib/auth";
import { slideStatus } from "@/lib/resources";

export const metadata = { title: "Carousel preview" };

// Shows every slide, including inactive ones, exactly as the homepage would draw them.
export default async function SliderPreview() {
  const s = await requireSuper();
  const { data: slides } = await s.supabase.from("hero_slides").select("*").order("sort_order").order("id").limit(4);
  return (
    <>
      <Link href="/admin/manage/slides" className="link text-sm">Back to the carousel slides</Link>
      <h1 className="mt-3 text-4xl">Carousel preview</h1>
      <p className="mb-6 mt-2 max-w-[70ch] text-[var(--color-muted)]">
        All four slots in order, including slides that are not on the homepage right now. The list says why each slide is or is not showing. Tick <strong>Active</strong> on a slide to publish it; untick it to take it off the homepage without deleting it.
      </p>
      {!!(slides ?? []).length && (
        <ul className="mb-6 max-w-3xl space-y-2">
          {(slides ?? []).map((sl: any) => {
            const st = slideStatus(sl);
            return (
              <li key={sl.id} className={`notice ${st.startsWith("Live") ? "notice-ok" : "notice-info"}`}>
                <strong>{sl.title || "(no heading)"}</strong>: {st}. <Link href={`/admin/manage/slides/${sl.id}`} className="link">Edit</Link>
              </li>
            );
          })}
        </ul>
      )}
      {(slides ?? []).length ? <div className="-mx-5 border-y border-line sm:-mx-10"><HomeSlider slides={slides as any} fallbackTitle="Vrutsa Foundation" preview /></div>
        : <p className="notice notice-info max-w-xl">No slides yet. Add the first one under Homepage carousel.</p>}
    </>
  );
}