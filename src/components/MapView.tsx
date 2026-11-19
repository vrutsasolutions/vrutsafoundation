"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type MapPoint = { lat: number; lng: number; title: string; text?: string; href?: string; kind?: "district" | "led" | "event" | "office" };
const COLOUR = { district: "#bdbdbd", led: "#f0a500", event: "#0f5a1f", office: "#9f1239" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Leaflet + OpenStreetMap. Loaded only in the browser, only on pages that show a map. */
export default function MapView({ points, height = 440, zoom }: { points: MapPoint[]; height?: number; zoom?: number }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("leaflet").Map | undefined, cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || points.length === 0) return;
      map = L.map(el.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      const order = { district: 0, led: 1, office: 2, event: 3 };
      [...points].sort((a, b) => order[a.kind ?? "district"] - order[b.kind ?? "district"]).forEach((p) => {
        const kind = p.kind ?? "district", size = kind === "district" ? 14 : 20;
        const icon = L.divIcon({ className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2],
          html: `<div class="vf-pin" style="width:${size}px;height:${size}px;background:${COLOUR[kind]}"></div>` });
        L.marker([p.lat, p.lng], { icon, title: p.title, alt: p.title }).addTo(map!)
          .bindPopup(`<strong>${esc(p.title)}</strong>${p.text ? `<br>${esc(p.text)}` : ""}${p.href ? `<br><a href="${esc(p.href)}">Open</a>` : ""}`);
      });
      if (points.length === 1 || zoom) map.setView([points[0].lat, points[0].lng], zoom ?? 11);
      else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [28, 28] });
    })();
    return () => { cancelled = true; map?.remove(); };
  }, [points, zoom]);

  if (points.length === 0) return null;
  return <div ref={el} style={{ height }} className="w-full border border-line" role="application" aria-label="Map" />;
}
