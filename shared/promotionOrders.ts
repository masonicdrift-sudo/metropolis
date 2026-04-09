/**
 * Standard promotion orders wording + body builder for FLASH alerts / packets.
 */
export const PROMOTION_ORDERS_INTRO = `ATTENTION TO ORDERS:

The Secretary of the Army has reposed special trust and confidence in the patriotism, valor, fidelity, and professional excellence of the following noncommissioned officers. In view of these qualities and their demonstrated leadership potential and dedicated service to the United States Army, they are, therefore, promoted to the rank shown. Promotion is made in the PMOS shown in the name line along with the recipient's current rank and effective advancement date.`;

export type PromotionOrdersLine = {
  username: string;
  /** Rank before promotion (snapshot at packet request). */
  previousRank: string;
  newRank: string;
  /** Primary MOS code at time of request. */
  pmos: string;
  /** Effective date (ISO or display string). */
  effectiveDate: string;
};

/** Full message shown to each promoted soldier (includes full list when multiple). */
export function buildPromotionOrdersMessage(lines: PromotionOrdersLine[]): string {
  if (lines.length === 0) return PROMOTION_ORDERS_INTRO;
  const detail = lines.map(
    (l) =>
      `• ${l.username.toUpperCase()} — PMOS ${l.pmos?.trim() || "—"} — Current rank ${l.previousRank?.trim() || "—"} — Advanced to ${l.newRank} — Effective date: ${l.effectiveDate}`,
  );
  return [PROMOTION_ORDERS_INTRO, "", ...detail].join("\n");
}
