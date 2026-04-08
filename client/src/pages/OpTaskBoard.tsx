import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { OpTask, Operation } from "@shared/schema";
import { useState } from "react";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const PHASES = ["PREP", "INFIL", "ACTION", "EXFIL", "CONSOLIDATE"] as const;
const PHASE_COLOR: Record<string, string> = {
  PREP: "border-blue-800 bg-blue-950/30",
  INFIL: "border-yellow-800 bg-yellow-950/30",
  ACTION: "border-red-800 bg-red-950/30",
  EXFIL: "border-orange-800 bg-orange-950/30",
  CONSOLIDATE: "border-blue-800 bg-blue-950/30",
};
const PHASE_HEADER: Record<string, string> = {
  PREP: "text-blue-400", INFIL: "text-yellow-400", ACTION: "text-red-400",
  EXFIL: "text-orange-400", CONSOLIDATE: "text-blue-400",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "text-muted-foreground", in_progress: "text-yellow-400", complete: "text-blue-400",
};

function TaskForm({ opId, onClose }: { opId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ title: "", phase: "PREP", assignedTo: "", status: "pending", notes: "" });

  const create = useMutation({
    mutationFn: (d: any) => apiRequest("POST", `/api/operations/${opId}/tasks`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/tasks", opId] }); toast({ title: "Task added" }); onClose(); },
  });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[10px] tracking-wider">TASK TITLE *</Label>
        <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief task description" className="text-xs" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] tracking-wider">PHASE</Label>
          <Select value={form.phase} onValueChange={v => setForm(f => ({ ...f, phase: v }))}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{PHASES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] tracking-wider">STATUS</Label>
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">PENDING</SelectItem>
              <SelectItem value="in_progress">IN PROGRESS</SelectItem>
              <SelectItem value="complete">COMPLETE</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label className="text-[10px] tracking-wider">ASSIGNED TO (UNIT / OPERATOR)</Label>
          <Input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="ALPHA-1 / username" className="text-xs" />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px] tracking-wider">NOTES</Label>
          <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="text-xs h-14" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>CANCEL</Button>
        <Button size="sm" className="text-xs bg-blue-800 hover:bg-blue-700"
          onClick={() => { if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; } create.mutate(form); }}
          disabled={create.isPending}>ADD TASK</Button>
      </div>
    </div>
  );
}

function TaskCard({ task, canAdmin }: { task: OpTask; canAdmin: boolean }) {
  const qc = useQueryClient();
  const [statusOpen, setStatusOpen] = useState(false);

  const updateStatus = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/tasks/${task.id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/tasks", task.operationId] }),
  });
  const del = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/tasks/${task.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/tasks", task.operationId] }),
  });

  const statusCfg = STATUS_COLOR[task.status] || "text-muted-foreground";

  return (
    <div className="bg-card border border-border rounded p-2 mb-1.5 hover:border-blue-900/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold leading-tight">{task.title}</div>
          {task.assignedTo && <div className="text-[10px] text-muted-foreground mt-0.5">→ {task.assignedTo}</div>}
          {task.notes && <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{task.notes}</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <button onClick={() => setStatusOpen(o => !o)}
              className={`text-[9px] font-bold tracking-wider flex items-center gap-0.5 ${statusCfg}`}>
              {task.status.replace("_", " ").toUpperCase()}<ChevronDown size={8} />
            </button>
            {statusOpen && (
              <div className="absolute right-0 top-full mt-0.5 tac-menu bg-card border border-border rounded shadow-xl min-w-[110px] overflow-hidden">
                {["pending", "in_progress", "complete"].map(s => (
                  <button key={s} onClick={() => { updateStatus.mutate(s); setStatusOpen(false); }}
                    className={`w-full text-left px-2 py-1.5 text-[10px] tracking-wider hover:bg-secondary transition-colors ${s === task.status ? "text-blue-400 font-bold" : "text-muted-foreground"}`}>
                    {s.replace("_", " ").toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
          {canAdmin && (
            <button onClick={() => del.mutate()} className="p-0.5 text-muted-foreground hover:text-red-400 ml-1">
              <Trash2 size={10} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OpTaskBoard() {
  const { user } = useAuth();
  const canAdmin = user?.accessLevel === "admin" || user?.accessLevel === "owner";
  const [selectedOp, setSelectedOp] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: ops = [] } = useQuery<Operation[]>({
    queryKey: ["/api/operations"],
    queryFn: () => apiRequest("GET", "/api/operations"),
  });

  const { data: tasks = [] } = useQuery<OpTask[]>({
    queryKey: ["/api/tasks", selectedOp],
    queryFn: () => apiRequest("GET", `/api/operations/${selectedOp}/tasks`),
    enabled: !!selectedOp,
  });

  const activeOps = ops.filter(o => o.status !== "complete" && o.status !== "aborted");
  const op = ops.find(o => o.id === selectedOp);

  const phaseTasks = (phase: string) => tasks.filter(t => t.phase === phase);
  const done = tasks.filter(t => t.status === "complete").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <div className="p-3 md:p-4 tac-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>OP-ORDER TASK BOARD</h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">SELECT AN OPERATION TO VIEW PHASES</div>
        </div>
        {selectedOp && (
          <Button size="sm" className="bg-blue-800 hover:bg-blue-700 text-xs tracking-wider gap-1" onClick={() => setAddOpen(true)}>
            <Plus size={12} /> ADD TASK
          </Button>
        )}
      </div>

      {/* Op selector */}
      <div className="mb-4">
        <Label className="text-[10px] tracking-wider">SELECT OPERATION</Label>
        <Select value={selectedOp ? String(selectedOp) : ""} onValueChange={v => setSelectedOp(Number(v))}>
          <SelectTrigger className="text-xs w-full max-w-full sm:max-w-sm"><SelectValue placeholder="— Choose an operation —" /></SelectTrigger>
          <SelectContent>
            {ops.map(o => (
              <SelectItem key={o.id} value={String(o.id)}>
                {o.name} — {o.status.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedOp && (
        <div className="bg-card border border-border rounded p-8 text-center text-muted-foreground text-xs">
          SELECT AN OPERATION ABOVE TO VIEW OR MANAGE ITS TASK BOARD
        </div>
      )}

      {selectedOp && op && (
        <>
          {/* Progress bar */}
          <div className="bg-card border border-border rounded px-3 py-2 mb-4 flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[10px] text-muted-foreground tracking-wider mb-1">OP PROGRESS — {op.name}</div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="kpi-value text-lg text-blue-400">{pct}%</div>
              <div className="text-[9px] text-muted-foreground">{done}/{tasks.length} TASKS</div>
            </div>
          </div>

          {/* Kanban columns — horizontal scroll on mobile, grid on desktop */}
          <div className="flex xl:grid xl:grid-cols-5 gap-2 overflow-x-auto pb-2 xl:overflow-visible"
            style={{ scrollSnapType: 'x mandatory' }}>
            {PHASES.map(phase => (
              <div key={phase} className={`rounded border ${PHASE_COLOR[phase]} p-2 shrink-0 w-[min(85vw,220px)] xl:w-auto`}
                style={{ scrollSnapAlign: 'start' }}>
                <div className={`text-[10px] font-bold tracking-widest mb-2 ${PHASE_HEADER[phase]}`}>
                  {phase} <span className="text-muted-foreground font-normal">({phaseTasks(phase).length})</span>
                </div>
                {phaseTasks(phase).map(t => (
                  <TaskCard key={t.id} task={t} canAdmin={canAdmin} />
                ))}
                {phaseTasks(phase).length === 0 && (
                  <div className="text-[10px] text-muted-foreground/50 text-center py-3">NO TASKS</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {selectedOp && addOpen && (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="text-sm tracking-widest">ADD TASK — {op?.name}</DialogTitle></DialogHeader>
            <TaskForm opId={selectedOp} onClose={() => setAddOpen(false)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
