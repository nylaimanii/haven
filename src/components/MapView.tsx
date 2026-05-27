"use client";

import { useEffect, useRef } from "react";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { useHavenStore } from "@/store/useHavenStore";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const INITIAL_CENTER: [number, number] = [-74.1, 40.75];
const INITIAL_ZOOM = 10;
const SELECTED_ZOOM = 12;
const MARKER_COLOR = "#E85F36"; // --haven-heat (dark)

export default function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const place = useHavenStore((s) => s.place);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: false }),
      "bottom-right",
    );

    map.on("styleimagemissing", (e) => {
      if (map.hasImage(e.id)) return;
      map.addImage(e.id, {
        width: 1,
        height: 1,
        data: new Uint8Array([0, 0, 0, 0]),
      });
    });

    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!place) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const center: [number, number] = [place.lng, place.lat];
    map.flyTo({ center, zoom: SELECTED_ZOOM, essential: true });

    if (markerRef.current) {
      markerRef.current.setLngLat(center);
    } else {
      markerRef.current = new maplibregl.Marker({ color: MARKER_COLOR })
        .setLngLat(center)
        .addTo(map);
    }
  }, [place]);

  return <div ref={containerRef} className="h-full w-full" />;
}
