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
const HEAT_GRID_N = 16; // must match the heat + canopy server routes
const HEAT_RASTER_SIZE = 256;
// Overscan: fetch + position the raster 15% beyond the viewport on each side so a
// single move doesn't reveal a hard rectangle edge before the next debounced refresh.
const HEAT_BBOX_PAD = 0.15;
// HAVEN heat/canopy are hyperlocal — wider than dense-metro scale (zoom < 10)
// we hide. Set above the zoom where a single moveend's stale-coord transient
// would otherwise read as a small patch in a much larger viewport.
const HEAT_MIN_ZOOM = 10;

const HEAT_SOURCE_ID = "haven-heat-raster";
const HEAT_LAYER_ID = "haven-heat-raster-layer";
const HEAT_OPACITY = 0.5;
const CANOPY_SOURCE_ID = "haven-canopy-raster";
const CANOPY_LAYER_ID = "haven-canopy-raster-layer";
const CANOPY_OPACITY = 0.4;

type HeatPoint = { lat: number; lng: number; temp: number };
type CanopyPoint = { lat: number; lng: number; canopy: number };
type BBox = { west: number; south: number; east: number; north: number };

// Color ramps include alpha so each layer controls its own pixel opacity. Heat
// is fully opaque across the range; canopy fades from transparent (sparse) to a
// soft --haven-safe green (dense vegetation).
type Ramp = [t: number, color: [r: number, g: number, b: number, a: number]][];

const HEAT_RAMP: Ramp = [
  [0.0, [33, 102, 172, 200]],
  [0.25, [103, 169, 207, 210]],
  [0.5, [253, 219, 199, 220]],
  [0.75, [239, 138, 98, 235]],
  [1.0, [232, 95, 54, 255]],
];

const CANOPY_RAMP: Ramp = [
  [0.0, [80, 160, 100, 0]],
  [0.4, [80, 160, 100, 110]],
  [0.7, [63, 193, 121, 180]],
  [1.0, [63, 193, 121, 230]],
];

function rampColor(t: number, ramp: Ramp): [number, number, number, number] {
  const tc = Math.max(0, Math.min(1, t));
  for (let i = 0; i < ramp.length - 1; i++) {
    const [t1, c1] = ramp[i];
    const [t2, c2] = ramp[i + 1];
    if (tc >= t1 && tc <= t2) {
      const k = (tc - t1) / (t2 - t1);
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * k),
        Math.round(c1[1] + (c2[1] - c1[1]) * k),
        Math.round(c1[2] + (c2[2] - c1[2]) * k),
        Math.round(c1[3] + (c2[3] - c1[3]) * k),
      ];
    }
  }
  return ramp[ramp.length - 1][1];
}

// Bilinear-interpolate the N×N value grid into a SIZE×SIZE color raster,
// then run a blur pass for buttery edges. Returns a data URL or null.
function buildRasterURL(values: number[], ramp: Ramp): string | null {
  const n = HEAT_GRID_N;
  if (values.length !== n * n) return null;

  const grid: number[][] = [];
  let minV = Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      const v = values[i * n + j];
      row.push(v);
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    grid.push(row);
  }
  const safeRange = maxV - minV > 0.001 ? maxV - minV : 1;

  const canvas = document.createElement("canvas");
  canvas.width = HEAT_RASTER_SIZE;
  canvas.height = HEAT_RASTER_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const img = ctx.createImageData(HEAT_RASTER_SIZE, HEAT_RASTER_SIZE);
  for (let py = 0; py < HEAT_RASTER_SIZE; py++) {
    // Canvas y=0 is the top → north. grid[0] = south row, grid[n-1] = north row.
    const gy = ((HEAT_RASTER_SIZE - 1 - py) / (HEAT_RASTER_SIZE - 1)) * (n - 1);
    const gyi = Math.min(n - 2, Math.floor(gy));
    const gyf = gy - gyi;
    for (let px = 0; px < HEAT_RASTER_SIZE; px++) {
      const gx = (px / (HEAT_RASTER_SIZE - 1)) * (n - 1);
      const gxi = Math.min(n - 2, Math.floor(gx));
      const gxf = gx - gxi;

      const a = grid[gyi][gxi];
      const b = grid[gyi][gxi + 1];
      const c = grid[gyi + 1][gxi];
      const d = grid[gyi + 1][gxi + 1];
      const top = a + (b - a) * gxf;
      const bot = c + (d - c) * gxf;
      const v = top + (bot - top) * gyf;

      const norm = (v - minV) / safeRange;
      const [r, g, b2, alpha] = rampColor(norm, ramp);
      const idx = (py * HEAT_RASTER_SIZE + px) * 4;
      img.data[idx] = r;
      img.data[idx + 1] = g;
      img.data[idx + 2] = b2;
      img.data[idx + 3] = alpha;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Final blur for buttery edges.
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
  const renderRastersRef = useRef<() => void>(() => {});

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

    function firstSymbolId(): string | undefined {
      const layers = map.getStyle().layers ?? [];
      for (const layer of layers) {
        if (layer.type === "symbol") return layer.id;
      }
      return undefined;
    }

    function unmountRasterLayer(sourceId: string, layerId: string) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }

    function unmountAll() {
      unmountRasterLayer(HEAT_SOURCE_ID, HEAT_LAYER_ID);
      unmountRasterLayer(CANOPY_SOURCE_ID, CANOPY_LAYER_ID);
    }

    function mountRasterLayer(
      sourceId: string,
      layerId: string,
      url: string,
      bbox: BBox,
      opacity: number,
    ) {
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
      const existing = map.getSource(sourceId) as
        | maplibregl.ImageSource
        | undefined;
      if (existing) {
        // Split because combined updateImage({ url, coordinates }) is observed
        // to skip the coord change on MapLibre 5.x — set coords first.
        existing.setCoordinates(coords);
        existing.updateImage({ url });
        return;
      }
      map.addSource(sourceId, {
        type: "image",
        url,
        coordinates: coords,
      });
      // Insert beneath the first symbol layer so street/place labels stack on top.
      map.addLayer(
        {
          id: layerId,
          type: "raster",
          source: sourceId,
          paint: {
            "raster-opacity": opacity,
            "raster-resampling": "linear",
          },
        },
        firstSymbolId(),
      );
    }

    async function renderRasters() {
      const placeNow = useHavenStore.getState().place;
      const hazard = useHavenStore.getState().activeHazard;
      if (!placeNow || hazard !== "heat" || map.getZoom() < HEAT_MIN_ZOOM) {
        unmountAll();
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
      const qs = params.toString();

      // Parallel fetch; allSettled so canopy failure doesn't kill heat or vice versa.
      const [heatSettled, canopySettled] = await Promise.allSettled([
        fetch(`/api/heat?${qs}`),
        fetch(`/api/canopy?${qs}`),
      ]);

      // Re-check gates AFTER the fetch — the user may have cleared the place,
      // switched hazards, or zoomed below threshold while we were waiting.
      // Without this, a slow fetch can race a fast zoom-out and mount a
      // stale-bbox raster at low zoom (the patch the QA flagged).
      if (
        !useHavenStore.getState().place ||
        useHavenStore.getState().activeHazard !== "heat" ||
        map.getZoom() < HEAT_MIN_ZOOM
      ) {
        unmountAll();
        return;
      }

      // Mount heat first so canopy stacks above it (both still below labels).
      if (heatSettled.status === "fulfilled" && heatSettled.value.ok) {
        try {
          const data = (await heatSettled.value.json()) as { points: HeatPoint[] };
          const url = buildRasterURL(
            (data.points ?? []).map((p) => p.temp),
            HEAT_RAMP,
          );
          if (url) {
            mountRasterLayer(HEAT_SOURCE_ID, HEAT_LAYER_ID, url, bbox, HEAT_OPACITY);
          }
        } catch {
          // ignore JSON failure
        }
      }
      if (canopySettled.status === "fulfilled" && canopySettled.value.ok) {
        try {
          const data = (await canopySettled.value.json()) as {
            points: CanopyPoint[];
          };
          const url = buildRasterURL(
            (data.points ?? []).map((p) => p.canopy),
            CANOPY_RAMP,
          );
          if (url) {
            mountRasterLayer(
              CANOPY_SOURCE_ID,
              CANOPY_LAYER_ID,
              url,
              bbox,
              CANOPY_OPACITY,
            );
          }
        } catch {
          // ignore JSON failure
        }
      }
    }
    renderRastersRef.current = renderRasters;

    let debounceId: ReturnType<typeof setTimeout> | null = null;
    function scheduleRender() {
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(renderRasters, MOVE_DEBOUNCE_MS);
    }

    map.on("moveend", scheduleRender);
    // Any zoom gesture unmounts both rasters immediately so a stale-coord
    // raster can never read as a shrinking patch in the new viewport.
    // Show/refetch waits for the debounced moveend so we don't hammer the API.
    map.on("zoomstart", () => {
      if (map.getLayer(HEAT_LAYER_ID) || map.getLayer(CANOPY_LAYER_ID)) {
        unmountAll();
      }
    });

    mapRef.current = map;

    return () => {
      if (debounceId) clearTimeout(debounceId);
      markerRef.current?.remove();
      markerRef.current = null;
      renderRastersRef.current = () => {};
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Place change → marker + flyTo. Cleared → strip marker + both rasters.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!place) {
      markerRef.current?.remove();
      markerRef.current = null;
      if (map.getLayer(HEAT_LAYER_ID)) map.removeLayer(HEAT_LAYER_ID);
      if (map.getSource(HEAT_SOURCE_ID)) map.removeSource(HEAT_SOURCE_ID);
      if (map.getLayer(CANOPY_LAYER_ID)) map.removeLayer(CANOPY_LAYER_ID);
      if (map.getSource(CANOPY_SOURCE_ID)) map.removeSource(CANOPY_SOURCE_ID);
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
    // flyTo will fire moveend → debounced renderRasters → fetch + paint both layers.
  }, [place]);

  useEffect(() => {
    renderRastersRef.current();
  }, [activeHazard]);

  return <div ref={containerRef} className="h-full w-full" />;
}
