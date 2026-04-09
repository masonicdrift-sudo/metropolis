import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import {
  addColumn,
  addHqBranch,
  addHqSection,
  addHqSlot,
  addLadderStep,
  addSlotToColumn,
  assignRosterEntryToSlot,
  assignUsernameToSlot,
  clearSlotAssignment,
  createBlankOrgChart,
  hqSectionHasContent,
  moveBlockOrderToken,
  removeColumn,
  removeHqBranch,
  removeHqSection,
  removeLadderStep,
  removeSlotById,
  setSlotWrittenName,
  stripOrgChartForSave,
  updateColumnHeaders,
  updateHqBranchTitle,
  updateHqSectionTitle,
  updateLadderStep,
  updateSlotFields,
  type OrgChartView,
  type OrgSlotView,
} from "@shared/orgChart";
import { SubPageNav } from "@/components/SubPageNav";
import { PERSONNEL_SUB } from "@/lib/appNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ProfileLink } from "@/components/ProfileLink";
import type { PersonnelRosterEntry } from "@shared/schema";
import {
  ChevronDown,
  ChevronUp,
  CircleCheck,
  GripHorizontal,
  Layers,
  Network,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import type { User } from "@shared/schema";

const userDragId = (username: string) => `org-assign-user:${username}`;
const rosterDragId = (entryId: number) => `org-assign-roster:${entryId}`;
const slotDropId = (slotId: string) => `org-assign-slot:${slotId}`;

function slotHasAssignment(s: OrgSlotView): boolean {
  return (
    !!(s.assignedUsername || "").trim() ||
    (s.personnelRosterEntryId ?? 0) > 0 ||
    !!(s.writtenName || "").trim()
  );
}

function findSlotInChart(chart: OrgChartView, slotId: string): OrgSlotView | undefined {
  for (const sec of chart.hqSections) {
    for (const s of sec.slots) if (s.id === slotId) return s;
    for (const br of sec.branches ?? []) {
      for (const s of br.slots) if (s.id === slotId) return s;
    }
  }
  for (const col of chart.columns) {
    for (const s of col.slots) if (s.id === slotId) return s;
  }
  return undefined;
}

function SlotCard({
  slot,
  editable,
  onClear,
  onEditBillet,
  onRemoveBillet,
  onWriteIn,
}: {
  slot: OrgSlotView;
  editable: boolean;
  onClear: () => void;
  onEditBillet: () => void;
  onRemoveBillet: () => void;
  onWriteIn?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: slotDropId(slot.id),
    disabled: !editable,
  });
  const filled = slotHasAssignment(slot);
  const un = (slot.assignedUsername || "").trim();
  const rosterId = slot.personnelRosterEntryId ?? 0;
  const writeIn = (slot.writtenName || "").trim();
  const kind: "user" | "roster" | "writein" | "empty" = un
    ? "user"
    : rosterId > 0
      ? "roster"
      : writeIn
        ? "writein"
        : "empty";
  const line = filled ? (slot.displayLine || un || writeIn || "").trim() : "";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded border border-border/80 bg-zinc-950/80 px-2 py-1.5 text-[10px] relative group",
        editable && "min-h-[52px]",
        editable && isOver && "ring-1 ring-blue-400/70 border-blue-500/50",
      )}
    >
      <div className="flex justify-between gap-1 items-start">
        <div className="min-w-0 flex-1">
          <div className="text-[9px] text-muted-foreground leading-tight">{slot.roleTitle || "—"}</div>
          <div className="text-[8px] font-mono text-muted-foreground/80">[{slot.positionCode || "—"}]</div>
          {kind !== "empty" ? (
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground/70 mt-0.5">
              {kind === "user" ? "Directory" : kind === "roster" ? "Roster row" : "Write-in"}
            </div>
          ) : null}
          <div
            className={cn(
              "text-[11px] font-semibold mt-0.5 leading-tight break-words",
              !filled && "text-muted-foreground/45 font-normal italic",
            )}
          >
            {filled ? (
              kind === "user" && un ? (
                <ProfileLink username={un} className="text-[11px] font-semibold text-foreground hover:text-blue-400">
                  {line || un}
                </ProfileLink>
              ) : slot.profileLinkUsername ? (
                <ProfileLink
                  username={slot.profileLinkUsername}
                  className="text-[11px] font-semibold text-foreground hover:text-blue-400"
                >
                  {line}
                </ProfileLink>
              ) : (
                line
              )
            ) : (
              "Empty"
            )}
          </div>
          {slot.statusLetter ? (
            <div className="text-[9px] text-muted-foreground mt-0.5">{slot.statusLetter}</div>
          ) : null}
          {editable && onWriteIn ? (
            <button
              type="button"
              className="text-[8px] text-blue-400/90 hover:text-blue-300 mt-0.5"
              onClick={(e) => {
                e.stopPropagation();
                onWriteIn();
              }}
            >
              {writeIn ? "Edit write-in" : "Write-in name"}
            </button>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {editable ? (
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground p-0.5"
                title="Edit billet"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditBillet();
                }}
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-red-400 p-0.5"
                title="Remove billet"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveBillet();
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ) : null}
          {filled ? <CircleCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> : null}
          {editable && filled ? (
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-0.5"
              title="Clear assignment"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RosterUserDraggable({ user }: { user: User }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: userDragId(user.username),
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "text-[10px] px-2 py-1.5 rounded border border-border bg-background/80 cursor-grab active:cursor-grabbing hover:bg-secondary/60 touch-none",
        isDragging && "opacity-60 ring-1 ring-blue-400/60",
      )}
    >
      <span className="text-muted-foreground">{(user.rank || "").trim() || "—"}</span>{" "}
      <span className="font-mono font-semibold">{user.username}</span>
    </div>
  );
}

function PersonnelRosterDraggable({ entry }: { entry: PersonnelRosterEntry }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: rosterDragId(entry.id),
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  const name = [entry.lastName, entry.firstName].filter(Boolean).join(", ") || "—";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "text-[10px] px-2 py-1.5 rounded border border-border/80 bg-zinc-900/80 cursor-grab active:cursor-grabbing hover:bg-secondary/50 touch-none",
        isDragging && "opacity-60 ring-1 ring-amber-400/50",
      )}
    >
      <span className="text-muted-foreground">{(entry.rank || "").trim() || "—"}</span>{" "}
      <span className="font-semibold">{name}</span>
    </div>
  );
}

type FormState = { a: string; b: string; c: string };

const emptyForm = (): FormState => ({ a: "", b: "", c: "" });

export default function OrgChartPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canEdit = user?.accessLevel === "admin" || user?.accessLevel === "owner";

  const { data: chart, isLoading } = useQuery<OrgChartView>({
    queryKey: ["/api/org-chart"],
    queryFn: () => apiRequest("GET", "/api/org-chart"),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users"),
    enabled: canEdit,
  });

  const { data: rosterEntries = [] } = useQuery<PersonnelRosterEntry[]>({
    queryKey: ["/api/personnel-roster"],
    queryFn: () => apiRequest("GET", "/api/personnel-roster"),
    enabled: canEdit,
  });

  const save = useMutation({
    mutationFn: (body: ReturnType<typeof stripOrgChartForSave>) =>
      apiRequest("PUT", "/api/org-chart", body),
    onSuccess: (data: OrgChartView) => {
      qc.setQueryData(["/api/org-chart"], data);
      toast({ title: "Saved" });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const persist = useCallback(
    (next: ReturnType<typeof stripOrgChartForSave>) => {
      save.mutate(next);
    },
    [save],
  );

  const [statsColId, setStatsColId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [removeSlotId, setRemoveSlotId] = useState<string | null>(null);

  const [pan, setPan] = useState({ x: 40, y: 24 });
  const [scale, setScale] = useState(0.88);
  const scaleRef = useRef(0.88);
  scaleRef.current = scale;
  const dragRef = useRef<{ active: boolean; sx: number; sy: number; px: number; py: number } | null>(null);
  const assignDragActiveRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  /** Dialog: ladder | hq-section | hq-branch | hq-slot | column | col-slot | slot-writein */
  const [dlg, setDlg] = useState<
    | null
    | { type: "ladder"; mode: "add" | "edit"; id?: string }
    | { type: "hq-section"; mode: "add" | "edit"; sectionId?: string }
    | { type: "hq-branch"; mode: "add" | "edit"; sectionId: string; branchId?: string }
    | { type: "hq-slot"; mode: "add" | "edit"; sectionId: string; id?: string; branchId?: string }
    | { type: "column"; mode: "add" | "edit"; id?: string }
    | { type: "col-slot"; columnId: string; mode: "add" | "edit"; slotId?: string }
    | { type: "slot-writein"; slotId: string }
  >(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (!chart || !dlg) return;
    if (dlg.mode === "add") return;
    if (dlg.type === "ladder" && dlg.mode === "edit" && dlg.id) {
      const s = chart.ladder.find((x) => x.id === dlg.id);
      if (s) setForm({ a: s.label, b: s.sublabel, c: "" });
    } else if (dlg.type === "hq-section" && dlg.mode === "edit" && dlg.sectionId) {
      const sec = chart.hqSections.find((x) => x.id === dlg.sectionId);
      if (sec) setForm({ a: sec.title, b: "", c: "" });
    } else if (dlg.type === "hq-branch" && dlg.mode === "edit" && dlg.branchId) {
      const sec = chart.hqSections.find((x) => x.id === dlg.sectionId);
      const br = sec?.branches?.find((b) => b.id === dlg.branchId);
      if (br) setForm({ a: br.title, b: "", c: "" });
    } else if (dlg.type === "hq-slot" && dlg.mode === "edit" && dlg.id) {
      const s = findSlotInChart(chart, dlg.id);
      if (s) setForm({ a: s.roleTitle, b: s.positionCode, c: s.statusLetter || "" });
    } else if (dlg.type === "slot-writein" && dlg.slotId) {
      const s = findSlotInChart(chart, dlg.slotId);
      if (s) setForm({ a: (s.writtenName || "").trim(), b: "", c: "" });
    } else if (dlg.type === "column" && dlg.mode === "edit" && dlg.id) {
      const c = chart.columns.find((x) => x.id === dlg.id);
      if (c) setForm({ a: c.headerTitle, b: c.headerSubtitle, c: "" });
    } else if (dlg.type === "col-slot" && dlg.mode === "edit" && dlg.slotId) {
      const col = chart.columns.find((x) => x.id === dlg.columnId);
      const s = col?.slots.find((x) => x.id === dlg.slotId);
      if (s) setForm({ a: s.roleTitle, b: s.positionCode, c: s.statusLetter || "" });
    } else {
      setForm(emptyForm());
    }
  }, [dlg, chart]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!el.contains(e.target as Node)) return;
      e.preventDefault();
      const cur = scaleRef.current;
      const next = Math.min(2, Math.max(0.4, cur - e.deltaY * 0.001));
      setScale(next);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  const onBgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
  }, [pan.x, pan.y]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (assignDragActiveRef.current) return;
      const d = dragRef.current;
      if (!d?.active) return;
      setPan({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) });
    };
    const up = () => {
      if (dragRef.current) dragRef.current.active = false;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  const handleAssign = useCallback(
    (slotId: string, username: string) => {
      if (!chart) return;
      const base = stripOrgChartForSave(chart);
      const merged = assignUsernameToSlot(base, slotId, username);
      persist(merged);
    },
    [chart, persist],
  );

  const handleClearSlot = useCallback(
    (slotId: string) => {
      if (!chart) return;
      const base = stripOrgChartForSave(chart);
      persist(clearSlotAssignment(base, slotId));
    },
    [chart, persist],
  );

  const handleAssignRosterToSlot = useCallback(
    (slotId: string, rosterEntryId: number) => {
      if (!chart) return;
      const base = stripOrgChartForSave(chart);
      persist(assignRosterEntryToSlot(base, slotId, rosterEntryId));
    },
    [chart, persist],
  );

  const handleAssignDragEnd = useCallback(
    (event: DragEndEvent) => {
      assignDragActiveRef.current = false;
      const { active, over } = event;
      if (!over) return;
      const aid = String(active.id);
      const oid = String(over.id);
      const up = "org-assign-user:";
      const rp = "org-assign-roster:";
      const sp = "org-assign-slot:";
      if (!oid.startsWith(sp)) return;
      const slotId = oid.slice(sp.length);
      if (!slotId) return;
      if (aid.startsWith(up)) {
        const username = aid.slice(up.length);
        if (!username) return;
        handleAssign(slotId, username);
        return;
      }
      if (aid.startsWith(rp)) {
        const rid = Number(aid.slice(rp.length));
        if (!Number.isFinite(rid) || rid <= 0) return;
        handleAssignRosterToSlot(slotId, rid);
      }
    },
    [handleAssign, handleAssignRosterToSlot],
  );

  const applyStruct = useCallback(
    (mut: (d: ReturnType<typeof stripOrgChartForSave>) => ReturnType<typeof stripOrgChartForSave>) => {
      if (!chart) return;
      persist(mut(stripOrgChartForSave(chart)));
    },
    [chart, persist],
  );

  const statsColumn = useMemo(() => {
    if (!chart || !statsColId) return null;
    return chart.columns.find((c) => c.id === statsColId) ?? null;
  }, [chart, statsColId]);

  const isFullyEmpty = useMemo(() => {
    if (!chart) return true;
    const anyHq = chart.hqSections.some((s) => hqSectionHasContent(s));
    return chart.ladder.length === 0 && !anyHq && chart.columns.length === 0;
  }, [chart]);

  const submitDialog = () => {
    if (!chart || !dlg) return;
    const base = stripOrgChartForSave(chart);
    if (dlg.type === "ladder") {
      if (dlg.mode === "add") {
        persist(addLadderStep(base, form.a.trim() || "Unit", form.b.trim()));
      } else if (dlg.id) {
        persist(updateLadderStep(base, dlg.id, form.a.trim() || "Unit", form.b.trim()));
      }
    } else if (dlg.type === "hq-section") {
      if (dlg.mode === "add") {
        persist(addHqSection(base, form.a.trim()));
      } else if (dlg.sectionId) {
        persist(updateHqSectionTitle(base, dlg.sectionId, form.a.trim()));
      }
    } else if (dlg.type === "hq-branch") {
      if (dlg.mode === "add") {
        persist(addHqBranch(base, dlg.sectionId, form.a.trim() || "Branch"));
      } else if (dlg.branchId) {
        persist(updateHqBranchTitle(base, dlg.sectionId, dlg.branchId, form.a.trim()));
      }
    } else if (dlg.type === "hq-slot") {
      if (dlg.mode === "add") {
        persist(
          addHqSlot(
            base,
            dlg.sectionId,
            form.a.trim() || "Billet",
            form.b.trim() || "BIL",
            dlg.branchId,
          ),
        );
      } else if (dlg.id) {
        persist(
          updateSlotFields(base, dlg.id, {
            roleTitle: form.a.trim() || "Billet",
            positionCode: form.b.trim() || "BIL",
            statusLetter: form.c.trim(),
          }),
        );
      }
    } else if (dlg.type === "slot-writein") {
      persist(setSlotWrittenName(base, dlg.slotId, form.a));
    } else if (dlg.type === "column") {
      if (dlg.mode === "add") {
        persist(addColumn(base, form.a.trim() || "Element", form.b.trim()));
      } else if (dlg.id) {
        persist(updateColumnHeaders(base, dlg.id, form.a.trim() || "Element", form.b.trim()));
      }
    } else if (dlg.type === "col-slot") {
      if (dlg.mode === "add") {
        persist(
          addSlotToColumn(base, dlg.columnId, form.a.trim() || "Billet", form.b.trim() || "BIL"),
        );
      } else if (dlg.slotId) {
        persist(
          updateSlotFields(base, dlg.slotId, {
            roleTitle: form.a.trim() || "Billet",
            positionCode: form.b.trim() || "BIL",
            statusLetter: form.c.trim(),
          }),
        );
      }
    }
    setDlg(null);
    setForm(emptyForm());
  };

  const confirmRemoveSlot = () => {
    if (!chart || !removeSlotId) return;
    applyStruct((d) => removeSlotById(d, removeSlotId));
    setRemoveSlotId(null);
  };

  const resetTemplate = () => {
    persist(createBlankOrgChart());
    setResetOpen(false);
  };

  if (isLoading || !chart) {
    return <div className="p-4 tac-page text-xs text-muted-foreground">Loading org chart…</div>;
  }

  return (
    <div className="p-3 md:p-4 tac-page flex flex-col min-h-0 gap-3 h-[calc(100vh-3rem)] max-h-[calc(100vh-2rem)]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 shrink-0">
        <div>
          <h1
            className="text-sm font-bold tracking-[0.15em] text-blue-400 flex items-center gap-2"
            style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
          >
            <Network className="h-4 w-4" /> ORG CHART
          </h1>
          <p className="text-[10px] text-muted-foreground tracking-wider mt-1">
            Build chain rows, multiple HQ blocks with optional branches, and element columns; assign directory users or personnel roster rows, or type a write-in name
          </p>
        </div>
        {canEdit ? (
          <Button
            variant="outline"
            size="sm"
            className="text-[10px] h-8"
            onClick={() => setResetOpen(true)}
            disabled={save.isPending}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear chart
          </Button>
        ) : null}
      </div>

      <SubPageNav items={PERSONNEL_SUB} />

      <div className="flex-1 flex min-h-0 gap-2 border border-border rounded-md bg-black/40 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={() => {
            assignDragActiveRef.current = true;
          }}
          onDragCancel={() => {
            assignDragActiveRef.current = false;
          }}
          onDragEnd={handleAssignDragEnd}
        >
          {canEdit ? (
            <aside className="w-56 shrink-0 border-r border-border bg-card/50 flex flex-col min-h-0">
              <div className="text-[10px] font-bold tracking-wider text-muted-foreground px-2 py-2 border-b border-border flex items-center gap-1">
                <UserPlus className="h-3.5 w-3.5" /> Assign (drag)
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-3 min-h-0">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/80 mb-1">Directory users</div>
                  <div className="space-y-1">
                    {users.map((u) => (
                      <RosterUserDraggable key={u.id} user={u} />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/80 mb-1">
                    Personnel roster
                  </div>
                  <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-0.5">
                    {rosterEntries.length === 0 ? (
                      <div className="text-[9px] text-muted-foreground/70 italic">No roster rows yet</div>
                    ) : (
                      rosterEntries.map((e) => <PersonnelRosterDraggable key={e.id} entry={e} />)
                    )}
                  </div>
                </div>
              </div>
            </aside>
          ) : null}

          <div
            ref={viewportRef}
            className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing select-none"
            onMouseDown={onBgMouseDown}
          >
          <div
            className="absolute left-0 top-0 will-change-transform"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "0 0",
            }}
          >
            <div
              className="inline-flex flex-col items-stretch gap-2 min-w-[min(100%,1100px)] max-w-[1400px] pb-16 px-2"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {canEdit ? (
                <div className="flex flex-wrap gap-1.5 items-center justify-center rounded border border-dashed border-border/60 bg-zinc-950/50 px-2 py-2">
                  <span className="text-[9px] text-muted-foreground mr-1">Structure:</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 text-[10px] gap-1"
                    onClick={() => {
                      setForm(emptyForm());
                      setDlg({ type: "ladder", mode: "add" });
                    }}
                  >
                    <Plus className="h-3 w-3" /> Chain row
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 text-[10px] gap-1"
                    onClick={() => {
                      setForm(emptyForm());
                      setDlg({ type: "hq-section", mode: "add" });
                    }}
                  >
                    <Plus className="h-3 w-3" /> Add HQ block
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 text-[10px] gap-1"
                    onClick={() => {
                      setForm(emptyForm());
                      setDlg({ type: "column", mode: "add" });
                    }}
                  >
                    <Layers className="h-3 w-3" /> Element column
                  </Button>
                </div>
              ) : null}

              {!canEdit && isFullyEmpty ? (
                <div className="text-center text-xs text-muted-foreground py-12 border border-border/40 rounded-md bg-zinc-950/30">
                  Org chart has not been configured yet. An administrator can add structure here.
                </div>
              ) : null}

              <div className="flex flex-col gap-4 w-full">
                {chart.blockOrder.map((token, bidx) => {
                  if (token === "ladder") {
                    if (chart.ladder.length === 0) return null;
                    const lbi = chart.blockOrder.indexOf("ladder");
                    const ladderUp = lbi > 0;
                    const ladderDown = lbi >= 0 && lbi < chart.blockOrder.length - 1;
                    return (
                      <div key={`ladder-${bidx}`} className="w-full">
                        {canEdit ? (
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Chain</span>
                            <button
                              type="button"
                              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                              disabled={!ladderUp}
                              title="Move chain block up"
                              onClick={() => applyStruct((d) => moveBlockOrderToken(d, "ladder", "up"))}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                              disabled={!ladderDown}
                              title="Move chain block down"
                              onClick={() => applyStruct((d) => moveBlockOrderToken(d, "ladder", "down"))}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                        ) : null}
                        <div className="flex flex-col items-center">
                          {chart.ladder.map((step, i) => (
                            <div key={step.id} className="flex flex-col items-center w-full">
                              {i > 0 ? <div className="w-px h-4 bg-border shrink-0" /> : null}
                              <div className="relative rounded border border-border bg-zinc-900/90 px-4 py-2 text-center min-w-[140px] max-w-[280px] w-full">
                                {canEdit ? (
                                  <div className="absolute -right-1 -top-1 flex gap-0.5">
                                    <button
                                      type="button"
                                      className="rounded bg-zinc-800 p-1 text-muted-foreground hover:text-foreground"
                                      title="Edit"
                                      onClick={() => setDlg({ type: "ladder", mode: "edit", id: step.id })}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded bg-zinc-800 p-1 text-muted-foreground hover:text-red-400"
                                      title="Remove"
                                      onClick={() => applyStruct((d) => removeLadderStep(d, step.id))}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : null}
                                <div className="text-xs font-bold tracking-wide">{step.label}</div>
                                <div className="text-[9px] text-muted-foreground tracking-widest">{step.sublabel}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  if (token === "columns") {
                    if (!canEdit && chart.columns.length === 0) return null;
                    const cbi = chart.blockOrder.indexOf("columns");
                    const colUp = cbi > 0;
                    const colDown = cbi >= 0 && cbi < chart.blockOrder.length - 1;
                    return (
                      <div key={`columns-${bidx}`} className="w-full">
                        {canEdit ? (
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Elements</span>
                            <button
                              type="button"
                              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                              disabled={!colUp}
                              title="Move elements block up"
                              onClick={() => applyStruct((d) => moveBlockOrderToken(d, "columns", "up"))}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                              disabled={!colDown}
                              title="Move elements block down"
                              onClick={() => applyStruct((d) => moveBlockOrderToken(d, "columns", "down"))}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                        ) : null}
                        <div className="flex flex-row gap-2 items-start justify-center flex-wrap w-full">
                        {chart.columns.map((col) => {
                          const filled = col.slots.filter((s) => slotHasAssignment(s)).length;
                          return (
                            <div key={col.id} className="w-[148px] shrink-0 flex flex-col border border-border/70 rounded-md bg-zinc-950/60">
                              <div className="border-b border-border/60 bg-zinc-900/50 px-2 py-2">
                                <div className="flex justify-between items-start gap-1">
                                  <button
                                    type="button"
                                    className="text-left flex-1 min-w-0"
                                    onClick={() => setStatsColId(col.id)}
                                  >
                                    <div className="text-[11px] font-bold leading-tight break-words">{col.headerTitle}</div>
                                    <div className="text-[8px] text-muted-foreground tracking-wider">{col.headerSubtitle}</div>
                                    <div className="text-[8px] text-blue-400/80 mt-1">
                                      {filled}/{col.slots.length} filled
                                    </div>
                                  </button>
                                  {canEdit ? (
                                    <div className="flex flex-col gap-0.5 shrink-0">
                                      <button
                                        type="button"
                                        className="p-0.5 text-muted-foreground hover:text-foreground"
                                        title="Edit column"
                                        onClick={() => setDlg({ type: "column", mode: "edit", id: col.id })}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        className="p-0.5 text-muted-foreground hover:text-red-400"
                                        title="Delete column"
                                        onClick={() => {
                                          if (confirm(`Delete element “${col.headerTitle}” and all its billets?`)) {
                                            applyStruct((d) => removeColumn(d, col.id));
                                          }
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                                {canEdit ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="w-full h-7 mt-1 text-[10px]"
                                    onClick={() => {
                                      setForm(emptyForm());
                                      setDlg({ type: "col-slot", columnId: col.id, mode: "add" });
                                    }}
                                  >
                                    <Plus className="h-3 w-3 mr-1" /> Billet
                                  </Button>
                                ) : null}
                              </div>
                              <div className="p-1.5 space-y-1 flex flex-col">
                                {col.slots.length === 0 && canEdit ? (
                                  <div className="text-[9px] text-muted-foreground text-center py-2">No billets</div>
                                ) : (
                                  col.slots.map((s) => (
                                    <SlotCard
                                      key={s.id}
                                      slot={s}
                                      editable={canEdit}
                                      onClear={() => handleClearSlot(s.id)}
                                      onEditBillet={() =>
                                        setDlg({ type: "col-slot", columnId: col.id, mode: "edit", slotId: s.id })
                                      }
                                      onRemoveBillet={() => setRemoveSlotId(s.id)}
                                      onWriteIn={
                                        canEdit ? () => setDlg({ type: "slot-writein", slotId: s.id }) : undefined
                                      }
                                    />
                                  ))
                                )}
                              </div>
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    );
                  }
                  const sec = chart.hqSections.find((s) => s.id === token);
                  if (!sec) return null;
                  if (!canEdit && !hqSectionHasContent(sec)) return null;
                  const bi = chart.blockOrder.indexOf(sec.id);
                  const canMoveUp = bi > 0;
                  const canMoveDown = bi >= 0 && bi < chart.blockOrder.length - 1;
                  const multHq = chart.hqSections.length > 1;
                  const branches = sec.branches ?? [];
                  return (
                    <div key={sec.id} className="rounded border border-zinc-700 bg-zinc-950/90 p-3 w-full">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-0.5 shrink-0 w-[72px] justify-start">
                          {canEdit ? (
                            <>
                              <button
                                type="button"
                                className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                                disabled={!canMoveUp}
                                title="Move block up"
                                onClick={() => applyStruct((d) => moveBlockOrderToken(d, sec.id, "up"))}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                                disabled={!canMoveDown}
                                title="Move block down"
                                onClick={() => applyStruct((d) => moveBlockOrderToken(d, sec.id, "down"))}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </button>
                            </>
                          ) : null}
                        </div>
                        <div className="text-[10px] font-bold tracking-widest text-muted-foreground text-center flex-1 min-w-0 px-1">
                          {sec.title}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 justify-end min-w-[72px] flex-wrap justify-end">
                          {canEdit ? (
                            <>
                              <button
                                type="button"
                                className="p-1 text-muted-foreground hover:text-foreground"
                                title="Rename block"
                                onClick={() => setDlg({ type: "hq-section", mode: "edit", sectionId: sec.id })}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {multHq ? (
                                <button
                                  type="button"
                                  className="p-1 text-muted-foreground hover:text-red-400"
                                  title="Remove HQ block"
                                  onClick={() => {
                                    if (confirm(`Remove “${sec.title}” and all of its billets?`)) {
                                      applyStruct((d) => removeHqSection(d, sec.id));
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] px-2"
                                onClick={() => {
                                  setForm(emptyForm());
                                  setDlg({ type: "hq-branch", mode: "add", sectionId: sec.id });
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Branch
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] px-2"
                                onClick={() => {
                                  setForm(emptyForm());
                                  setDlg({ type: "hq-slot", mode: "add", sectionId: sec.id });
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Billet
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                      {sec.slots.length === 0 && canEdit ? (
                        <div className="text-[10px] text-muted-foreground text-center py-2 border border-dashed border-border/50 rounded">
                          No billets in the main HQ row — add a billet or drag from the left panel
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {sec.slots.map((s) => (
                            <SlotCard
                              key={s.id}
                              slot={s}
                              editable={canEdit}
                              onClear={() => handleClearSlot(s.id)}
                              onEditBillet={() =>
                                setDlg({ type: "hq-slot", mode: "edit", id: s.id, sectionId: sec.id })
                              }
                              onRemoveBillet={() => setRemoveSlotId(s.id)}
                              onWriteIn={
                                canEdit ? () => setDlg({ type: "slot-writein", slotId: s.id }) : undefined
                              }
                            />
                          ))}
                        </div>
                      )}
                      {branches.map((br) => (
                        <div
                          key={br.id}
                          className="mt-3 pt-3 border-t border-amber-900/40 relative pl-3 before:absolute before:left-0 before:top-2 before:bottom-0 before:w-px before:bg-amber-800/50"
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="text-[10px] font-bold tracking-wider text-amber-200/90 min-w-0 break-words">
                              {br.title}
                            </div>
                            {canEdit ? (
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  className="p-1 text-muted-foreground hover:text-foreground"
                                  title="Rename branch"
                                  onClick={() =>
                                    setDlg({
                                      type: "hq-branch",
                                      mode: "edit",
                                      sectionId: sec.id,
                                      branchId: br.id,
                                    })
                                  }
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  className="p-1 text-muted-foreground hover:text-red-400"
                                  title="Remove branch and its billets"
                                  onClick={() => {
                                    if (confirm(`Remove branch “${br.title}” and all of its billets?`)) {
                                      applyStruct((d) => removeHqBranch(d, sec.id, br.id));
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-[10px] px-2"
                                  onClick={() => {
                                    setForm(emptyForm());
                                    setDlg({
                                      type: "hq-slot",
                                      mode: "add",
                                      sectionId: sec.id,
                                      branchId: br.id,
                                    });
                                  }}
                                >
                                  <Plus className="h-3 w-3 mr-1" /> Billet
                                </Button>
                              </div>
                            ) : null}
                          </div>
                          {br.slots.length === 0 && canEdit ? (
                            <div className="text-[10px] text-muted-foreground text-center py-2 border border-dashed border-border/40 rounded">
                              No billets in this branch
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {br.slots.map((s) => (
                                <SlotCard
                                  key={s.id}
                                  slot={s}
                                  editable={canEdit}
                                  onClear={() => handleClearSlot(s.id)}
                                  onEditBillet={() =>
                                    setDlg({
                                      type: "hq-slot",
                                      mode: "edit",
                                      id: s.id,
                                      sectionId: sec.id,
                                      branchId: br.id,
                                    })
                                  }
                                  onRemoveBillet={() => setRemoveSlotId(s.id)}
                                  onWriteIn={
                                    canEdit ? () => setDlg({ type: "slot-writein", slotId: s.id }) : undefined
                                  }
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 py-2 px-3 bg-background/90 border-t border-border text-[9px] text-muted-foreground pointer-events-none">
            <GripHorizontal className="h-3.5 w-3.5 opacity-60" />
            Drag to pan · Scroll to zoom · Click element header for stats
            {canEdit
              ? " · Drag directory or personnel roster onto billets · Structure buttons add HQ blocks and branches"
              : ""}
          </div>
        </div>
        </DndContext>
      </div>

      <Dialog
        open={dlg !== null}
        onOpenChange={(o) => {
          if (!o) setDlg(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-widest">
              {dlg?.type === "ladder" && (dlg.mode === "add" ? "Add chain of command row" : "Edit row")}
              {dlg?.type === "hq-section" &&
                (dlg.mode === "add" ? "Add HQ block" : "Rename HQ block")}
              {dlg?.type === "hq-branch" &&
                (dlg.mode === "add" ? "Add HQ branch" : "Rename HQ branch")}
              {dlg?.type === "hq-slot" && (dlg.mode === "add" ? "Add HQ billet" : "Edit HQ billet")}
              {dlg?.type === "column" && (dlg.mode === "add" ? "Add element column" : "Edit element column")}
              {dlg?.type === "col-slot" && (dlg.mode === "add" ? "Add billet" : "Edit billet")}
              {dlg?.type === "slot-writein" && "Write-in assignee"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {dlg?.type === "ladder"
                ? "Primary line (e.g. echelon name and type)."
                : dlg?.type === "column"
                  ? "Title shown on the column header."
                  : dlg?.type === "hq-section"
                    ? "Shown as the header for this HQ block."
                    : dlg?.type === "hq-branch"
                      ? "A sub-group under this HQ block (e.g. cell, team, shop)."
                      : dlg?.type === "slot-writein"
                        ? "Shown on the billet when no directory user or roster row is linked."
                        : "Role label and position code for this billet."}
            </DialogDescription>
          </DialogHeader>
          {dlg?.type === "ladder" ? (
            <div className="space-y-2">
              <div>
                <Label className="text-[10px]">Label</Label>
                <Input
                  className="text-xs h-9"
                  value={form.a}
                  onChange={(e) => setForm((f) => ({ ...f, a: e.target.value }))}
                  placeholder="e.g. 3-OSG"
                />
              </div>
              <div>
                <Label className="text-[10px]">Subtitle</Label>
                <Input
                  className="text-xs h-9"
                  value={form.b}
                  onChange={(e) => setForm((f) => ({ ...f, b: e.target.value }))}
                  placeholder="e.g. SQUADRON"
                />
              </div>
            </div>
          ) : null}
          {dlg?.type === "column" ? (
            <div className="space-y-2">
              <div>
                <Label className="text-[10px]">Element title</Label>
                <Input
                  className="text-xs h-9"
                  value={form.a}
                  onChange={(e) => setForm((f) => ({ ...f, a: e.target.value }))}
                  placeholder="e.g. India"
                />
              </div>
              <div>
                <Label className="text-[10px]">Subtitle</Label>
                <Input
                  className="text-xs h-9"
                  value={form.b}
                  onChange={(e) => setForm((f) => ({ ...f, b: e.target.value }))}
                  placeholder="e.g. ELEMENT"
                />
              </div>
            </div>
          ) : null}
          {dlg?.type === "hq-section" ? (
            <div className="space-y-2">
              <div>
                <Label className="text-[10px]">Block title</Label>
                <Input
                  className="text-xs h-9"
                  value={form.a}
                  onChange={(e) => setForm((f) => ({ ...f, a: e.target.value }))}
                  placeholder="e.g. HQ, S-shop, Staff"
                />
              </div>
            </div>
          ) : null}
          {dlg?.type === "hq-branch" ? (
            <div className="space-y-2">
              <div>
                <Label className="text-[10px]">Branch title</Label>
                <Input
                  className="text-xs h-9"
                  value={form.a}
                  onChange={(e) => setForm((f) => ({ ...f, a: e.target.value }))}
                  placeholder="e.g. Cell A, Plans shop"
                />
              </div>
            </div>
          ) : null}
          {dlg?.type === "slot-writein" ? (
            <div className="space-y-2">
              <div>
                <Label className="text-[10px]">Name as written</Label>
                <Input
                  className="text-xs h-9"
                  value={form.a}
                  onChange={(e) => setForm((f) => ({ ...f, a: e.target.value }))}
                  placeholder="e.g. Capt Smith (external)"
                />
              </div>
            </div>
          ) : null}
          {(dlg?.type === "hq-slot" || dlg?.type === "col-slot") && (
            <div className="space-y-2">
              <div>
                <Label className="text-[10px]">Role / billet title</Label>
                <Input
                  className="text-xs h-9"
                  value={form.a}
                  onChange={(e) => setForm((f) => ({ ...f, a: e.target.value }))}
                  placeholder="e.g. Team Leader"
                />
              </div>
              <div>
                <Label className="text-[10px]">Position code</Label>
                <Input
                  className="text-xs h-9"
                  value={form.b}
                  onChange={(e) => setForm((f) => ({ ...f, b: e.target.value }))}
                  placeholder="e.g. TI1"
                />
              </div>
              <div>
                <Label className="text-[10px]">Status letter (optional)</Label>
                <Input
                  className="text-xs h-9 max-w-[4rem]"
                  value={form.c}
                  onChange={(e) => setForm((f) => ({ ...f, c: e.target.value }))}
                  placeholder="—"
                  maxLength={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDlg(null)}>
              Cancel
            </Button>
            <Button size="sm" className="text-xs" onClick={submitDialog}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statsColId} onOpenChange={(o) => !o && setStatsColId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-widest">
              {statsColumn?.headerTitle ?? "—"} · {statsColumn?.headerSubtitle ?? ""}
            </DialogTitle>
            <DialogDescription className="text-xs">Manning summary for this element.</DialogDescription>
          </DialogHeader>
          {statsColumn ? (
            <div className="text-xs space-y-2">
              <div>
                Filled:{" "}
                <span className="font-mono text-foreground">
                  {statsColumn.slots.filter((s) => slotHasAssignment(s)).length}
                </span>{" "}
                / {statsColumn.slots.length}
              </div>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                {statsColumn.slots
                  .filter((s) => slotHasAssignment(s))
                  .map((s) => (
                    <li key={s.id}>
                      <span className="text-foreground">{s.displayLine || s.assignedUsername}</span>{" "}
                      <span className="font-mono text-[10px]">[{s.positionCode}]</span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear entire org chart?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes all chain-of-command rows, HQ billets, elements, billets, and assignments. The board will be blank until you add structure again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={resetTemplate}>Clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeSlotId} onOpenChange={(o) => !o && setRemoveSlotId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this billet?</AlertDialogTitle>
            <AlertDialogDescription>Assignment data for this slot will be removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveSlot}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
