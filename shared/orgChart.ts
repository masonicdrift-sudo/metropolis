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

export const orgChartSchema = z.object({
  version: z.literal(1),
  ladder: z.array(orgLadderStepSchema),
  hq: z.object({ slots: z.array(orgSlotSchema) }),
  columns: z.array(orgColumnSchema),
});

export type OrgChartData = z.infer<typeof orgChartSchema>;
export type OrgColumn = z.infer<typeof orgColumnSchema>;

/** GET /api/org-chart — slots include server-computed display lines */
export type OrgSlotView = OrgSlot & { displayLine: string };
export type OrgChartView = {
  version: 1;
  ladder: OrgChartData["ladder"];
  hq: { slots: OrgSlotView[] };
  columns: Array<Omit<OrgColumn, "slots"> & { slots: OrgSlotView[] }>;
};

export function newOrgId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Empty canvas — staff builds ladder, HQ, and elements in the UI. */
export function createBlankOrgChart(): OrgChartData {
  return {
    version: 1,
    ladder: [],
    hq: { slots: [] },
    columns: [],
  };
}

/** @deprecated Use createBlankOrgChart — kept for call sites */
export function createDefaultOrgChart(): OrgChartData {
  return createBlankOrgChart();
}

export function parseOrgChart(raw: unknown): OrgChartData {
  const r = orgChartSchema.safeParse(raw);
  if (r.success) return r.data;
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
    hq: { slots: data.hq.slots.map(mapSlot) },
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

export function addHqSlot(data: OrgChartData, roleTitle: string, positionCode: string): OrgChartData {
  const slot: OrgSlot = {
    id: newOrgId("hq"),
    roleTitle,
    positionCode,
    assignedUsername: "",
    statusLetter: "",
  };
  return { ...data, hq: { slots: [...data.hq.slots, slot] } };
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
    hq: { slots: data.hq.slots.map(map) },
    columns: data.columns.map((c) => ({ ...c, slots: c.slots.map(map) })),
  };
}

export function removeSlotById(data: OrgChartData, slotId: string): OrgChartData {
  if (data.hq.slots.some((s) => s.id === slotId)) {
    return { ...data, hq: { slots: data.hq.slots.filter((s) => s.id !== slotId) } };
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
  version: 1;
  ladder: OrgChartData["ladder"];
  hq: OrgChartData["hq"];
  columns: OrgChartData["columns"];
}): OrgChartData {
  const slot = (s: OrgSlotWithDisplay): OrgSlot => ({
    id: s.id,
    roleTitle: s.roleTitle,
    positionCode: s.positionCode,
    assignedUsername: s.assignedUsername ?? "",
    statusLetter: s.statusLetter ?? "",
  });
  return {
    version: 1,
    ladder: data.ladder,
    hq: { slots: data.hq.slots.map(slot) },
    columns: data.columns.map((c) => ({
      ...c,
      slots: c.slots.map(slot),
    })),
  };
}
