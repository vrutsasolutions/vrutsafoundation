"use client";
import { useRef } from "react";

/** A row of cards that slides sideways: swipe on touch screens, arrows elsewhere. */
export function Carousel({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const move = (d: number) => ref.current?.scrollBy({ left: d * Math.max(300, ref.current.clientWidth * 0.8), behavior: "smooth" });
  return (
    <div className="relative">
      <ul ref={ref} aria-label={label} tabIndex={0}
        className="-mx-5 flex snap-x snap-mandatory gap-6 overflow-x-auto px-5 pb-4 [scrollbar-width:none] sm:-mx-8 sm:px-8 [&::-webkit-scrollbar]:hidden [&>li]:w-[82%] [&>li]:shrink-0 [&>li]:snap-start sm:[&>li]:w-[46%] lg:[&>li]:w-[31%]">
        {children}
      </ul>
      <div className="mt-2 flex justify-end gap-2">
        {[-1, 1].map((d) => (
          <button key={d} type="button" onClick={() => move(d)} aria-label={`${d < 0 ? "Previous" : "Next"}: ${label}`} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-black hover:bg-black hover:text-white">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d={d < 0 ? "M9 2L4 7l5 5" : "M5 2l5 5-5 5"} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        ))}
      </div>
    </div>
  );
}
