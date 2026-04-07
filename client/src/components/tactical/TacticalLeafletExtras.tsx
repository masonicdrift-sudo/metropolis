import { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

function niceStep(span: number, lines: number): number {
  const raw = Math.max(span / lines, 1e-9);
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const m = raw / base;
  const f = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
  return f * base;
}

/**
 * One automatic fit per map after bounds stabilize (GeoJSON loads in waves).
 * Does not refit when bounds change again after that (avoids recentre while panning).
 * Skips entirely if the user pans before the fit runs.
 */
export function FitBoundsDebouncedOncePerMap({
  mapKey,
  bounds,
  padFraction = 0.04,
  debounceMs = 800,
}: {
  mapKey: string;
  bounds: L.LatLngBounds;
  padFraction?: number;
  debounceMs?: number;
}) {
  const map = useMap();
  const userPannedRef = useRef(false);
  const hasAutoFittedRef = useRef(false);

  useEffect(() => {
    userPannedRef.current = false;
    hasAutoFittedRef.current = false;
  }, [mapKey]);

  useMapEvents({
    dragend: () => {
      userPannedRef.current = true;
      hasAutoFittedRef.current = true;
    },
  });

  useEffect(() => {
    if (!mapKey || !bounds.isValid() || hasAutoFittedRef.current) return;
    const id = window.setTimeout(() => {
      if (userPannedRef.current) {
        hasAutoFittedRef.current = true;
        return;
      }
      const target = padFraction > 0 ? bounds.pad(padFraction) : bounds;
      map.fitBounds(target, { padding: [48, 48], animate: false });
      hasAutoFittedRef.current = true;
    }, debounceMs);
    return () => window.clearTimeout(id);
  }, [map, mapKey, bounds, padFraction, debounceMs]);

  return null;
}

/** Mobile Safari / flex layouts often report 0×0 until late; Leaflet needs invalidateSize after layout. */
export function InvalidateMapSizeOnResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const invalidate = () => {
      map.invalidateSize({ animate: false });
    };
    invalidate();
    const ro = new ResizeObserver(() => invalidate());
    ro.observe(el);
    window.addEventListener("orientationchange", invalidate);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", invalidate);
    };
  }, [map]);
  return null;
}

/** Game-space grid (X = lng, Z = lat) in meters; updates on pan/zoom. */
export function GameGridOverlay({
  enabled,
  color = "rgba(148, 163, 184, 0.32)",
}: {
  enabled: boolean;
  color?: string;
}) {
  const map = useMap();
  const groupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const g = L.layerGroup();
    groupRef.current = g;
    g.addTo(map);
    return () => {
      g.remove();
      groupRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;

    const redraw = () => {
      g.clearLayers();
      if (!enabled) return;
      const b = map.getBounds();
      const west = b.getWest();
      const east = b.getEast();
      const south = b.getSouth();
      const north = b.getNorth();
      const w = Math.abs(east - west);
      const h = Math.abs(north - south);
      const step = niceStep(Math.max(w, h), 12);
      const margin = step * 2;
      const x0 = Math.floor((west - margin) / step) * step;
      const x1 = Math.ceil((east + margin) / step) * step;
      const z0 = Math.floor((south - margin) / step) * step;
      const z1 = Math.ceil((north + margin) / step) * step;
      const style: L.PolylineOptions = {
        color,
        weight: 1,
        interactive: false,
        pane: "overlayPane",
      };
      for (let x = x0; x <= x1; x += step) {
        g.addLayer(
          L.polyline(
            [
              [south - margin, x],
              [north + margin, x],
            ],
            style,
          ),
        );
      }
      for (let z = z0; z <= z1; z += step) {
        g.addLayer(
          L.polyline(
            [
              [z, west - margin],
              [z, east + margin],
            ],
            style,
          ),
        );
      }
    };

    map.on("moveend", redraw);
    map.on("zoomend", redraw);
    redraw();
    return () => {
      map.off("moveend", redraw);
      map.off("zoomend", redraw);
    };
  }, [map, enabled, color]);

  return null;
}

export function MapCursorCoords({
  onCoords,
}: {
  onCoords: (line: string | null) => void;
}) {
  useMapEvents({
    mousemove(e) {
      const x = e.latlng.lng;
      const z = e.latlng.lat;
      onCoords(`X ${x.toFixed(1)} m · Z ${z.toFixed(1)} m`);
    },
    mouseout() {
      onCoords(null);
    },
  });
  return null;
}
