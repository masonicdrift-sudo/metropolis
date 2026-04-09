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
  addHqSlot,
  addLadderStep,
  addSlotToColumn,
  assignUsernameToSlot,
  createBlankOrgChart,
  removeColumn,
  removeLadderStep,
  removeSlotById,
  stripOrgChartForSave,
  updateColumnHeaders,
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
import {
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
const slotDropId = (slotId: string) => `org-assign-slot:${slotId}`;

function SlotCard({
  slot,
  editable,
  onClear,
  onEditBillet,
  onRemoveBillet,
}: {
  slot: OrgSlotView;
  editable: boolean;
  onClear: () => void;
  onEditBillet: () => void;
  onRemoveBillet: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: slotDropId(slot.id),
    disabled: !editable,
  });
  const filled = !!(slot.assignedUsername || "").trim();
  const line = filled ? slot.displayLine || slot.assignedUsername : "";

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
          <div
            className={cn(
              "text-[11px] font-semibold mt-0.5 leading-tight break-words",
              !filled && "text-muted-foreground/45 font-normal italic",
            )}
          >
            {filled ? line : "Empty"}
          </div>
          {slot.statusLetter ? (
            <div className="text-[9px] text-muted-foreground mt-0.5">{slot.statusLetter}</div>
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

  /** Dialog: ladder | hq-slot | column | col-slot */
  const [dlg, setDlg] = useState<
    | null
    | { type: "ladder"; mode: "add" | "edit"; id?: string }
    | { type: "hq-slot"; mode: "add" | "edit"; id?: string }
    | { type: "column"; mode: "add" | "edit"; id?: string }
    | { type: "col-slot"; columnId: string; mode: "add" | "edit"; slotId?: string }
  >(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (!chart || !dlg) return;
    if (dlg.mode === "add") return;
    if (dlg.type === "ladder" && dlg.mode === "edit" && dlg.id) {
      const s = chart.ladder.find((x) => x.id === dlg.id);
      if (s) setForm({ a: s.label, b: s.sublabel, c: "" });
    } else if (dlg.type === "hq-slot" && dlg.mode === "edit" && dlg.id) {
      const s = chart.hq.slots.find((x) => x.id === dlg.id);
      if (s) setForm({ a: s.roleTitle, b: s.positionCode, c: s.statusLetter || "" });
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

  const handleAssignDragEnd = useCallback(
    (event: DragEndEvent) => {
      assignDragActiveRef.current = false;
      const { active, over } = event;
      if (!over) return;
      const aid = String(active.id);
      const oid = String(over.id);
      const up = "org-assign-user:";
      const sp = "org-assign-slot:";
      if (!aid.startsWith(up) || !oid.startsWith(sp)) return;
      const username = aid.slice(up.length);
      const slotId = oid.slice(sp.length);
      if (!username || !slotId) return;
      handleAssign(slotId, username);
    },
    [handleAssign],
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
    return (
      chart.ladder.length === 0 &&
      chart.hq.slots.length === 0 &&
      chart.columns.length === 0
    );
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
    } else if (dlg.type === "hq-slot") {
      if (dlg.mode === "add") {
        persist(addHqSlot(base, form.a.trim() || "Billet", form.b.trim() || "BIL"));
      } else if (dlg.id) {
        persist(
          updateSlotFields(base, dlg.id, {
            roleTitle: form.a.trim() || "Billet",
            positionCode: form.b.trim() || "BIL",
            statusLetter: form.c.trim(),
          }),
        );
      }
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
            Blank canvas — admins build structure, then assign personnel by drag-and-drop
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
            <aside className="w-52 shrink-0 border-r border-border bg-card/50 flex flex-col">
              <div className="text-[10px] font-bold tracking-wider text-muted-foreground px-2 py-2 border-b border-border flex items-center gap-1">
                <UserPlus className="h-3.5 w-3.5" /> Roster (drag)
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {users.map((u) => (
                  <RosterUserDraggable key={u.id} user={u} />
                ))}
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
                      setDlg({ type: "hq-slot", mode: "add" });
                    }}
                  >
                    <Plus className="h-3 w-3" /> HQ billet
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

              {/* Ladder */}
              {chart.ladder.length > 0 ? (
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
              ) : null}

              {chart.ladder.length > 0 && (chart.hq.slots.length > 0 || chart.columns.length > 0) ? (
                <div className="w-px h-5 bg-border mx-auto shrink-0" />
              ) : null}

              {/* HQ */}
              {(chart.hq.slots.length > 0 || canEdit) && !(isFullyEmpty && !canEdit) ? (
                <div className="rounded border border-zinc-700 bg-zinc-950/90 p-3 w-full">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-[10px] font-bold tracking-widest text-muted-foreground text-center flex-1">
                      HQ
                    </div>
                    {canEdit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px]"
                        onClick={() => {
                          setForm(emptyForm());
                          setDlg({ type: "hq-slot", mode: "add" });
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Billet
                      </Button>
                    ) : null}
                  </div>
                  {chart.hq.slots.length === 0 && canEdit ? (
                    <div className="text-[10px] text-muted-foreground text-center py-4">No HQ billets — use &quot;HQ billet&quot; above</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {chart.hq.slots.map((s) => (
                        <SlotCard
                          key={s.id}
                          slot={s}
                          editable={canEdit}
                          onClear={() => handleAssign(s.id, "")}
                          onEditBillet={() => setDlg({ type: "hq-slot", mode: "edit", id: s.id })}
                          onRemoveBillet={() => setRemoveSlotId(s.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {(chart.hq.slots.length > 0 || chart.columns.length > 0) && chart.columns.length > 0 ? (
                <div className="w-px h-4 bg-border mx-auto shrink-0" />
              ) : null}

              {/* Columns */}
              <div className="flex flex-row gap-2 items-start justify-center flex-wrap">
                {chart.columns.map((col) => {
                  const filled = col.slots.filter((s) => (s.assignedUsername || "").trim()).length;
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
                              onClear={() => handleAssign(s.id, "")}
                              onEditBillet={() =>
                                setDlg({ type: "col-slot", columnId: col.id, mode: "edit", slotId: s.id })
                              }
                              onRemoveBillet={() => setRemoveSlotId(s.id)}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 py-2 px-3 bg-background/90 border-t border-border text-[9px] text-muted-foreground pointer-events-none">
            <GripHorizontal className="h-3.5 w-3.5 opacity-60" />
            Drag to pan · Scroll to zoom · Click element header for stats
            {canEdit ? " · Drag roster into billets · Use Structure buttons to build the chart" : ""}
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
              {dlg?.type === "hq-slot" && (dlg.mode === "add" ? "Add HQ billet" : "Edit HQ billet")}
              {dlg?.type === "column" && (dlg.mode === "add" ? "Add element column" : "Edit element column")}
              {dlg?.type === "col-slot" && (dlg.mode === "add" ? "Add billet" : "Edit billet")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {dlg?.type === "ladder"
                ? "Primary line (e.g. echelon name and type)."
                : dlg?.type === "column"
                  ? "Title shown on the column header."
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
                  {statsColumn.slots.filter((s) => (s.assignedUsername || "").trim()).length}
                </span>{" "}
                / {statsColumn.slots.length}
              </div>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                {statsColumn.slots
                  .filter((s) => (s.assignedUsername || "").trim())
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
