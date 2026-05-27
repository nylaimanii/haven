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
// Overscan: fetch + position the raster 50% beyond the viewport on each side
// (= 2× viewport in each axis). The raster's actual rectangle edge then sits
// well outside what the user sees, so no flyTo/move timing variance can ever
// reveal a hard bounding box. Combined with the radial alpha mask in
// buildRasterURL the visible field has no perceptible edge at all.
const HEAT_BBOX_PAD = 0.5;
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
const FLOOD_SOURCE_ID = "haven-flood-raster";
const FLOOD_LAYER_ID = "haven-flood-raster-layer";
const FLOOD_OPACITY = 0.55;
const AIR_SOURCE_ID = "haven-air-raster";
const AIR_LAYER_ID = "haven-air-raster-layer";
const AIR_OPACITY = 0.7;
// Absolute US AQI scale for the air raster. AQI < ~25 = clean (transparent),
// AQI >= 200 = unhealthy/hazardous, painted fully. Anchored to real category
// boundaries instead of viewport min/max so a clean city doesn't get falsely
// amber'd just because it's slightly less clean than its neighbor.
const AIR_AQI_MIN = 0;
const AIR_AQI_MAX = 200;

const HUB_COLOR = "#3FC179"; // --haven-safe
const HUB_MAX_SHOWN = 5;

const ROUTE_SOURCE_ID = "haven-route";
const ROUTE_CASING_LAYER_ID = "haven-route-casing";
const ROUTE_LAYER_ID = "haven-route-line";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHubMarkerEl(openNow: boolean | null): HTMLElement {
  const el = document.createElement("div");
  const known = openNow === true;
  el.style.width = "12px";
  el.style.height = "12px";
  el.style.borderRadius = "50%";
  el.style.background = known ? HUB_COLOR : "transparent";
  el.style.border = `2px solid ${HUB_COLOR}`;
  el.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.5)";
  el.style.cursor = "pointer";
  el.style.boxSizing = "border-box";
  return el;
}

type HeatPoint = { lat: number; lng: number; temp: number };
type CanopyPoint = { lat: number; lng: number; canopy: number };
type FloodPoint = { lat: number; lng: number; elevation: number };
type AirPoint = { lat: number; lng: number; aqi: number };
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

// Lowest elevation in the viewport reads as deep --haven-flood blue; high
// ground fades to transparent. Inverted on purpose: low ground = at-risk.
const FLOOD_RAMP: Ramp = [
  [0.0, [58, 138, 209, 235]],
  [0.25, [80, 150, 215, 200]],
  [0.55, [120, 175, 225, 130]],
  [0.85, [150, 195, 235, 60]],
  [1.0, [255, 255, 255, 0]],
];

// Air-quality ramp: clean (AQI ~0) → transparent, worsening → deepening
// haven-air amber, hazardous → dark amber/brown. Mapped against absolute
// AQI 0..200 via fixedRange so the colors match real category severity.
const AIR_RAMP: Ramp = [
  [0.0, [217, 166, 72, 0]],
  [0.25, [217, 166, 72, 100]],
  [0.5, [200, 130, 60, 180]],
  [0.75, [180, 95, 50, 225]],
  [1.0, [150, 70, 40, 250]],
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

type RasterBuildOptions = {
  // When provided, normalize each pixel against this absolute range instead of
  // the viewport's min/max. Use for signals like US AQI where 30 and 200 are
  // wildly different real-world conditions and we don't want viewport
  // normalization to flatten them.
  fixedRange?: { min: number; max: number };
};

// Bilinear-interpolate the N×N value grid into a SIZE×SIZE color raster,
// then run a blur pass for buttery edges. Returns a data URL or null.
function buildRasterURL(
  values: number[],
  ramp: Ramp,
  options: RasterBuildOptions = {},
): string | null {
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
  if (options.fixedRange) {
    minV = options.fixedRange.min;
    maxV = options.fixedRange.max;
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
  // Radial alpha mask: feather the canvas's own edges to transparent so even
  // if the geo bbox rectangle is visible in the viewport, the user never sees
  // a hard edge — color smoothly dissolves into the basemap. innerR=0.35×SIZE
  // keeps the data-bearing center fully opaque; outerR=0.5×SIZE puts the
  // fade-out exactly at the canvas edge.
  oc.filter = "none";
  oc.globalCompositeOperation = "destination-in";
  const cx = HEAT_RASTER_SIZE / 2;
  const grad = oc.createRadialGradient(
    cx,
    cx,
    HEAT_RASTER_SIZE * 0.35,
    cx,
    cx,
    HEAT_RASTER_SIZE * 0.5,
  );
  grad.addColorStop(0, "rgba(0,0,0,1)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  oc.fillStyle = grad;
  oc.fillRect(0, 0, HEAT_RASTER_SIZE, HEAT_RASTER_SIZE);
  return out.toDataURL("image/png");
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const renderRastersRef = useRef<() => void>(() => {});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const place = useHavenStore((s) => s.place);
  const activeHazard = useHavenStore((s) => s.activeHazard);
  const hubs = useHavenStore((s) => s.hubs);
  const route = useHavenStore((s) => s.route);

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
      unmountRasterLayer(FLOOD_SOURCE_ID, FLOOD_LAYER_ID);
      unmountRasterLayer(AIR_SOURCE_ID, AIR_LAYER_ID);
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

    function paddedBBox(): BBox {
      const b = map.getBounds();
      const w = b.getWest();
      const e = b.getEast();
      const s = b.getSouth();
      const n = b.getNorth();
      const padLng = (e - w) * HEAT_BBOX_PAD;
      const padLat = (n - s) * HEAT_BBOX_PAD;
      return {
        west: w - padLng,
        east: e + padLng,
        south: s - padLat,
        north: n + padLat,
      };
    }

    function bboxQS(bbox: BBox): string {
      return new URLSearchParams({
        west: String(bbox.west),
        south: String(bbox.south),
        east: String(bbox.east),
        north: String(bbox.north),
      }).toString();
    }

    async function renderHeat(bbox: BBox, qs: string) {
      // Heat + canopy in parallel; allSettled so one failure doesn't kill the other.
      const [heatSettled, canopySettled] = await Promise.allSettled([
        fetch(`/api/heat?${qs}`),
        fetch(`/api/canopy?${qs}`),
      ]);
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
        } catch {}
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
        } catch {}
      }
    }

    async function renderFlood(bbox: BBox, qs: string) {
      try {
        const r = await fetch(`/api/flood?${qs}`);
        if (!r.ok) return;
        const data = (await r.json()) as { points: FloodPoint[] };
        if (
          !useHavenStore.getState().place ||
          useHavenStore.getState().activeHazard !== "flood" ||
          map.getZoom() < HEAT_MIN_ZOOM
        ) {
          unmountAll();
          return;
        }
        const url = buildRasterURL(
          (data.points ?? []).map((p) => p.elevation),
          FLOOD_RAMP,
        );
        if (url) {
          mountRasterLayer(
            FLOOD_SOURCE_ID,
            FLOOD_LAYER_ID,
            url,
            bbox,
            FLOOD_OPACITY,
          );
        }
      } catch {
        // ignore — degrade to "no raster" cleanly
      }
    }

    async function renderAir(bbox: BBox, qs: string) {
      try {
        const r = await fetch(`/api/air?${qs}`);
        if (!r.ok) return;
        const data = (await r.json()) as { points: AirPoint[] };
        if (
          !useHavenStore.getState().place ||
          useHavenStore.getState().activeHazard !== "air" ||
          map.getZoom() < HEAT_MIN_ZOOM
        ) {
          unmountAll();
          return;
        }
        const url = buildRasterURL(
          (data.points ?? []).map((p) => p.aqi),
          AIR_RAMP,
          { fixedRange: { min: AIR_AQI_MIN, max: AIR_AQI_MAX } },
        );
        if (url) {
          mountRasterLayer(
            AIR_SOURCE_ID,
            AIR_LAYER_ID,
            url,
            bbox,
            AIR_OPACITY,
          );
        }
      } catch {
        // ignore — degrade to "no raster" cleanly
      }
    }

    async function renderRasters() {
      const placeNow = useHavenStore.getState().place;
      const hazard = useHavenStore.getState().activeHazard;
      if (!placeNow || map.getZoom() < HEAT_MIN_ZOOM) {
        unmountAll();
        return;
      }

      const bbox = paddedBBox();
      const qs = bboxQS(bbox);

      if (hazard === "heat") {
        unmountRasterLayer(FLOOD_SOURCE_ID, FLOOD_LAYER_ID);
        unmountRasterLayer(AIR_SOURCE_ID, AIR_LAYER_ID);
        await renderHeat(bbox, qs);
      } else if (hazard === "flood") {
        unmountRasterLayer(HEAT_SOURCE_ID, HEAT_LAYER_ID);
        unmountRasterLayer(CANOPY_SOURCE_ID, CANOPY_LAYER_ID);
        unmountRasterLayer(AIR_SOURCE_ID, AIR_LAYER_ID);
        await renderFlood(bbox, qs);
      } else if (hazard === "air") {
        unmountRasterLayer(HEAT_SOURCE_ID, HEAT_LAYER_ID);
        unmountRasterLayer(CANOPY_SOURCE_ID, CANOPY_LAYER_ID);
        unmountRasterLayer(FLOOD_SOURCE_ID, FLOOD_LAYER_ID);
        await renderAir(bbox, qs);
      } else {
        unmountAll();
      }
    }
    renderRastersRef.current = renderRasters;

    function scheduleRender() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(renderRasters, MOVE_DEBOUNCE_MS);
    }

    map.on("moveend", scheduleRender);
    // Only unmount during zoom-OUT, not zoom-in. The previous "zoomstart on any
    // zoom" was too aggressive: a flyTo from initial zoom 10 → 12 (a search
    // into the app) fired zoomstart and wiped any in-flight or freshly-mounted
    // raster, which is exactly the "Newark works but Philadelphia doesn't"
    // symptom the QA flagged. Zoom-in leaves the geo-anchored raster covering
    // the new (smaller) viewport just fine, so no unmount is needed there.
    let lastZoom = map.getZoom();
    map.on("zoom", () => {
      const z = map.getZoom();
      if (z < lastZoom) {
        if (
          map.getLayer(HEAT_LAYER_ID) ||
          map.getLayer(CANOPY_LAYER_ID) ||
          map.getLayer(FLOOD_LAYER_ID) ||
          map.getLayer(AIR_LAYER_ID)
        ) {
          unmountAll();
        }
      }
      lastZoom = z;
    });

    mapRef.current = map;

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
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
      // renderRasters sees place=null and tears down whatever raster is
      // currently mounted (heat+canopy or flood). Cleaner than maintaining
      // a parallel list of source/layer ids here.
      renderRastersRef.current();
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

    // Fire renderRasters once the map is FULLY SETTLED after flyTo. "idle"
    // fires after moveend AND after all queued tile loads finish — it's the
    // canonical MapLibre "nothing pending, geometry is stable" signal.
    // moveend alone fired before the basemap finished resolving for a
    // far-away city, so getBounds() occasionally returned a still-animating
    // viewport and the raster mounted with a slightly-too-small bbox.
    // Cancels any pending debounced render so we don't double-fetch.
    const onIdle = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      renderRastersRef.current();
    };
    map.once("idle", onIdle);

    return () => {
      map.off("idle", onIdle);
    };
  }, [place]);

  useEffect(() => {
    renderRastersRef.current();
  }, [activeHazard]);

  // Nearest resilience hubs as small green markers. Cleanup removes them when
  // hubs change, place clears, or hazard switches — keeps state in lockstep
  // with the store.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!hubs || activeHazard !== "heat") return;

    const markers: maplibregl.Marker[] = [];
    const shown = hubs.slice(0, HUB_MAX_SHOWN);
    for (const hub of shown) {
      const el = buildHubMarkerEl(hub.openNow);
      const popup = new maplibregl.Popup({
        offset: 12,
        closeButton: false,
      }).setHTML(
        `<div style="font-family:system-ui;font-size:11px;color:#0a0a0a;line-height:1.4">` +
          `<strong>${escapeHtml(hub.name)}</strong><br/>` +
          `${(hub.distanceMeters / 1000).toFixed(1)} km` +
          `</div>`,
      );
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([hub.lng, hub.lat])
        .setPopup(popup)
        .addTo(map);
      markers.push(marker);
    }

    return () => {
      for (const m of markers) m.remove();
    };
  }, [hubs, activeHazard]);

  // Walking route to the nearest cooling hub. Casing + main line drawn above
  // the heat/canopy rasters but before the first symbol layer, so street and
  // place labels still read on top. Hub markers are HTML overlays so they
  // naturally sit above the route line — the line connects toward but
  // doesn't bury the pin it leads to.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!route || activeHazard !== "heat") return;

    let beforeId: string | undefined;
    for (const layer of map.getStyle().layers ?? []) {
      if (layer.type === "symbol") {
        beforeId = layer.id;
        break;
      }
    }

    map.addSource(ROUTE_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: route.geometry,
      },
    });
    map.addLayer(
      {
        id: ROUTE_CASING_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "rgba(0,0,0,0.55)",
          "line-width": 7,
        },
      },
      beforeId,
    );
    map.addLayer(
      {
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": HUB_COLOR,
          "line-width": 4,
        },
      },
      beforeId,
    );

    return () => {
      if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
      if (map.getLayer(ROUTE_CASING_LAYER_ID)) {
        map.removeLayer(ROUTE_CASING_LAYER_ID);
      }
      if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
    };
  }, [route, activeHazard]);

  return <div ref={containerRef} className="h-full w-full" />;
}
