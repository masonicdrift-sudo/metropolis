import type { Award } from "@shared/schema";
import { getMilitaryAwardById, sortAwardsByPrecedence } from "@shared/militaryAwardsCatalog";

export type EnrichedAward = Award & {
  catalogBranch: string;
  catalogPrecedence: number;
  imageUrl: string | null;
};

export function enrichAwardRow(a: Award): EnrichedAward {
  const def = getMilitaryAwardById((a.awardCatalogId || "").trim());
  return {
    ...a,
    /** Prefer current catalog classification (e.g. CAB moved to type badge). */
    awardType: def?.awardType ?? a.awardType,
    catalogBranch: def?.branch ?? "Custom",
    catalogPrecedence: def?.precedence ?? 999_999,
    imageUrl: def?.imageUrl ? def.imageUrl : null,
  };
}

export function enrichAndSortAwards(rows: Award[]): EnrichedAward[] {
  return sortAwardsByPrecedence(rows.map(enrichAwardRow));
}
