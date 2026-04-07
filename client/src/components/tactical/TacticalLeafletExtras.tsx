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

/** Fit the map when bounds change (e.g. metadata loaded). */
export function FitBoundsOnBounds({
  bounds,
  padFraction = 0.02,
}: {
  bounds: L.LatLngBounds;
  padFraction?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!bounds.isValid()) return;
    const target = padFraction > 0 ? bounds.pad(padFraction) : bounds;
    // No maxZoom cap — large terrain must be able to zoom out far enough to show the full extent.
    map.fitBounds(target, { padding: [36, 36], animate: false });
  }, [map, bounds, padFraction]);
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
