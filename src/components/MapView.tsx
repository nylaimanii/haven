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
const MOVE_DEBOUNCE_MS = 500;
const HEAT_GRID_N = 16; // must match the server's GRID_N
const HEAT_RASTER_SIZE = 256;
// Overscan: fetch + position the raster 15% beyond the viewport on each side so a
// single move doesn't reveal a hard rectangle edge before the next debounced refresh.
const HEAT_BBOX_PAD = 0.15;

const HEAT_SOURCE_ID = "haven-heat-raster";
const HEAT_LAYER_ID = "haven-heat-raster-layer";

type HeatPoint = { lat: number; lng: number; temp: number };
type BBox = { west: number; south: number; east: number; north: number };

// Cool → warm → --haven-heat ramp.
const RAMP: [number, [number, number, number]][] = [
  [0.0, [33, 102, 172]],
  [0.25, [103, 169, 207]],
  [0.5, [253, 219, 199]],
  [0.75, [239, 138, 98]],
  [1.0, [232, 95, 54]],
];

function rampColor(t: number): [number, number, number] {
  const tc = Math.max(0, Math.min(1, t));
  for (let i = 0; i < RAMP.length - 1; i++) {
    const [t1, c1] = RAMP[i];
    const [t2, c2] = RAMP[i + 1];
    if (tc >= t1 && tc <= t2) {
      const k = (tc - t1) / (t2 - t1);
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * k),
        Math.round(c1[1] + (c2[1] - c1[1]) * k),
        Math.round(c1[2] + (c2[2] - c1[2]) * k),
      ];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

// Bilinear-interpolate the N×N temperature grid into a SIZE×SIZE color raster,
// then run one blur pass for buttery edges. Returns a data URL.
function buildHeatRasterURL(points: HeatPoint[]): string | null {
  const n = HEAT_GRID_N;
  if (points.length !== n * n) return null;

  const temps: number[][] = [];
  let minT = Infinity;
  let maxT = -Infinity;
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      const t = points[i * n + j].temp;
      row.push(t);
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
    }
    temps.push(row);
  }
  // Avoid divide-by-zero when the grid is nearly uniform.
  const safeRange = maxT - minT > 0.1 ? maxT - minT : 1;

  const canvas = document.createElement("canvas");
  canvas.width = HEAT_RASTER_SIZE;
  canvas.height = HEAT_RASTER_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const img = ctx.createImageData(HEAT_RASTER_SIZE, HEAT_RASTER_SIZE);
  for (let py = 0; py < HEAT_RASTER_SIZE; py++) {
    // Canvas y=0 is the top → north. temps[0] = south row, temps[n-1] = north row.
    const gy = ((HEAT_RASTER_SIZE - 1 - py) / (HEAT_RASTER_SIZE - 1)) * (n - 1);
    const gyi = Math.min(n - 2, Math.floor(gy));
    const gyf = gy - gyi;
    for (let px = 0; px < HEAT_RASTER_SIZE; px++) {
      const gx = (px / (HEAT_RASTER_SIZE - 1)) * (n - 1);
      const gxi = Math.min(n - 2, Math.floor(gx));
      const gxf = gx - gxi;

      const a = temps[gyi][gxi];
      const b = temps[gyi][gxi + 1];
      const c = temps[gyi + 1][gxi];
      const d = temps[gyi + 1][gxi + 1];
      const top = a + (b - a) * gxf;
      const bot = c + (d - c) * gxf;
      const t = top + (bot - top) * gyf;

      const norm = (t - minT) / safeRange;
      const [r, g, b2] = rampColor(norm);
      const idx = (py * HEAT_RASTER_SIZE + px) * 4;
      img.data[idx] = r;
      img.data[idx + 1] = g;
      img.data[idx + 2] = b2;
      img.data[idx + 3] = 200; // alpha ~78% — sits visibly under labels
    }
  }
  ctx.putImageData(img, 0, 0);

  // Final blur pass on a second canvas — produces a buttery continuous surface.
  const out = document.createElement("canvas");
  out.width = HEAT_RASTER_SIZE;
  out.height = HEAT_RASTER_SIZE;
  const oc = out.getContext("2d");
  if (!oc) return canvas.toDataURL("image/png");
  oc.filter = "blur(5px)";
  oc.drawImage(canvas, 0, 0);
  return out.toDataURL("image/png");
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const renderHeatRef = useRef<() => void>(() => {});

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

    function unmountRaster() {
      if (map.getLayer(HEAT_LAYER_ID)) map.removeLayer(HEAT_LAYER_ID);
      if (map.getSource(HEAT_SOURCE_ID)) map.removeSource(HEAT_SOURCE_ID);
    }

    function mountRaster(url: string, bbox: BBox) {
      // Clockwise from top-left: TL, TR, BR, BL.
      const coords: [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
      ] = [
        [bbox.west, bbox.north],
        [bbox.east, bbox.north],
        [bbox.east, bbox.south],
        [bbox.west, bbox.south],
      ];
      const existing = map.getSource(HEAT_SOURCE_ID) as
        | maplibregl.ImageSource
        | undefined;
      if (existing) {
        // Update coords first so the source's geographic placement changes BEFORE
        // the new pixels arrive — combined updateImage({url, coordinates}) is
        // observed to skip the coord change on MapLibre 5.x, so split it.
        existing.setCoordinates(coords);
        existing.updateImage({ url });
        return;
      }
      map.addSource(HEAT_SOURCE_ID, {
        type: "image",
        url,
        coordinates: coords,
      });
      // Insert beneath the first symbol layer so labels (streets, neighborhoods)
      // remain readable on top of the heat surface.
      let beforeId: string | undefined;
      const layers = map.getStyle().layers ?? [];
      for (const layer of layers) {
        if (layer.type === "symbol") {
          beforeId = layer.id;
          break;
        }
      }
      map.addLayer(
        {
          id: HEAT_LAYER_ID,
          type: "raster",
          source: HEAT_SOURCE_ID,
          paint: {
            "raster-opacity": 0.5,
            "raster-resampling": "linear",
          },
        },
        beforeId,
      );
    }

    async function renderHeat() {
      const placeNow = useHavenStore.getState().place;
      const hazard = useHavenStore.getState().activeHazard;
      if (!placeNow || hazard !== "heat") {
        unmountRaster();
        return;
      }
      const b = map.getBounds();
      const w = b.getWest();
      const e = b.getEast();
      const s = b.getSouth();
      const n = b.getNorth();
      const padLng = (e - w) * HEAT_BBOX_PAD;
      const padLat = (n - s) * HEAT_BBOX_PAD;
      const bbox: BBox = {
        west: w - padLng,
        east: e + padLng,
        south: s - padLat,
        north: n + padLat,
      };
      const params = new URLSearchParams({
        west: String(bbox.west),
        south: String(bbox.south),
        east: String(bbox.east),
        north: String(bbox.north),
      });
      try {
        const r = await fetch(`/api/heat?${params.toString()}`);
        if (!r.ok) return;
        const data = (await r.json()) as { points: HeatPoint[] };
        const url = buildHeatRasterURL(data.points ?? []);
        if (!url) return;
        // Re-check that place is still set (could have been cleared mid-fetch).
        if (!useHavenStore.getState().place) {
          unmountRaster();
          return;
        }
        mountRaster(url, bbox);
      } catch {
        // Ignore transient network failures.
      }
    }
    renderHeatRef.current = renderHeat;

    let debounceId: ReturnType<typeof setTimeout> | null = null;
    function scheduleRender() {
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(renderHeat, MOVE_DEBOUNCE_MS);
    }

    map.on("moveend", scheduleRender);
    // No initial fetch on load — wait for a place to be selected.

    mapRef.current = map;

    return () => {
      if (debounceId) clearTimeout(debounceId);
      markerRef.current?.remove();
      markerRef.current = null;
      renderHeatRef.current = () => {};
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Place change → marker + flyTo. Cleared → strip marker + heat raster.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!place) {
      markerRef.current?.remove();
      markerRef.current = null;
      if (map.getLayer(HEAT_LAYER_ID)) map.removeLayer(HEAT_LAYER_ID);
      if (map.getSource(HEAT_SOURCE_ID)) map.removeSource(HEAT_SOURCE_ID);
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
    // flyTo will fire moveend → debounced renderHeat will fetch + paint the field.
  }, [place]);

  useEffect(() => {
    // Re-render when the active hazard switches (unmounts the heat raster
    // when hazard !== "heat", will re-fetch + repaint when it flips back).
    renderHeatRef.current();
  }, [activeHazard]);

  return <div ref={containerRef} className="h-full w-full" />;
}
