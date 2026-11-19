import { LEGAL_UPDATED, type LegalSection } from "@/lib/legal";
import { paragraphs } from "@/lib/utils";

/** Privacy Policy / Terms page. Shows the founder's own text when it has been entered, otherwise the built-in version. */
export function LegalPage({ title, sections, override }: { title: string; sections: LegalSection[]; override?: string }) {
  return (
    <div className="wrap section">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl sm:text-5xl">{title}</h1>
        {override ? (
          <div className="prose-plain mt-8 text-lg">{paragraphs(override).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>
        ) : (
          <>
            <p className="mt-3 text-[var(--color-muted)]">Last updated {LEGAL_UPDATED}</p>
            <nav aria-label="On this page" className="mt-8 rounded-xl border border-line p-5">
              <ol className="grid gap-x-8 gap-y-1.5 text-[0.95rem] sm:grid-cols-2">
                {sections.map((s, i) => <li key={i}><a href={`#s${i + 1}`} className="underline decoration-saffron decoration-2 underline-offset-4 hover:text-leaf">{s.heading}</a></li>)}
              </ol>
            </nav>
            {sections.map((s, i) => (
              <section key={i} id={`s${i + 1}`} className="mt-10 scroll-mt-24">
                <h2 className="text-2xl">{s.heading}</h2>
                {s.blocks.map((b, k) => Array.isArray(b) ? (
                  <ul key={k} className="mt-3 space-y-2">
                    {b.map((li, j) => <li key={j} className="flex gap-3"><span aria-hidden="true" className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-saffron" /><span>{li}</span></li>)}
                  </ul>
                ) : <p key={k} className="mt-3">{b}</p>)}
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}