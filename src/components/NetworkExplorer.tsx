"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { MapPoint } from "./MapView";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="h-[440px] w-full animate-pulse rounded-xl bg-neutral-100" /> });

type D = { id: string; name: string; slug: string; state_id: string; lat: number | null; lng: number | null; leader?: string | null; role?: string | null };

export function NetworkExplorer({ states, districts }: { states: { id: string; name: string }[]; districts: D[] }) {
  const router = useRouter();
  const [stateId, setStateId] = useState(states[0]?.id ?? "");
  const list = useMemo(() => districts.filter((d) => !stateId || d.state_id === stateId), [districts, stateId]);
  const points: MapPoint[] = useMemo(() => list.filter((d) => d.lat && d.lng).map((d) => ({
    lat: d.lat!, lng: d.lng!, title: d.name, kind: d.leader ? "led" : "district", href: `/network/${d.slug}`,
    text: d.leader ? `${d.role}: ${d.leader}` : "No representative appointed yet",
  })), [list]);

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <div>
        <label className="label" htmlFor="pick-state">State</label>
        <select id="pick-state" className="field" value={stateId} onChange={(e) => setStateId(e.target.value)}>
          {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label className="label mt-4" htmlFor="pick-district">District</label>
        <select id="pick-district" className="field" defaultValue="" onChange={(e) => e.target.value && router.push(`/network/${e.target.value}`)}>
          <option value="">Choose your district</option>
          {list.map((d) => <option key={d.id} value={d.slug}>{d.name}</option>)}
        </select>
        <ul className="mt-6 space-y-2 text-sm">
          <li className="flex items-center gap-2"><span className="vf-pin inline-block h-4 w-4 bg-saffron" /> District with an appointed representative</li>
          <li className="flex items-center gap-2"><span className="vf-pin inline-block h-3.5 w-3.5 bg-neutral-300" /> District listed, no representative yet</li>
        </ul>
      </div>
      <MapView points={points} />
    </div>
  );
}
