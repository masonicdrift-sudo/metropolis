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

/** One HQ block (repeatable); position in chart is controlled by `blockOrder`. */
export const orgHqSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().default("HQ"),
  slots: z.array(orgSlotSchema),
});

export const orgChartSchema = z.object({
  version: z.literal(2),
  ladder: z.array(orgLadderStepSchema),
  hqSections: z.array(orgHqSectionSchema),
  columns: z.array(orgColumnSchema),
  /** Vertical stack order: each entry is `ladder`, `columns`, or an hq section id */
  blockOrder: z.array(z.string().min(1)),
});

export type OrgChartData = z.infer<typeof orgChartSchema>;
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
export type OrgSlotView = OrgSlot & { displayLine: string };
export type OrgHqSectionView = Omit<OrgHqSection, "slots"> & { slots: OrgSlotView[] };
export type OrgChartView = {
  version: 2;
  ladder: OrgChartData["ladder"];
  hqSections: OrgHqSectionView[];
  columns: Array<Omit<OrgColumn, "slots"> & { slots: OrgSlotView[] }>;
  blockOrder: string[];
};

export function newOrgId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function migrateV1ToV2(v1: OrgChartDataV1): OrgChartData {
  const hqId = newOrgId("hqsec");
  return normalizeBlockOrder({
    version: 2,
    ladder: v1.ladder,
    hqSections: [{ id: hqId, title: "HQ", slots: v1.hq.slots }],
    columns: v1.columns,
    blockOrder: ["ladder", hqId, "columns"],
  });
}

/** Ensure blockOrder lists ladder once, columns once, and every hq section id exactly once. */
export function normalizeBlockOrder(data: OrgChartData): OrgChartData {
  const ids = data.hqSections.map((s) => s.id);
  const idSet = new Set(ids);
  const bo = data.blockOrder;
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

  if (valid && bo.length === ids.length + 2) return data;

  return {
    ...data,
    blockOrder: ["ladder", ...ids, "columns"],
  };
}

/** Default chart: one empty HQ block (not totally blank). */
export function createBlankOrgChart(): OrgChartData {
  const hqId = newOrgId("hqsec");
  return normalizeBlockOrder({
    version: 2,
    ladder: [],
    hqSections: [{ id: hqId, title: "HQ", slots: [] }],
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
  if (v2.success) return normalizeBlockOrder(v2.data);
  const v1 = orgChartSchemaV1.safeParse(raw);
  if (v1.success) return migrateV1ToV2(v1.data);
  return createBlankOrgChart();
}

/** Client may hold GET response with extra displayLine; strip before PUT. */
export type OrgSlotWithDisplay = OrgSlot & { displayLine?: string };

/** Assign one user to a slot; clears that username from any other slot (one billet per user). */
export function assignUsernameToSlot(data: OrgChartData, slotId: string, username: string): OrgChartData {
  const u = username.trim();
  const mapSlot = (s: OrgSlot): OrgSlot => {
    if (s.id === slotId) return { ...s, assignedUsername: u };
    if (u && (s.assignedUsername || "").trim() === u) return { ...s, assignedUsername: "" };
    return s;
  };
  return {
    ...data,
    hqSections: data.hqSections.map((sec) => ({ ...sec, slots: sec.slots.map(mapSlot) })),
    columns: data.columns.map((c) => ({ ...c, slots: c.slots.map(mapSlot) })),
  };
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

export function addHqSlot(
  data: OrgChartData,
  sectionId: string,
  roleTitle: string,
  positionCode: string,
): OrgChartData {
  const slot: OrgSlot = {
    id: newOrgId("hq"),
    roleTitle,
    positionCode,
    assignedUsername: "",
    statusLetter: "",
  };
  return {
    ...data,
    hqSections: data.hqSections.map((sec) =>
      sec.id === sectionId ? { ...sec, slots: [...sec.slots, slot] } : sec,
    ),
  };
}

export function addHqSection(data: OrgChartData, title: string): OrgChartData {
  const id = newOrgId("hqsec");
  const sec: OrgHqSection = {
    id,
    title: title.trim() || "HQ",
    slots: [],
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
    id: newOrgId("slot"),
    roleTitle,
    positionCode,
    assignedUsername: "",
    statusLetter: "",
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
  return {
    ...data,
    hqSections: data.hqSections.map((sec) => ({ ...sec, slots: sec.slots.map(map) })),
    columns: data.columns.map((c) => ({ ...c, slots: c.slots.map(map) })),
  };
}

export function removeSlotById(data: OrgChartData, slotId: string): OrgChartData {
  for (const sec of data.hqSections) {
    if (sec.slots.some((s) => s.id === slotId)) {
      return {
        ...data,
        hqSections: data.hqSections.map((s) => ({
          ...s,
          slots: s.slots.filter((x) => x.id !== slotId),
        })),
      };
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
  hqSections: Array<{ id: string; title: string; slots: OrgSlotWithDisplay[] }>;
  columns: Array<Omit<OrgColumn, "slots"> & { slots: OrgSlotWithDisplay[] }>;
  blockOrder: string[];
}): OrgChartData {
  const slot = (s: OrgSlotWithDisplay): OrgSlot => ({
    id: s.id,
    roleTitle: s.roleTitle,
    positionCode: s.positionCode,
    assignedUsername: s.assignedUsername ?? "",
    statusLetter: s.statusLetter ?? "",
  });
  return normalizeBlockOrder({
    version: 2,
    ladder: data.ladder,
    hqSections: data.hqSections.map((sec) => ({
      id: sec.id,
      title: sec.title,
      slots: sec.slots.map(slot),
    })),
    columns: data.columns.map((c) => ({
      ...c,
      slots: c.slots.map(slot),
    })),
    blockOrder: data.blockOrder,
  });
}
