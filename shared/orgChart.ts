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

export const orgChartSchema = z.object({
  version: z.literal(2),
  ladder: z.array(orgLadderStepSchema),
  /** How chain-of-command rows are laid out within the ladder block */
  ladderLayout: ladderLayoutSchema.default("vertical"),
  hqSections: z.array(orgHqSectionSchema),
  columns: z.array(orgColumnSchema),
  /** Vertical stack order: each entry is `ladder`, `columns`, or an hq section id */
  blockOrder: z.array(z.string().min(1)),
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
export type OrgChartView = {
  version: 2;
  ladder: OrgChartData["ladder"];
  ladderLayout: OrgChartData["ladderLayout"];
  hqSections: OrgHqSectionView[];
  columns: Array<Omit<OrgColumn, "slots"> & { slots: OrgSlotView[] }>;
  blockOrder: string[];
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

function normalizeOrgChartSlots(data: OrgChartData): OrgChartData {
  return {
    ...data,
    hqSections: data.hqSections.map((sec) => ({
      ...sec,
      branches: (sec.branches ?? []).map((b) => ({
        ...b,
        slots: b.slots.map(normalizeSlot),
      })),
      slots: sec.slots.map(normalizeSlot),
    })),
    columns: data.columns.map((c) => ({
      ...c,
      slots: c.slots.map(normalizeSlot),
    })),
  };
}

function migrateV1ToV2(v1: OrgChartDataV1): OrgChartData {
  const hqId = newOrgId("hqsec");
  const slots = v1.hq.slots.map(normalizeSlot);
  return normalizeBlockOrder({
    version: 2,
    ladder: v1.ladder,
    ladderLayout: "vertical",
    hqSections: [{ id: hqId, title: "HQ", slots, branches: [] }],
    columns: v1.columns.map((c) => ({ ...c, slots: c.slots.map(normalizeSlot) })),
    blockOrder: ["ladder", hqId, "columns"],
  });
}

/** Ensure blockOrder lists ladder once, columns once, and every hq section id exactly once. */
export function normalizeBlockOrder(data: OrgChartData): OrgChartData {
  const normalized = normalizeOrgChartSlots(data);
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

/** Default chart: one empty HQ block (not totally blank). */
export function createBlankOrgChart(): OrgChartData {
  const hqId = newOrgId("hqsec");
  return normalizeBlockOrder({
    version: 2,
    ladder: [],
    ladderLayout: "vertical",
    hqSections: [{ id: hqId, title: "HQ", slots: [], branches: [] }],
    columns: [],
    blockOrder: ["ladder", hqId, "columns"],
  });
}

/** @deprecated Use createBlankOrgChart — kept for call sites */
export function createDefaultOrgChart(): OrgChartData {
  return createBlankOrgChart();
}

export function parseOrgChart(raw: unknown): OrgChartData {
  const v2 = orgChartSchema.safeParse(raw);
  if (v2.success) return normalizeBlockOrder(normalizeOrgChartSlots(v2.data));
  const v1 = orgChartSchemaV1.safeParse(raw);
  if (v1.success) return migrateV1ToV2(v1.data);
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

export function mapEverySlot(data: OrgChartData, fn: (s: OrgSlot) => OrgSlot): OrgChartData {
  return {
    ...data,
    hqSections: data.hqSections.map((sec) => mapHqSectionSlots(sec, fn)),
    columns: data.columns.map((c) => ({ ...c, slots: c.slots.map(fn) })),
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

export function addLadderStep(data: OrgChartData, label: string, sublabel: string): OrgChartData {
  return {
    ...data,
    ladder: [...data.ladder, { id: newOrgId("ladder"), label, sublabel: sublabel || "" }],
  };
}

export function updateLadderStep(
  data: OrgChartData,
  stepId: string,
  label: string,
  sublabel: string,
): OrgChartData {
  return {
    ...data,
    ladder: data.ladder.map((s) =>
      s.id === stepId ? { ...s, label, sublabel: sublabel || "" } : s,
    ),
  };
}

export function removeLadderStep(data: OrgChartData, stepId: string): OrgChartData {
  return { ...data, ladder: data.ladder.filter((s) => s.id !== stepId) };
}

/** Move one chain row earlier (up in vertical layout, left in horizontal) or later (down / right). */
export function moveLadderStep(data: OrgChartData, stepId: string, direction: "earlier" | "later"): OrgChartData {
  const ix = data.ladder.findIndex((s) => s.id === stepId);
  if (ix < 0) return data;
  const j = direction === "earlier" ? ix - 1 : ix + 1;
  if (j < 0 || j >= data.ladder.length) return data;
  const ladder = [...data.ladder];
  [ladder[ix], ladder[j]] = [ladder[j], ladder[ix]];
  return { ...data, ladder };
}

export function setLadderLayout(data: OrgChartData, ladderLayout: LadderLayout): OrgChartData {
  return { ...data, ladderLayout };
}

export function addHqSlot(
  data: OrgChartData,
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
    return {
      ...data,
      hqSections: data.hqSections.map((sec) =>
        sec.id === sectionId ? { ...sec, slots: [...sec.slots, slot] } : sec,
      ),
    };
  }
  return {
    ...data,
    hqSections: data.hqSections.map((sec) => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        branches: (sec.branches ?? []).map((b) =>
          b.id === branchId ? { ...b, slots: [...b.slots, slot] } : b,
        ),
      };
    }),
  };
}

export function addHqBranch(data: OrgChartData, sectionId: string, title: string): OrgChartData {
  const bid = newOrgId("hqbr");
  const br: OrgHqBranch = {
    id: bid,
    title: title.trim() || "Branch",
    slots: [],
  };
  return {
    ...data,
    hqSections: data.hqSections.map((s) =>
      s.id === sectionId ? { ...s, branches: [...(s.branches ?? []), br] } : s,
    ),
  };
}

export function removeHqBranch(data: OrgChartData, sectionId: string, branchId: string): OrgChartData {
  return {
    ...data,
    hqSections: data.hqSections.map((s) =>
      s.id === sectionId ? { ...s, branches: (s.branches ?? []).filter((b) => b.id !== branchId) } : s,
    ),
  };
}

export function updateHqBranchTitle(data: OrgChartData, sectionId: string, branchId: string, title: string): OrgChartData {
  return {
    ...data,
    hqSections: data.hqSections.map((s) =>
      s.id !== sectionId
        ? s
        : {
            ...s,
            branches: (s.branches ?? []).map((b) =>
              b.id === branchId ? { ...b, title: title.trim() || "Branch" } : b,
            ),
          },
    ),
  };
}

export function addHqSection(data: OrgChartData, title: string): OrgChartData {
  const id = newOrgId("hqsec");
  const sec: OrgHqSection = {
    id,
    title: title.trim() || "HQ",
    slots: [],
    branches: [],
  };
  const bo = [...data.blockOrder];
  const colIdx = bo.indexOf("columns");
  if (colIdx >= 0) bo.splice(colIdx, 0, id);
  else bo.push(id);
  return normalizeBlockOrder({
    ...data,
    hqSections: [...data.hqSections, sec],
    blockOrder: bo,
  });
}

export function removeHqSection(data: OrgChartData, sectionId: string): OrgChartData {
  if (data.hqSections.length <= 1) return data;
  return normalizeBlockOrder({
    ...data,
    hqSections: data.hqSections.filter((s) => s.id !== sectionId),
    blockOrder: data.blockOrder.filter((t) => t !== sectionId),
  });
}

export function updateHqSectionTitle(data: OrgChartData, sectionId: string, title: string): OrgChartData {
  return {
    ...data,
    hqSections: data.hqSections.map((s) =>
      s.id === sectionId ? { ...s, title: title.trim() || "HQ" } : s,
    ),
  };
}

/** Move a block token (`ladder`, `columns`, or an hq section id) up/down in the stack. */
export function moveBlockOrderToken(
  data: OrgChartData,
  token: string,
  direction: "up" | "down",
): OrgChartData {
  const o = [...data.blockOrder];
  const i = o.indexOf(token);
  if (i < 0) return data;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= o.length) return data;
  [o[i], o[j]] = [o[j], o[i]];
  return { ...data, blockOrder: o };
}

export function addColumn(data: OrgChartData, headerTitle: string, headerSubtitle: string): OrgChartData {
  return {
    ...data,
    columns: [
      ...data.columns,
      {
        id: newOrgId("col"),
        headerTitle,
        headerSubtitle: headerSubtitle || "",
        slots: [],
      },
    ],
  };
}

export function updateColumnHeaders(
  data: OrgChartData,
  colId: string,
  headerTitle: string,
  headerSubtitle: string,
): OrgChartData {
  return {
    ...data,
    columns: data.columns.map((c) =>
      c.id === colId ? { ...c, headerTitle, headerSubtitle: headerSubtitle || "" } : c,
    ),
  };
}

export function removeColumn(data: OrgChartData, colId: string): OrgChartData {
  return { ...data, columns: data.columns.filter((c) => c.id !== colId) };
}

export function addSlotToColumn(
  data: OrgChartData,
  colId: string,
  roleTitle: string,
  positionCode: string,
): OrgChartData {
  const slot: OrgSlot = {
    ...createEmptyOrgSlot("slot"),
    roleTitle,
    positionCode,
  };
  return {
    ...data,
    columns: data.columns.map((c) =>
      c.id === colId ? { ...c, slots: [...c.slots, slot] } : c,
    ),
  };
}

export function updateSlotFields(
  data: OrgChartData,
  slotId: string,
  fields: Partial<Pick<OrgSlot, "roleTitle" | "positionCode" | "statusLetter">>,
): OrgChartData {
  const map = (s: OrgSlot): OrgSlot => (s.id === slotId ? { ...s, ...fields } : s);
  return mapEverySlot(data, map);
}

export function removeSlotById(data: OrgChartData, slotId: string): OrgChartData {
  for (const sec of data.hqSections) {
    if (sec.slots.some((s) => s.id === slotId)) {
      return {
        ...data,
        hqSections: data.hqSections.map((s) =>
          s.id === sec.id ? { ...s, slots: s.slots.filter((x) => x.id !== slotId) } : s,
        ),
      };
    }
    for (const b of sec.branches ?? []) {
      if (b.slots.some((s) => s.id === slotId)) {
        return {
          ...data,
          hqSections: data.hqSections.map((s) =>
            s.id === sec.id
              ? {
                  ...s,
                  branches: (s.branches ?? []).map((br) =>
                    br.id === b.id ? { ...br, slots: br.slots.filter((x) => x.id !== slotId) } : br,
                  ),
                }
              : s,
          ),
        };
      }
    }
  }
  return {
    ...data,
    columns: data.columns.map((c) => ({
      ...c,
      slots: c.slots.filter((s) => s.id !== slotId),
    })),
  };
}

export function stripOrgChartForSave(data: {
  version: 2;
  ladder: OrgChartData["ladder"];
  ladderLayout?: OrgChartData["ladderLayout"];
  hqSections: Array<{
    id: string;
    title: string;
    slots: OrgSlotWithDisplay[];
    branches?: Array<{ id: string; title: string; slots: OrgSlotWithDisplay[] }>;
  }>;
  columns: Array<Omit<OrgColumn, "slots"> & { slots: OrgSlotWithDisplay[] }>;
  blockOrder: string[];
}): OrgChartData {
  const slot = (s: OrgSlotWithDisplay): OrgSlot => ({
    id: s.id,
    roleTitle: s.roleTitle,
    positionCode: s.positionCode,
    assignedUsername: s.assignedUsername ?? "",
    statusLetter: s.statusLetter ?? "",
    personnelRosterEntryId: s.personnelRosterEntryId ?? 0,
    writtenName: s.writtenName ?? "",
  });
  return normalizeBlockOrder({
    version: 2,
    ladder: data.ladder,
    ladderLayout: data.ladderLayout ?? "vertical",
    hqSections: data.hqSections.map((sec) => ({
      id: sec.id,
      title: sec.title,
      slots: sec.slots.map(slot),
      branches: (sec.branches ?? []).map((b) => ({
        id: b.id,
        title: b.title,
        slots: b.slots.map(slot),
      })),
    })),
    columns: data.columns.map((c) => ({
      ...c,
      slots: c.slots.map(slot),
    })),
    blockOrder: data.blockOrder,
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
