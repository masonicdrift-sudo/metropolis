import { NATO_FRIENDLY_SIDCS } from "./natoFriendlySidcs";

export { NATO_FRIENDLY_SIDCS };
export type { NatoFriendlySidc } from "./natoFriendlySidcs";

/**
 * Letter-based SIDC presets for STANAG APP-6 / MIL-STD-2525 (via milsymbol).
 * Friendly / Hostile / Neutral / Unknown × Unit / Vehicle / Building / Equipment.
 */
export type TacAffiliation = "friendly" | "hostile" | "neutral" | "unknown";
export type TacMarkerCategory = "unit" | "vehicle" | "building" | "equipment";

const TABLE: Record<`${TacAffiliation}:${TacMarkerCategory}`, string> = {
  "friendly:unit": "SFGPUCI---****F",
  "hostile:unit": "SHGPUCI---****F",
  "neutral:unit": "SNGPUCI---****N",
  "unknown:unit": "SUGPUCI---****U",
  "friendly:vehicle": "SFGPUCIN---***F",
  "hostile:vehicle": "SHGPUCIN---***F",
  "neutral:vehicle": "SNGPUCIN---***N",
  "unknown:vehicle": "SUGPUCIN---***U",
  "friendly:building": "SFGPI-----****H",
  "hostile:building": "SHGPI-----****H",
  "neutral:building": "SNGPI-----****H",
  "unknown:building": "SUGPI-----****H",
  "friendly:equipment": "SFGPUSS---****F",
  "hostile:equipment": "SHGPUSS---****F",
  "neutral:equipment": "SNGPUSS---****N",
  "unknown:equipment": "SUGPUSS---****U",
};

/** All milsymbol-valid friendly-template SIDCs we expose in the picker (plus legacy keys). */
export const NATO_FRIENDLY_SIDCS_SET = new Set<string>(NATO_FRIENDLY_SIDCS);

export function sidcForMarker(
  affiliation: TacAffiliation,
  category: TacMarkerCategory,
): string {
  const key = `${affiliation}:${category}` as keyof typeof TABLE;
  return TABLE[key] ?? "SUGPUCI---****U";
}

const AFF_MID: Record<TacAffiliation, string> = {
  friendly: "F",
  hostile: "H",
  neutral: "N",
  unknown: "U",
};

const AFF_TAIL: Record<TacAffiliation, string> = {
  friendly: "F",
  hostile: "F",
  neutral: "N",
  unknown: "U",
};

/**
 * Apply standard identity (and tail F/N/U when applicable) to a *friendly*-template SIDC.
 * Installations ending in H keep H for all affiliations.
 */
export function sidcForAffiliation(
  friendlySidc: string,
  affiliation: TacAffiliation,
): string {
  if (friendlySidc.length !== 15) return friendlySidc;
  const mid = AFF_MID[affiliation];
  const last = friendlySidc[14]!;
  let tail = last;
  if (last === "F" || last === "N" || last === "U") {
    tail = AFF_TAIL[affiliation];
  }
  return friendlySidc[0] + mid + friendlySidc.slice(2, 14) + tail;
}

const LEGACY_TYPES = new Set<string>([
  "unit",
  "vehicle",
  "building",
  "equipment",
]);

/**
 * Resolve final SIDC from affiliation + marker type.
 * `markerType` is either a legacy category (unit/vehicle/…) or a friendly-template preset from {@link NATO_FRIENDLY_SIDCS}.
 */
export function resolveMarkerSidc(
  affiliation: TacAffiliation,
  markerType: string,
): string | null {
  if (LEGACY_TYPES.has(markerType)) {
    return sidcForMarker(affiliation, markerType as TacMarkerCategory);
  }
  if (NATO_FRIENDLY_SIDCS_SET.has(markerType)) {
    return sidcForAffiliation(markerType, affiliation);
  }
  return null;
}
