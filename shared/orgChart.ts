import { z } from "zod";

/** One billet / position on the chart */
export const orgSlotSchema = z.object({
  id: z.string().min(1),
  roleTitle: z.string(),
  positionCode: z.string(),
  /** TacEdge username; empty = unfilled */
  assignedUsername: z.string().default(""),
  /** Optional single status letter (e.g. per PERSTAT) — may be filled by UI */
  statusLetter: z.string().default(""),
  /** Line roster row id — display like roster + link to linkedUsername profile when set */
  personnelRosterEntryId: z.number().int().default(0),
  /** Free-text assignee when not using directory user or roster row */
  writtenName: z.string().default(""),
});

export type OrgSlot = z.infer<typeof orgSlotSchema>;

export const orgLadderStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  sublabel: z.string().default(""),
});

export const orgColumnSchema = z.object({
  id: z.string(),
  headerTitle: z.string(),
  headerSubtitle: z.string().default(""),
  slots: z.array(orgSlotSchema),
});

/** Sub-column branching under an HQ block */
export const orgHqBranchSchema = z.object({
  id: z.string().min(1),
  title: z.string().default("Branch"),
  slots: z.array(orgSlotSchema),
});

export type OrgHqBranch = z.infer<typeof orgHqBranchSchema>;

/** One HQ block (repeatable); position in chart is controlled by `blockOrder`. */
export const orgHqSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().default("HQ"),
  slots: z.array(orgSlotSchema),
  branches: z.array(orgHqBranchSchema).default([]),
});

export const ladderLayoutSchema = z.enum(["vertical", "horizontal"]);

/** One org "chain": ladder + HQ blocks + element columns (independent from other chains). */
export const orgChainSchema = z.object({
  id: z.string().min(1),
  title: z.string().default(""),
  ladder: z.array(orgLadderStepSchema),
  ladderLayout: ladderLayoutSchema.default("vertical"),
  hqSections: z.array(orgHqSectionSchema),
  columns: z.array(orgColumnSchema),
  blockOrder: z.array(z.string().min(1)),
});

export type OrgChain = z.infer<typeof orgChainSchema>;

/** Legacy v2 (single chain at root) — migrated to v3 on read */
const orgChartSchemaV2 = z.object({
  version: z.literal(2),
  ladder: z.array(orgLadderStepSchema),
  ladderLayout: ladderLayoutSchema.default("vertical"),
  hqSections: z.array(orgHqSectionSchema),
  columns: z.array(orgColumnSchema),
  blockOrder: z.array(z.string().min(1)),
});

export type OrgChartDataV2 = z.infer<typeof orgChartSchemaV2>;

export const orgChartSchema = z.object({
  version: z.literal(3),
  chains: z.array(orgChainSchema).min(1),
});

export type OrgChartData = z.infer<typeof orgChartSchema>;
export type LadderLayout = z.infer<typeof ladderLayoutSchema>;
export type OrgColumn = z.infer<typeof orgColumnSchema>;
export type OrgHqSection = z.infer<typeof orgHqSectionSchema>;

/** Legacy v1 shape (single HQ blob) — migrated on read */
const orgChartSchemaV1 = z.object({
  version: z.literal(1),
  ladder: z.array(orgLadderStepSchema),
  hq: z.object({ slots: z.array(orgSlotSchema) }),
  columns: z.array(orgColumnSchema),
});

export type OrgChartDataV1 = z.infer<typeof orgChartSchemaV1>;

/** GET /api/org-chart — slots include server-computed display lines */
export type OrgSlotView = OrgSlot & { displayLine: string; profileLinkUsername?: string };
export type OrgHqBranchView = Omit<OrgHqBranch, "slots"> & { slots: OrgSlotView[] };
export type OrgHqSectionView = Omit<OrgHqSection, "slots" | "branches"> & {
  slots: OrgSlotView[];
  branches: OrgHqBranchView[];
};
export type OrgChainView = Omit<OrgChain, "hqSections" | "columns"> & {
  hqSections: OrgHqSectionView[];
  columns: Array<Omit<OrgColumn, "slots"> & { slots: OrgSlotView[] }>;
};

export type OrgChartView = {
  version: 3;
  chains: OrgChainView[];
};

export function newOrgId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyOrgSlot(prefix: string): OrgSlot {
  return {
    id: newOrgId(prefix),
    roleTitle: "",
    positionCode: "",
    assignedUsername: "",
    statusLetter: "",
    personnelRosterEntryId: 0,
    writtenName: "",
  };
}

function normalizeSlot(s: OrgSlot): OrgSlot {
  return {
    ...s,
    personnelRosterEntryId: s.personnelRosterEntryId ?? 0,
    writtenName: s.writtenName ?? "",
  };
}

function normalizeChainSlots(chain: OrgChain): OrgChain {
  return {
    ...chain,
    hqSections: chain.hqSections.map((sec) => ({
      ...sec,
      branches: (sec.branches ?? []).map((b) => ({
        ...b,
        slots: b.slots.map(normalizeSlot),
      })),
      slots: sec.slots.map(normalizeSlot),
    })),
    columns: chain.columns.map((c) => ({
      ...c,
      slots: c.slots.map(normalizeSlot),
    })),
  };
}

/** Ensure blockOrder lists ladder once, columns once, and every hq section id exactly once within one chain. */
export function normalizeSingleChain(chain: OrgChain): OrgChain {
  const normalized = normalizeChainSlots(chain);
  const ids = normalized.hqSections.map((s) => s.id);
  const idSet = new Set(ids);
  const bo = normalized.blockOrder;
  const hasLadder = bo.includes("ladder");
  const hasColumns = bo.includes("columns");
  const hqInOrder = bo.filter((t) => t !== "ladder" && t !== "columns");
  const validHq = hqInOrder.filter((t) => idSet.has(t));
  const valid =
    hasLadder &&
    hasColumns &&
    validHq.length === ids.length &&
    new Set(validHq).size === ids.length &&
    bo.filter((t) => t === "ladder").length === 1 &&
    bo.filter((t) => t === "columns").length === 1;

  if (valid && bo.length === ids.length + 2) return normalized;

  return {
    ...normalized,
    blockOrder: ["ladder", ...ids, "columns"],
  };
}

function normalizeOrgChartData(data: OrgChartData): OrgChartData {
  return { ...data, chains: data.chains.map(normalizeSingleChain) };
}

function migrateV1ToV2(v1: OrgChartDataV1): OrgChartDataV2 {
  const hqId = newOrgId("hqsec");
  const slots = v1.hq.slots.map(normalizeSlot);
  return {
    version: 2,
    ladder: v1.ladder,
    ladderLayout: "vertical",
    hqSections: [{ id: hqId, title: "HQ", slots, branches: [] }],
    columns: v1.columns.map((c) => ({ ...c, slots: c.slots.map(normalizeSlot) })),
    blockOrder: ["ladder", hqId, "columns"],
  };
}

function migrateV2ToV3(v2: OrgChartDataV2): OrgChartData {
  return normalizeOrgChartData({
    version: 3,
    chains: [
      normalizeSingleChain({
        id: newOrgId("chain"),
        title: "",
        ladder: v2.ladder,
        ladderLayout: v2.ladderLayout ?? "vertical",
        hqSections: v2.hqSections,
        columns: v2.columns,
        blockOrder: v2.blockOrder,
      }),
    ],
  });
}

/** Default chart: one chain with one empty HQ block. */
export function createBlankOrgChart(): OrgChartData {
  const hqId = newOrgId("hqsec");
  return normalizeOrgChartData({
    version: 3,
    chains: [
      normalizeSingleChain({
        id: newOrgId("chain"),
        title: "",
        ladder: [],
        ladderLayout: "vertical",
        hqSections: [{ id: hqId, title: "HQ", slots: [], branches: [] }],
        columns: [],
        blockOrder: ["ladder", hqId, "columns"],
      }),
    ],
  });
}

/** @deprecated Use createBlankOrgChart — kept for call sites */
export function createDefaultOrgChart(): OrgChartData {
  return createBlankOrgChart();
}

export function parseOrgChart(raw: unknown): OrgChartData {
  const v3 = orgChartSchema.safeParse(raw);
  if (v3.success) return normalizeOrgChartData(v3.data);
  const v2 = orgChartSchemaV2.safeParse(raw);
  if (v2.success) return migrateV2ToV3(v2.data);
  const v1 = orgChartSchemaV1.safeParse(raw);
  if (v1.success) return migrateV2ToV3(migrateV1ToV2(v1.data));
  return createBlankOrgChart();
}

/** Client may hold GET response with extra displayLine; strip before PUT. */
export type OrgSlotWithDisplay = OrgSlot & { displayLine?: string; profileLinkUsername?: string };

function mapHqSectionSlots(sec: OrgHqSection, fn: (s: OrgSlot) => OrgSlot): OrgHqSection {
  return {
    ...sec,
    branches: (sec.branches ?? []).map((b) => ({
      ...b,
      slots: b.slots.map(fn),
    })),
    slots: sec.slots.map(fn),
  };
}

export function updateChain(data: OrgChartData, chainId: string, fn: (c: OrgChain) => OrgChain): OrgChartData {
  return {
    ...data,
    chains: data.chains.map((c) => (c.id === chainId ? normalizeSingleChain(fn({ ...c })) : c)),
  };
}

export function mapEverySlot(data: OrgChartData, fn: (s: OrgSlot) => OrgSlot): OrgChartData {
  return {
    ...data,
    chains: data.chains.map((ch) => ({
      ...ch,
      hqSections: ch.hqSections.map((sec) => mapHqSectionSlots(sec, fn)),
      columns: ch.columns.map((c) => ({ ...c, slots: c.slots.map(fn) })),
    })),
  };
}

/** Assign one user to a slot; clears that username from any other slot (one billet per user). */
export function assignUsernameToSlot(data: OrgChartData, slotId: string, username: string): OrgChartData {
  const u = username.trim();
  return mapEverySlot(data, (s) => {
    if (s.id === slotId) {
      return u
        ? { ...s, assignedUsername: u, personnelRosterEntryId: 0, writtenName: "" }
        : { ...s, assignedUsername: "", personnelRosterEntryId: 0, writtenName: "" };
    }
    if (u && (s.assignedUsername || "").trim() === u) return { ...s, assignedUsername: "" };
    return s;
  });
}

/** Link a personnel roster row to a slot (one slot per roster row). Clears TacEdge user + write-in on that slot. */
export function assignRosterEntryToSlot(data: OrgChartData, slotId: string, rosterEntryId: number): OrgChartData {
  return mapEverySlot(data, (s) => {
    if (s.id === slotId) {
      return rosterEntryId > 0
        ? { ...s, personnelRosterEntryId: rosterEntryId, assignedUsername: "", writtenName: "" }
        : { ...s, personnelRosterEntryId: 0, assignedUsername: "", writtenName: "" };
    }
    if (rosterEntryId > 0 && s.personnelRosterEntryId === rosterEntryId) {
      return { ...s, personnelRosterEntryId: 0 };
    }
    return s;
  });
}

/** Free-text assignee (write-in). Clears directory user and roster link on that slot. */
export function setSlotWrittenName(data: OrgChartData, slotId: string, writtenName: string): OrgChartData {
  const w = writtenName.trim();
  return mapEverySlot(data, (s) =>
    s.id === slotId ? { ...s, writtenName: w, assignedUsername: "", personnelRosterEntryId: 0 } : s,
  );
}

/** Clear all assignment fields on a slot. */
export function clearSlotAssignment(data: OrgChartData, slotId: string): OrgChartData {
  return mapEverySlot(data, (s) =>
    s.id === slotId ? { ...s, assignedUsername: "", personnelRosterEntryId: 0, writtenName: "" } : s,
  );
}

export function addLadderStep(data: OrgChartData, chainId: string, label: string, sublabel: string): OrgChartData {
  return updateChain(data, chainId, (c) => ({
    ...c,
    ladder: [...c.ladder, { id: newOrgId("ladder"), label, sublabel: sublabel || "" }],
  }));
}

export function updateLadderStep(
  data: OrgChartData,
  chainId: string,
  stepId: string,
  label: string,
  sublabel: string,
): OrgChartData {
  return updateChain(data, chainId, (c) => ({
    ...c,
    ladder: c.ladder.map((s) => (s.id === stepId ? { ...s, label, sublabel: sublabel || "" } : s)),
  }));
}

export function removeLadderStep(data: OrgChartData, chainId: string, stepId: string): OrgChartData {
  return updateChain(data, chainId, (c) => ({ ...c, ladder: c.ladder.filter((s) => s.id !== stepId) }));
}

/** Move one chain row earlier (up in vertical layout, left in horizontal) or later (down / right). */
export function moveLadderStep(
  data: OrgChartData,
  chainId: string,
  stepId: string,
  direction: "earlier" | "later",
): OrgChartData {
  return updateChain(data, chainId, (c) => {
    const ix = c.ladder.findIndex((s) => s.id === stepId);
    if (ix < 0) return c;
    const j = direction === "earlier" ? ix - 1 : ix + 1;
    if (j < 0 || j >= c.ladder.length) return c;
    const ladder = [...c.ladder];
    [ladder[ix], ladder[j]] = [ladder[j], ladder[ix]];
    return { ...c, ladder };
  });
}

export function setLadderLayout(data: OrgChartData, chainId: string, ladderLayout: LadderLayout): OrgChartData {
  return updateChain(data, chainId, (c) => ({ ...c, ladderLayout }));
}

export function addHqSlot(
  data: OrgChartData,
  chainId: string,
  sectionId: string,
  roleTitle: string,
  positionCode: string,
  branchId?: string,
): OrgChartData {
  const slot: OrgSlot = {
    ...createEmptyOrgSlot("hq"),
    roleTitle,
    positionCode,
  };
  if (!branchId) {
    return updateChain(data, chainId, (c) => ({
      ...c,
      hqSections: c.hqSections.map((sec) =>
        sec.id === sectionId ? { ...sec, slots: [...sec.slots, slot] } : sec,
      ),
    }));
  }
  return updateChain(data, chainId, (c) => ({
    ...c,
    hqSections: c.hqSections.map((sec) => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        branches: (sec.branches ?? []).map((b) =>
          b.id === branchId ? { ...b, slots: [...b.slots, slot] } : b,
        ),
      };
    }),
  }));
}

export function addHqBranch(data: OrgChartData, chainId: string, sectionId: string, title: string): OrgChartData {
  const bid = newOrgId("hqbr");
  const br: OrgHqBranch = {
    id: bid,
    title: title.trim() || "Branch",
    slots: [],
  };
  return updateChain(data, chainId, (c) => ({
    ...c,
    hqSections: c.hqSections.map((s) =>
      s.id === sectionId ? { ...s, branches: [...(s.branches ?? []), br] } : s,
    ),
  }));
}

export function removeHqBranch(data: OrgChartData, chainId: string, sectionId: string, branchId: string): OrgChartData {
  return updateChain(data, chainId, (c) => ({
    ...c,
    hqSections: c.hqSections.map((s) =>
      s.id === sectionId ? { ...s, branches: (s.branches ?? []).filter((b) => b.id !== branchId) } : s,
    ),
  }));
}

export function updateHqBranchTitle(
  data: OrgChartData,
  chainId: string,
  sectionId: string,
  branchId: string,
  title: string,
): OrgChartData {
  return updateChain(data, chainId, (c) => ({
    ...c,
    hqSections: c.hqSections.map((s) =>
      s.id !== sectionId
        ? s
        : {
            ...s,
            branches: (s.branches ?? []).map((b) =>
              b.id === branchId ? { ...b, title: title.trim() || "Branch" } : b,
            ),
          },
    ),
  }));
}

export function addHqSection(data: OrgChartData, chainId: string, title: string): OrgChartData {
  return updateChain(data, chainId, (c) => {
    const id = newOrgId("hqsec");
    const sec: OrgHqSection = {
      id,
      title: title.trim() || "HQ",
      slots: [],
      branches: [],
    };
    const bo = [...c.blockOrder];
    const colIdx = bo.indexOf("columns");
    if (colIdx >= 0) bo.splice(colIdx, 0, id);
    else bo.push(id);
    return { ...c, hqSections: [...c.hqSections, sec], blockOrder: bo };
  });
}

export function removeHqSection(data: OrgChartData, chainId: string, sectionId: string): OrgChartData {
  return updateChain(data, chainId, (c) => {
    if (c.hqSections.length <= 1) return c;
    return {
      ...c,
      hqSections: c.hqSections.filter((s) => s.id !== sectionId),
      blockOrder: c.blockOrder.filter((t) => t !== sectionId),
    };
  });
}

export function updateHqSectionTitle(data: OrgChartData, chainId: string, sectionId: string, title: string): OrgChartData {
  return updateChain(data, chainId, (c) => ({
    ...c,
    hqSections: c.hqSections.map((s) => (s.id === sectionId ? { ...s, title: title.trim() || "HQ" } : s)),
  }));
}

/** Move a block token (`ladder`, `columns`, or an hq section id) up/down within one org chain. */
export function moveBlockOrderToken(
  data: OrgChartData,
  chainId: string,
  token: string,
  direction: "up" | "down",
): OrgChartData {
  return updateChain(data, chainId, (c) => {
    const o = [...c.blockOrder];
    const i = o.indexOf(token);
    if (i < 0) return c;
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= o.length) return c;
    [o[i], o[j]] = [o[j], o[i]];
    return { ...c, blockOrder: o };
  });
}

export function addColumn(data: OrgChartData, chainId: string, headerTitle: string, headerSubtitle: string): OrgChartData {
  return updateChain(data, chainId, (c) => ({
    ...c,
    columns: [
      ...c.columns,
      {
        id: newOrgId("col"),
        headerTitle,
        headerSubtitle: headerSubtitle || "",
        slots: [],
      },
    ],
  }));
}

export function updateColumnHeaders(
  data: OrgChartData,
  chainId: string,
  colId: string,
  headerTitle: string,
  headerSubtitle: string,
): OrgChartData {
  return updateChain(data, chainId, (c) => ({
    ...c,
    columns: c.columns.map((col) =>
      col.id === colId ? { ...col, headerTitle, headerSubtitle: headerSubtitle || "" } : col,
    ),
  }));
}

export function removeColumn(data: OrgChartData, chainId: string, colId: string): OrgChartData {
  return updateChain(data, chainId, (c) => ({ ...c, columns: c.columns.filter((col) => col.id !== colId) }));
}

export function addSlotToColumn(
  data: OrgChartData,
  chainId: string,
  colId: string,
  roleTitle: string,
  positionCode: string,
): OrgChartData {
  const slot: OrgSlot = {
    ...createEmptyOrgSlot("slot"),
    roleTitle,
    positionCode,
  };
  return updateChain(data, chainId, (c) => ({
    ...c,
    columns: c.columns.map((col) =>
      col.id === colId ? { ...col, slots: [...col.slots, slot] } : col,
    ),
  }));
}

export function updateSlotFields(
  data: OrgChartData,
  slotId: string,
  fields: Partial<Pick<OrgSlot, "roleTitle" | "positionCode" | "statusLetter">>,
): OrgChartData {
  const map = (s: OrgSlot): OrgSlot => (s.id === slotId ? { ...s, ...fields } : s);
  return mapEverySlot(data, map);
}

function removeSlotFromChain(ch: OrgChain, slotId: string): OrgChain {
  for (const sec of ch.hqSections) {
    if (sec.slots.some((s) => s.id === slotId)) {
      return normalizeSingleChain({
        ...ch,
        hqSections: ch.hqSections.map((s) =>
          s.id === sec.id ? { ...s, slots: s.slots.filter((x) => x.id !== slotId) } : s,
        ),
      });
    }
    for (const b of sec.branches ?? []) {
      if (b.slots.some((s) => s.id === slotId)) {
        return normalizeSingleChain({
          ...ch,
          hqSections: ch.hqSections.map((s) =>
            s.id === sec.id
              ? {
                  ...s,
                  branches: (s.branches ?? []).map((br) =>
                    br.id === b.id ? { ...br, slots: br.slots.filter((x) => x.id !== slotId) } : br,
                  ),
                }
              : s,
          ),
        });
      }
    }
  }
  if (ch.columns.some((c) => c.slots.some((s) => s.id === slotId))) {
    return normalizeSingleChain({
      ...ch,
      columns: ch.columns.map((c) => ({
        ...c,
        slots: c.slots.filter((s) => s.id !== slotId),
      })),
    });
  }
  return ch;
}

export function removeSlotById(data: OrgChartData, slotId: string): OrgChartData {
  return { ...data, chains: data.chains.map((ch) => removeSlotFromChain(ch, slotId)) };
}

/** Add a new independent org chain (own ladder, HQ, elements). */
export function addOrgChain(data: OrgChartData, title?: string): OrgChartData {
  const hqId = newOrgId("hqsec");
  const chain: OrgChain = normalizeSingleChain({
    id: newOrgId("chain"),
    title: (title ?? "").trim(),
    ladder: [],
    ladderLayout: "vertical",
    hqSections: [{ id: hqId, title: "HQ", slots: [], branches: [] }],
    columns: [],
    blockOrder: ["ladder", hqId, "columns"],
  });
  return normalizeOrgChartData({ ...data, chains: [...data.chains, chain] });
}

export function removeOrgChain(data: OrgChartData, chainId: string): OrgChartData {
  if (data.chains.length <= 1) return data;
  return normalizeOrgChartData({ ...data, chains: data.chains.filter((c) => c.id !== chainId) });
}

export function moveOrgChainOrder(data: OrgChartData, chainId: string, direction: "up" | "down"): OrgChartData {
  const ix = data.chains.findIndex((c) => c.id === chainId);
  if (ix < 0) return data;
  const j = direction === "up" ? ix - 1 : ix + 1;
  if (j < 0 || j >= data.chains.length) return data;
  const chains = [...data.chains];
  [chains[ix], chains[j]] = [chains[j], chains[ix]];
  return { ...data, chains };
}

export function updateOrgChainTitle(data: OrgChartData, chainId: string, title: string): OrgChartData {
  return {
    ...data,
    chains: data.chains.map((c) => (c.id === chainId ? { ...c, title: title.trim() } : c)),
  };
}

export function stripOrgChartForSave(data: OrgChartView): OrgChartData {
  const slot = (s: OrgSlotWithDisplay): OrgSlot => ({
    id: s.id,
    roleTitle: s.roleTitle,
    positionCode: s.positionCode,
    assignedUsername: s.assignedUsername ?? "",
    statusLetter: s.statusLetter ?? "",
    personnelRosterEntryId: s.personnelRosterEntryId ?? 0,
    writtenName: s.writtenName ?? "",
  });
  return normalizeOrgChartData({
    version: 3,
    chains: data.chains.map((ch) => ({
      id: ch.id,
      title: ch.title ?? "",
      ladder: ch.ladder,
      ladderLayout: ch.ladderLayout ?? "vertical",
      hqSections: ch.hqSections.map((sec) => ({
        id: sec.id,
        title: sec.title,
        slots: sec.slots.map(slot),
        branches: (sec.branches ?? []).map((b) => ({
          id: b.id,
          title: b.title,
          slots: b.slots.map(slot),
        })),
      })),
      columns: ch.columns.map((c) => ({
        ...c,
        slots: c.slots.map(slot),
      })),
      blockOrder: ch.blockOrder,
    })),
  });
}

/** True if HQ section has any billet in main row or branches */
export function hqSectionHasContent(sec: { slots: unknown[]; branches?: { slots: unknown[] }[] }): boolean {
  if (sec.slots.length > 0) return true;
  for (const b of sec.branches ?? []) {
    if (b.slots.length > 0) return true;
  }
  return false;
}

/** True if a chain has any ladder row, HQ content, or element columns with billets */
export function orgChainHasContent(chain: {
  ladder: unknown[];
  hqSections: { slots: unknown[]; branches?: { slots: unknown[] }[] }[];
  columns: { slots: unknown[] }[];
}): boolean {
  if (chain.ladder.length > 0) return true;
  for (const sec of chain.hqSections) {
    if (hqSectionHasContent(sec)) return true;
  }
  for (const col of chain.columns) {
    if (col.slots.length > 0) return true;
  }
  return false;
}
