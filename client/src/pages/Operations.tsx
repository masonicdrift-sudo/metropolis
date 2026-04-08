import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { EntityLink, Operation, InsertOperation } from "@shared/schema";
import { useState } from "react";
import { Plus, Crosshair, Trash2, Edit, ChevronDown, Link2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const STATUS_FLOW: Record<string, string> = {
  planning: "active", active: "complete", complete: "complete", aborted: "aborted",
};

function OpForm({ op, onClose }: { op?: Operation; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const now = new Date().toISOString();
  const [linkDraft, setLinkDraft] = useState({ bType: "intel", bId: "", relation: "related", note: "" });
  const [form, setForm] = useState<Partial<InsertOperation>>(op ? {
    name: op.name, type: op.type, priority: op.priority, status: op.status,
    objective: op.objective, grid: op.grid, startTime: op.startTime,
    endTime: op.endTime || "", notes: op.notes || "",
  } : { type: "recon", priority: "medium", status: "planning", startTime: now, endTime: "", notes: "", assignedUnits: "[]" });

  const create = useMutation({
    mutationFn: (data: InsertOperation) => apiRequest("POST", "/api/operations", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/operations"] }); toast({ title: "Operation created" }); onClose(); },
  });
  const update = useMutation({
    mutationFn: (data: Partial<InsertOperation>) => apiRequest("PATCH", `/api/operations/${op?.id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/operations"] }); toast({ title: "Operation updated" }); onClose(); },
  });

  const submit = () => {
    if (!form.name || !form.objective || !form.grid) { toast({ title: "Fill all required fields", variant: "destructive" }); return; }
    if (op) update.mutate(form);
    else create.mutate(form as InsertOperation);
  };

  const set = (k: keyof InsertOperation) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const { data: links = [] } = useQuery<EntityLink[]>({
    queryKey: ["/api/entity-links", "operations", op?.id],
    queryFn: () => apiRequest("GET", `/api/entity-links?type=operations&id=${encodeURIComponent(String(op!.id))}`),
    enabled: !!user && !!op,
  });

  const createLink = useMutation({
    mutationFn: (body: { bType: string; bId: string; relation: string; note: string }) =>
      apiRequest("POST", "/api/entity-links", {
        aType: "operations",
        aId: String(op!.id),
        bType: body.bType,
        bId: body.bId,
        relation: body.relation,
        note: body.note,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/entity-links", "operations", op?.id] }),
  });

  const deleteLink = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/entity-links/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/entity-links", "operations", op?.id] }),
  });

  const canDeleteLink = (l: EntityLink) =>
    !!user && (l.createdBy === user.username || user.accessLevel === "admin" || user.accessLevel === "owner");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-2"><Label className="text-[10px] tracking-wider">OP NAME *</Label>
          <Input placeholder="OP IRON VEIL" value={form.name || ""} onChange={e => set("name")(e.target.value)} className="font-mono text-xs uppercase" data-testid="input-op-name" /></div>
        <div><Label className="text-[10px] tracking-wider">TYPE</Label>
          <Select value={form.type} onValueChange={set("type")}>
            <SelectTrigger className="text-xs" data-testid="select-op-type"><SelectValue /></SelectTrigger>
            <SelectContent>{["recon","strike","logistics","MEDEVAC","ISR"].map(t => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}</SelectContent>
          </Select></div>
        <div><Label className="text-[10px] tracking-wider">PRIORITY</Label>
          <Select value={form.priority} onValueChange={set("priority")}>
            <SelectTrigger className="text-xs" data-testid="select-op-priority"><SelectValue /></SelectTrigger>
            <SelectContent>{["critical","high","medium","low"].map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}</SelectContent>
          </Select></div>
        <div><Label className="text-[10px] tracking-wider">STATUS</Label>
          <Select value={form.status} onValueChange={set("status")}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{["planning","active","complete","aborted"].map(s => <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>)}</SelectContent>
          </Select></div>
        <div><Label className="text-[10px] tracking-wider">GRID *</Label>
          <Input placeholder="38T LP 1234 5678" value={form.grid || ""} onChange={e => set("grid")(e.target.value)} className="font-mono text-xs" /></div>
        <div className="col-span-2"><Label className="text-[10px] tracking-wider">OBJECTIVE *</Label>
          <Textarea placeholder="Mission objective..." value={form.objective || ""} onChange={e => set("objective")(e.target.value)} className="text-xs h-16" /></div>
        <div className="col-span-2"><Label className="text-[10px] tracking-wider">NOTES</Label>
          <Textarea placeholder="Additional notes..." value={form.notes || ""} onChange={e => set("notes")(e.target.value)} className="text-xs h-14" /></div>
      </div>

      {op && (
        <div className="border-t border-border/60 pt-2">
          <div className="text-[9px] font-bold tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
            <Link2 size={9} /> LINKS
          </div>
          <div className="space-y-1.5">
            {links.length === 0 ? (
              <div className="text-[9px] text-muted-foreground/60">No links yet.</div>
            ) : (
              links.map((l) => (
                <div key={l.id} className="flex items-center gap-2 text-[10px] border border-border/60 rounded p-2 bg-background/50">
                  <div className="flex-1 min-w-0 font-mono text-[9px] truncate">
                    {l.aType}:{l.aId} ↔ {l.bType}:{l.bId} · {l.relation}
                  </div>
                  {canDeleteLink(l) ? (
                    <button
                      type="button"
                      className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-muted-foreground hover:text-red-400 touch-manipulation rounded-md hover:bg-red-950/20"
                      title="Remove link"
                      onClick={() => deleteLink.mutate(l.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ))
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <Input
                className="h-8 text-[10px] font-mono"
                placeholder="bType (e.g. intel)"
                value={linkDraft.bType}
                onChange={(e) => setLinkDraft((d) => ({ ...d, bType: e.target.value }))}
              />
              <Input
                className="h-8 text-[10px] font-mono"
                placeholder="bId"
                value={linkDraft.bId}
                onChange={(e) => setLinkDraft((d) => ({ ...d, bId: e.target.value }))}
              />
              <Input
                className="h-8 text-[10px] font-mono"
                placeholder="relation"
                value={linkDraft.relation}
                onChange={(e) => setLinkDraft((d) => ({ ...d, relation: e.target.value }))}
              />
              <Button
                size="sm"
                className="h-8 text-[10px] bg-green-800 hover:bg-green-700 tracking-wider"
                onClick={() => {
                  const bt = linkDraft.bType.trim();
                  const bi = linkDraft.bId.trim();
                  if (!bt || !bi) return;
                  createLink.mutate({ bType: bt, bId: bi, relation: linkDraft.relation.trim() || "related", note: linkDraft.note.trim() });
                }}
                disabled={!linkDraft.bType.trim() || !linkDraft.bId.trim() || createLink.isPending}
              >
                ADD LINK
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" size="sm" onClick={onClose} className="text-xs">CANCEL</Button>
        <Button size="sm" onClick={submit} className="text-xs bg-green-800 hover:bg-green-700" data-testid="button-submit-op">{op ? "UPDATE" : "CREATE"} OP</Button>
      </div>
    </div>
  );
}

export default function Operations() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editOp, setEditOp] = useState<Operation | undefined>();
  const [filter, setFilter] = useState("all");

  const { data: ops = [], isLoading } = useQuery<Operation[]>({ queryKey: ["/api/operations"], queryFn: () => apiRequest("GET", "/api/operations") });

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => apiRequest("PATCH", `/api/operations/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/operations"] }),
  });
  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/operations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/operations"] }); toast({ title: "Operation removed" }); },
  });

  const filtered = filter === "all" ? ops : ops.filter(o => o.status === filter);
  const statusCounts = { all: ops.length, planning: 0, active: 0, complete: 0, aborted: 0 };
  ops.forEach(o => { if (o.status in statusCounts) (statusCounts as any)[o.status]++; });

  const priorityBg: Record<string, string> = { critical: "border-l-2 border-l-red-600", high: "border-l-2 border-l-orange-600", medium: "border-l-2 border-l-yellow-600", low: "border-l-2 border-l-green-800" };

  return (
    <div className="p-3 md:p-4 tac-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>OPERATIONS PLANNING</h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">{ops.filter(o => o.status === "active").length} ACTIVE // {ops.filter(o => o.status === "planning").length} IN PLANNING</div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-green-800 hover:bg-green-700 text-xs tracking-wider gap-1" data-testid="button-new-op">
              <Plus size={12} /> NEW OPERATION
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="text-sm tracking-widest">CREATE OPERATION</DialogTitle></DialogHeader>
            <OpForm onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter tabs */}
      <div className="tac-filter-row mb-3">
        {Object.entries(statusCounts).map(([s, c]) => (
          <button key={s} onClick={() => setFilter(s)} data-testid={`filter-${s}`}
            className={`px-3 py-1 rounded text-[10px] tracking-wider font-bold uppercase transition-all ${filter === s ? "bg-green-900 text-green-400 border border-green-800" : "text-muted-foreground hover:text-foreground bg-secondary"}`}>
            {s} ({c})
          </button>
        ))}
      </div>

      {/* Ops table */}
      <div className="bg-card border border-border rounded">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground tracking-wider">LOADING OPERATIONS...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">NO OPERATIONS IN QUEUE</div>
        ) : (
          <table className="w-full text-xs mobile-card-table">
            <thead>
              <tr className="border-b border-border text-[10px] text-muted-foreground tracking-[0.12em]">
                <th className="text-left px-3 py-2">OP NAME</th>
                <th className="text-left px-3 py-2">TYPE</th>
                <th className="text-left px-3 py-2">STATUS</th>
                <th className="text-left px-3 py-2">PRIORITY</th>
                <th className="text-left px-3 py-2">GRID</th>
                <th className="text-left px-3 py-2">OBJECTIVE</th>
                <th className="text-left px-3 py-2">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(op => (
                <tr key={op.id} className={`hover:bg-secondary/20 transition-colors ${priorityBg[op.priority] || ""}`} data-testid={`op-row-${op.id}`}>
                  <td className="px-3 py-2 font-bold tracking-wider" data-label="OP NAME">{op.name}</td>
                  <td className="px-3 py-2" data-label="TYPE"><span className="text-[10px] text-muted-foreground uppercase">{op.type}</span></td>
                  <td className="px-3 py-2" data-label="STATUS"><span className={`badge-${op.status} text-[9px] px-2 py-0.5 rounded font-bold tracking-wider uppercase`}>{op.status}</span></td>
                  <td className="px-3 py-2" data-label="PRIORITY"><span className={`badge-${op.priority} text-[9px] px-2 py-0.5 rounded tracking-wider uppercase`}>{op.priority}</span></td>
                  <td className="px-3 py-2 grid-coord" data-label="GRID">{op.grid}</td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate" data-label="OBJECTIVE">{op.objective}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {op.status === "planning" && (
                        <button onClick={() => advance.mutate({ id: op.id, status: "active" })}
                          className="text-[9px] px-2 py-0.5 bg-green-900/50 text-green-400 rounded border border-green-800/50 hover:bg-green-800/60 tracking-wider">ACTIVATE</button>
                      )}
                      {op.status === "active" && (
                        <button onClick={() => advance.mutate({ id: op.id, status: "complete" })}
                          className="text-[9px] px-2 py-0.5 bg-blue-900/50 text-blue-400 rounded border border-blue-800/50 hover:bg-blue-800/60 tracking-wider">COMPLETE</button>
                      )}
                      <button onClick={() => { setEditOp(op); setOpen(true); }}
                        className="p-1 text-muted-foreground hover:text-foreground rounded" data-testid={`edit-op-${op.id}`}><Edit size={11} /></button>
                      <button onClick={() => del.mutate(op.id)}
                        className="p-1 text-muted-foreground hover:text-red-400 rounded" data-testid={`delete-op-${op.id}`}><Trash2 size={11} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editOp && (
        <Dialog open={!!editOp} onOpenChange={v => !v && setEditOp(undefined)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="text-sm tracking-widest">EDIT: {editOp.name}</DialogTitle></DialogHeader>
            <OpForm op={editOp} onClose={() => setEditOp(undefined)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
