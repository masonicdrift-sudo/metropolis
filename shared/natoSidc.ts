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

export function sidcForMarker(
  affiliation: TacAffiliation,
  category: TacMarkerCategory,
): string {
  const key = `${affiliation}:${category}` as keyof typeof TABLE;
  return TABLE[key] ?? "SUGPUCI---****U";
}
