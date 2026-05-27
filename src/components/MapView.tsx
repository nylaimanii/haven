"use client";

import { useEffect, useRef } from "react";

import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { useHavenStore } from "@/store/useHavenStore";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const INITIAL_CENTER: [number, number] = [-74.1, 40.75];
const INITIAL_ZOOM = 10;
const SELECTED_ZOOM = 12;
const MARKER_COLOR = "#E85F36"; // --haven-heat (dark)
const MOVE_DEBOUNCE_MS = 500;

type HeatPoint = { lat: number; lng: number; temp: number };

// Cool-to-hot ramp ending on --haven-heat (232, 95, 54).
const HEAT_COLOR_RANGE: [number, number, number, number][] = [
  [33, 102, 172, 180],
  [103, 169, 207, 200],
  [209, 229, 240, 220],
  [253, 219, 199, 230],
  [239, 138, 98, 245],
  [232, 95, 54, 255],
];

export default function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const heatDataRef = useRef<HeatPoint[]>([]);
  const pushLayersRef = useRef<() => void>(() => {});

  const place = useHavenStore((s) => s.place);
  const activeHazard = useHavenStore((s) => s.activeHazard);

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

    const overlay = new MapboxOverlay({ layers: [] });
    // MapboxOverlay implements IControl; MapLibre and Mapbox share the contract.
    map.addControl(overlay as unknown as maplibregl.IControl);

    function pushLayers() {
      const data = heatDataRef.current;
      const hazard = useHavenStore.getState().activeHazard;
      if (hazard === "heat" && data.length > 0) {
        overlay.setProps({
          layers: [
            new HeatmapLayer<HeatPoint>({
              id: "heat",
              data,
              getPosition: (d) => [d.lng, d.lat],
              getWeight: (d) => d.temp,
              radiusPixels: 60,
              intensity: 1.2,
              threshold: 0.05,
              colorRange: HEAT_COLOR_RANGE,
            }),
          ],
        });
      } else {
        overlay.setProps({ layers: [] });
      }
    }
    pushLayersRef.current = pushLayers;

    let debounceId: ReturnType<typeof setTimeout> | null = null;

    async function fetchHeat() {
      const b = map.getBounds();
      const params = new URLSearchParams({
        west: String(b.getWest()),
        south: String(b.getSouth()),
        east: String(b.getEast()),
        north: String(b.getNorth()),
      });
      try {
        const r = await fetch(`/api/heat?${params.toString()}`);
        if (!r.ok) return;
        const data = (await r.json()) as { points: HeatPoint[] };
        heatDataRef.current = data.points ?? [];
        pushLayers();
      } catch {
        // ignore transient network failures
      }
    }

    function scheduleFetch() {
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(fetchHeat, MOVE_DEBOUNCE_MS);
    }

    map.on("moveend", scheduleFetch);
    map.on("load", () => {
      void fetchHeat();
    });

    mapRef.current = map;
    overlayRef.current = overlay;

    return () => {
      if (debounceId) clearTimeout(debounceId);
      markerRef.current?.remove();
      markerRef.current = null;
      overlayRef.current = null;
      pushLayersRef.current = () => {};
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
    // flyTo triggers a moveend → debounced fetchHeat refreshes the field.
  }, [place]);

  useEffect(() => {
    // Re-render the deck overlay when the active hazard switches.
    pushLayersRef.current();
  }, [activeHazard]);

  return <div ref={containerRef} className="h-full w-full" />;
}
