"use client";
import dynamic from "next/dynamic";
import type { MapPoint } from "./MapView";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="h-[340px] w-full animate-pulse rounded-xl bg-neutral-100" /> });
export function LazyMap(props: { points: MapPoint[]; height?: number; zoom?: number }) { return <MapView {...props} />; }
