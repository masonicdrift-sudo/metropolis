/**
 * Hit-test and stable IDs for structure/building polygons (game X/Z meters).
 * Leaflet CRS.Simple uses lat = Z, lng = X — same as these coords.
 */

export type GeoJsonFeatureLike = {
  type?: string;
  properties?: Record<string, unknown> | null;
  geometry?: { type: string; coordinates: unknown };
};

function hashGeometry(geom: { type: string; coordinates: unknown } | undefined): string {
  const s = JSON.stringify(geom ?? {});
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0).toString(36);
}

/** Stable key for a structure feature so labels persist across sessions for this map export. */
export function stableFeatureKey(feature: GeoJsonFeatureLike): string {
  const p = feature.properties ?? {};
  if (p.id != null && String(p.id) !== "") return `id:${String(p.id)}`;
  if (p.objectId != null) return `oid:${String(p.objectId)}`;
  if (p.buildingId != null) return `bid:${String(p.buildingId)}`;
  if (p.name != null && String(p.name) !== "") return `name:${String(p.name)}`;
  return `h:${hashGeometry(feature.geometry)}`;
}

function xz(c: number[]): [number, number] {
  const x = c[0];
  const z = c.length >= 3 ? c[2] : c[1];
  return [x, z];
}

function ringToXZ(ring: number[][]): [number, number][] {
  return ring.map(xz);
}

/** Ray-casting point-in-polygon (X/Z plane). */
export function pointInRing(x: number, z: number, ring: [number, number][]): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const zi = ring[i][1];
    const xj = ring[j][0];
    const zj = ring[j][1];
    const cross = zi > z !== zj > z;
    if (!cross) continue;
    const xinters = ((xj - xi) * (z - zi)) / (zj - zi + 1e-18) + xi;
    if (x < xinters) inside = !inside;
  }
  return inside;
}

function pointInPolygonRings(x: number, z: number, rings: number[][][]): boolean {
  if (!rings.length) return false;
  const exterior = ringToXZ(rings[0]);
  if (!pointInRing(x, z, exterior)) return false;
  for (let i = 1; i < rings.length; i++) {
    const hole = ringToXZ(rings[i]);
    if (pointInRing(x, z, hole)) return false;
  }
  return true;
}

/**
 * Find the top-most structure feature under (gameX, gameZ). Iterates in reverse
 * so later features (often drawn on top) win when overlapping.
 */
export function findBuildingFeatureAt(
  fc: { type: "FeatureCollection"; features: unknown[] } | undefined,
  gameX: number,
  gameZ: number,
): { feature: GeoJsonFeatureLike; featureKey: string } | null {
  if (!fc?.features?.length) return null;
  const feats = fc.features as GeoJsonFeatureLike[];
  for (let i = feats.length - 1; i >= 0; i--) {
    const f = feats[i];
    const g = f.geometry;
    if (!g?.coordinates) continue;
    let hit = false;
    if (g.type === "Polygon") {
      hit = pointInPolygonRings(gameX, gameZ, g.coordinates as number[][][]);
    } else if (g.type === "MultiPolygon") {
      const mp = g.coordinates as number[][][][];
      for (const poly of mp) {
        if (pointInPolygonRings(gameX, gameZ, poly)) {
          hit = true;
          break;
        }
      }
    }
    if (hit) {
      return { feature: f, featureKey: stableFeatureKey(f) };
    }
  }
  return null;
}
