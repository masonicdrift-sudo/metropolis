import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { Unit, InsertUnit } from "@shared/schema";
import { useState } from "react";
import { Plus, Users, Trash2, Edit, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

function UnitForm({ unit, onClose }: { unit?: Unit; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<InsertUnit>>(unit ? {
    callsign: unit.callsign, type: unit.type, status: unit.status,
    grid: unit.grid, commander: unit.commander, pax: unit.pax, notes: unit.notes || "",
  } : { type: "infantry", status: "active", pax: 0, notes: "" });

  const create = useMutation({
    mutationFn: (d: InsertUnit) => apiRequest("POST", "/api/units", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/units"] }); toast({ title: "Unit added" }); onClose(); },
  });
  const update = useMutation({
    mutationFn: (d: Partial<InsertUnit>) => apiRequest("PATCH", `/api/units/${unit?.id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/units"] }); toast({ title: "Unit updated" }); onClose(); },
  });

  const set = (k: keyof InsertUnit) => (v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.callsign || !form.commander || !form.grid) { toast({ title: "Fill required fields", variant: "destructive" }); return; }
    if (unit) update.mutate(form);
    else create.mutate(form as InsertUnit);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label className="text-[10px] tracking-wider">CALLSIGN *</Label>
          <Input placeholder="ALPHA-1" value={form.callsign || ""} onChange={e => set("callsign")(e.target.value.toUpperCase())} className="font-mono text-xs uppercase" data-testid="input-callsign" /></div>
        <div><Label className="text-[10px] tracking-wider">COMMANDER *</Label>
          <Input placeholder="CPT Smith" value={form.commander || ""} onChange={e => set("commander")(e.target.value)} className="text-xs" /></div>
        <div><Label className="text-[10px] tracking-wider">TYPE</Label>
          <Select value={form.type} onValueChange={set("type")}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{["infantry","armor","air","intel","support","artillery","engineer","special_ops"].map(t => <SelectItem key={t} value={t}>{t.replace("_"," ").toUpperCase()}</SelectItem>)}</SelectContent>
          </Select></div>
        <div><Label className="text-[10px] tracking-wider">STATUS</Label>
          <Select value={form.status} onValueChange={set("status")}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{["active","standby","compromised","offline"].map(s => <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="col-span-2"><Label className="text-[10px] tracking-wider">GRID *</Label>
          <Input placeholder="38T LP 4821 7334" value={form.grid || ""} onChange={e => set("grid")(e.target.value)} className="font-mono text-xs" /></div>
        <div><Label className="text-[10px] tracking-wider">PAX COUNT</Label>
          <Input type="number" min="0" value={form.pax ?? 0} onChange={e => set("pax")(Number(e.target.value))} className="text-xs" /></div>
        <div className="col-span-2"><Label className="text-[10px] tracking-wider">NOTES</Label>
          <Textarea value={form.notes || ""} onChange={e => set("notes")(e.target.value)} className="text-xs h-14" /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onClose} className="text-xs">CANCEL</Button>
        <Button size="sm" onClick={submit} className="text-xs bg-green-800 hover:bg-green-700" data-testid="button-submit-unit">{unit ? "UPDATE" : "ADD"} UNIT</Button>
      </div>
    </div>
  );
}

const STATUS_CYCLE = ["active", "standby", "offline", "compromised"] as const;

// Quick-status pill that cycles on click for Admin/Owner
function StatusCycler({ unit, canEdit, onCycle }: { unit: Unit; canEdit: boolean; onCycle: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const statuses = STATUS_CYCLE;
  if (!canEdit) {
    return <span className={`badge-${unit.status} text-[9px] px-2 py-0.5 rounded font-bold tracking-wider uppercase`}>{unit.status}</span>;
  }
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className={`badge-${unit.status} text-[9px] px-2 py-0.5 rounded font-bold tracking-wider uppercase flex items-center gap-1 cursor-pointer hover:opacity-80`}>
        {unit.status}<ChevronDown size={8} />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-0.5 bg-card border border-border rounded shadow-xl overflow-hidden min-w-[120px]">
          {statuses.map(s => (
            <button key={s} onClick={() => { onCycle(s); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[10px] tracking-wider uppercase transition-colors hover:bg-secondary ${
                s === unit.status ? "text-green-400 font-bold" : "text-muted-foreground"
              }`}>{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Units() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const canEditStatus = user?.role === "admin" || user?.role === "owner";
  const [open, setOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<Unit | undefined>();
  const [filter, setFilter] = useState("all");

  const { data: units = [] } = useQuery<Unit[]>({ queryKey: ["/api/units"], queryFn: () => apiRequest("GET", "/api/units") });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/units/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/units"] }); toast({ title: "Unit removed" }); },
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => apiRequest("PATCH", `/api/units/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/units"] }),
  });

  const statuses = ["all", "active", "standby", "compromised", "offline"];
  const filtered = filter === "all" ? units : units.filter(u => u.status === filter);
  const totalPax = units.reduce((a, u) => a + u.pax, 0);

  const typeIcon: Record<string, string> = {
    infantry: "⚔", armor: "🛡", air: "✈", intel: "👁", support: "⚙",
    artillery: "💥", engineer: "🔧", special_ops: "★",
  };

  return (
    <div className="p-3 md:p-4 tac-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>UNIT ROSTER</h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">
            {units.filter(u => u.status === "active").length} ACTIVE ▪ {totalPax} TOTAL PAX ▪ {units.length} UNITS
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          {canEditStatus && (
          <DialogTrigger asChild>
            <Button size="sm" className="bg-green-800 hover:bg-green-700 text-xs tracking-wider gap-1" data-testid="button-new-unit">
              <Plus size={12} /> ADD UNIT
            </Button>
          </DialogTrigger>
          )}
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="text-sm tracking-widest">ADD UNIT</DialogTitle></DialogHeader>
            <UnitForm onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        {[
          { s: "active", label: "ACTIVE", color: "text-green-400" },
          { s: "standby", label: "STANDBY", color: "text-yellow-400" },
          { s: "compromised", label: "COMPROMISED", color: "text-red-400" },
          { s: "offline", label: "OFFLINE", color: "text-muted-foreground" },
        ].map(({ s, label, color }) => (
          <div key={s} className="bg-card border border-border rounded px-3 py-2">
            <div className="text-[9px] text-muted-foreground tracking-wider">{label}</div>
            <div className={`kpi-value text-xl ${color}`}>{units.filter(u => u.status === s).length}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="tac-filter-row mb-3">
        {statuses.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded text-[10px] tracking-wider uppercase transition-all ${filter === s ? "bg-green-900 text-green-400 border border-green-800" : "text-muted-foreground hover:text-foreground bg-secondary"}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Units table */}
      <div className="bg-card border border-border rounded">
        <table className="w-full text-xs mobile-card-table">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground tracking-[0.12em]">
              <th className="text-left px-3 py-2">TYPE</th>
              <th className="text-left px-3 py-2">CALLSIGN</th>
              <th className="text-left px-3 py-2">STATUS</th>
              <th className="text-left px-3 py-2">COMMANDER</th>
              <th className="text-left px-3 py-2">PAX</th>
              <th className="text-left px-3 py-2">GRID</th>
              <th className="text-left px-3 py-2">NOTES</th>
              <th className="text-left px-3 py-2">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-secondary/20 transition-colors" data-testid={`unit-row-${u.id}`}>
                <td className="px-3 py-2 text-base" data-label="TYPE">{typeIcon[u.type] || "■"}</td>
                <td className="px-3 py-2 font-bold font-mono tracking-wider" data-label="CALLSIGN">{u.callsign}</td>
                <td className="px-3 py-2">
                  <StatusCycler unit={u} canEdit={canEditStatus} onCycle={s => setStatus.mutate({ id: u.id, status: s })} />
                </td>
                <td className="px-3 py-2 text-muted-foreground" data-label="COMMANDER">{u.commander}</td>
                <td className="px-3 py-2 kpi-value text-sm" data-label="PAX">{u.pax}</td>
                <td className="px-3 py-2 grid-coord" data-label="GRID">{u.grid}</td>
                <td className="px-3 py-2 text-muted-foreground text-[10px] max-w-[150px] truncate" data-label="NOTES">{u.notes}</td>
                <td className="px-3 py-2">
                  {canEditStatus && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditUnit(u); setOpen(true); }} className="p-1 text-muted-foreground hover:text-foreground" data-testid={`edit-unit-${u.id}`}><Edit size={11} /></button>
                    <button onClick={() => del.mutate(u.id)} className="p-1 text-muted-foreground hover:text-red-400" data-testid={`delete-unit-${u.id}`}><Trash2 size={11} /></button>
                  </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">NO UNITS</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editUnit && (
        <Dialog open={!!editUnit} onOpenChange={v => !v && setEditUnit(undefined)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="text-sm tracking-widest">EDIT: {editUnit.callsign}</DialogTitle></DialogHeader>
            <UnitForm unit={editUnit} onClose={() => setEditUnit(undefined)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
