import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Asset, InsertAsset, Unit } from "@shared/schema";
import { useState } from "react";
import { Plus, Package, Trash2, Edit } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select as Sel, SelectContent as SC, SelectItem as SI, SelectTrigger as ST, SelectValue as SV } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

function StatusBar({ value, label }: { value: number; label: string }) {
  const color = value > 60 ? "bar-blue" : value > 30 ? "bar-yellow" : "bar-red";
  return (
    <div className="flex items-center gap-2">
      <div className="text-[9px] text-muted-foreground w-12 shrink-0">{label}</div>
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
      <div className="text-[10px] text-muted-foreground w-8 text-right font-mono">{value}%</div>
    </div>
  );
}

function AssetForm({ asset, units, onClose }: { asset?: Asset; units: Unit[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<InsertAsset>>(asset ? {
    name: asset.name, type: asset.type, status: asset.status,
    assignedUnitId: asset.assignedUnitId || 0, grid: asset.grid || "",
    fuelPct: asset.fuelPct ?? 100, ammoPct: asset.ammoPct ?? 100,
    serialNumber: asset.serialNumber, notes: asset.notes || "",
  } : { type: "vehicle", status: "operational", fuelPct: 100, ammoPct: 100, assignedUnitId: 0, notes: "" });

  const create = useMutation({
    mutationFn: (d: InsertAsset) => apiRequest("POST", "/api/assets", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/assets"] }); toast({ title: "Asset registered" }); onClose(); },
  });
  const update = useMutation({
    mutationFn: (d: Partial<InsertAsset>) => apiRequest("PATCH", `/api/assets/${asset?.id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/assets"] }); toast({ title: "Asset updated" }); onClose(); },
  });

  const set = (k: keyof InsertAsset) => (v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name || !form.serialNumber) { toast({ title: "Name and serial required", variant: "destructive" }); return; }
    if (asset) update.mutate(form);
    else create.mutate(form as InsertAsset);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-2"><Label className="text-[10px] tracking-wider">ASSET NAME *</Label>
          <Input placeholder="M1A2 SEPv3 #1" value={form.name || ""} onChange={e => set("name")(e.target.value)} className="text-xs" /></div>
        <div><Label className="text-[10px] tracking-wider">TYPE</Label>
          <Sel value={form.type} onValueChange={set("type")}>
            <ST className="text-xs"><SV /></ST>
            <SC>{["vehicle","aircraft","weapon","comms_gear","sensor","supply"].map(t => <SI key={t} value={t}>{t.replace("_"," ").toUpperCase()}</SI>)}</SC>
          </Sel></div>
        <div><Label className="text-[10px] tracking-wider">STATUS</Label>
          <Sel value={form.status} onValueChange={set("status")}>
            <ST className="text-xs"><SV /></ST>
            <SC>{["operational","degraded","maintenance","destroyed"].map(s => <SI key={s} value={s}>{s.toUpperCase()}</SI>)}</SC>
          </Sel></div>
        <div><Label className="text-[10px] tracking-wider">SERIAL NUMBER *</Label>
          <Input placeholder="SN-0001" value={form.serialNumber || ""} onChange={e => set("serialNumber")(e.target.value)} className="font-mono text-xs" /></div>
        <div><Label className="text-[10px] tracking-wider">ASSIGNED UNIT</Label>
          <Sel value={String(form.assignedUnitId || 0)} onValueChange={v => set("assignedUnitId")(Number(v))}>
            <ST className="text-xs"><SV /></ST>
            <SC>
              <SI value="0">UNASSIGNED</SI>
              {units.map(u => <SI key={u.id} value={String(u.id)}>{u.callsign}</SI>)}
            </SC>
          </Sel></div>
        <div className="col-span-2"><Label className="text-[10px] tracking-wider">GRID</Label>
          <Input placeholder="38T LP 1234 5678" value={form.grid || ""} onChange={e => set("grid")(e.target.value)} className="font-mono text-xs" /></div>
        <div className="col-span-2">
          <Label className="text-[10px] tracking-wider">FUEL: {form.fuelPct}%</Label>
          <Slider value={[form.fuelPct ?? 100]} onValueChange={([v]) => set("fuelPct")(v)} max={100} step={5} className="mt-1" />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px] tracking-wider">AMMO: {form.ammoPct}%</Label>
          <Slider value={[form.ammoPct ?? 100]} onValueChange={([v]) => set("ammoPct")(v)} max={100} step={5} className="mt-1" />
        </div>
        <div className="col-span-2"><Label className="text-[10px] tracking-wider">NOTES</Label>
          <Textarea value={form.notes || ""} onChange={e => set("notes")(e.target.value)} className="text-xs h-14" /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onClose} className="text-xs">CANCEL</Button>
        <Button size="sm" onClick={submit} className="text-xs bg-blue-800 hover:bg-blue-700">{asset ? "UPDATE" : "REGISTER"}</Button>
      </div>
    </div>
  );
}

export default function Assets() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | undefined>();
  const [filter, setFilter] = useState("all");

  const { data: assets = [] } = useQuery<Asset[]>({ queryKey: ["/api/assets"], queryFn: () => apiRequest("GET", "/api/assets") });
  const { data: units = [] } = useQuery<Unit[]>({ queryKey: ["/api/units"], queryFn: () => apiRequest("GET", "/api/units") });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/assets/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/assets"] }); toast({ title: "Asset removed" }); },
  });

  const types = ["all", "vehicle", "aircraft", "weapon", "comms_gear", "sensor", "supply"];
  const filtered = filter === "all" ? assets : assets.filter(a => a.type === filter);

  const getUnitName = (id: number) => units.find(u => u.id === id)?.callsign || "UNASSIGNED";

  const opCount = assets.filter(a => a.status === "operational").length;
  const degCount = assets.filter(a => a.status === "degraded").length;
  const mntCount = assets.filter(a => a.status === "maintenance").length;

  return (
    <div className="p-3 md:p-4 tac-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>ASSET TRACKING</h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">{opCount} OP ▪ {degCount} DEGRADED ▪ {mntCount} MAINTENANCE</div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-800 hover:bg-blue-700 text-xs tracking-wider gap-1" data-testid="button-new-asset">
              <Plus size={12} /> REGISTER ASSET
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="text-sm tracking-widest">REGISTER ASSET</DialogTitle></DialogHeader>
            <AssetForm units={units} onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        {[
          { label: "OPERATIONAL", val: opCount, color: "text-blue-400" },
          { label: "DEGRADED", val: degCount, color: "text-orange-400" },
          { label: "MAINTENANCE", val: mntCount, color: "text-yellow-400" },
          { label: "DESTROYED", val: assets.filter(a => a.status === "destroyed").length, color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded px-3 py-2">
            <div className="text-[9px] text-muted-foreground tracking-wider">{s.label}</div>
            <div className={`kpi-value text-xl ${s.color}`}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Type filter */}
      <div className="tac-filter-row mb-3">
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1 rounded text-[10px] tracking-wider uppercase transition-all ${filter === t ? "bg-blue-900 text-blue-400 border border-blue-800" : "text-muted-foreground hover:text-foreground bg-secondary"}`}>
            {t.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Assets grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {filtered.map(a => (
          <div key={a.id} className="bg-card border border-border rounded p-3" data-testid={`asset-card-${a.id}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`badge-${a.status} text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase`}>{a.status}</span>
                  {a.docNumber ? <span className="text-[9px] font-mono text-muted-foreground/70">#{a.docNumber}</span> : null}
                </div>
                <div className="text-xs font-bold leading-tight">{a.name}</div>
                <div className="text-[10px] text-muted-foreground">{a.type.replace("_"," ").toUpperCase()}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditAsset(a); setOpen(true); }} className="p-1 text-muted-foreground hover:text-foreground"><Edit size={10} /></button>
                <button onClick={() => del.mutate(a.id)} className="p-1 text-muted-foreground hover:text-red-400"><Trash2 size={10} /></button>
              </div>
            </div>
            <div className="space-y-1.5 mb-2">
              <StatusBar value={a.fuelPct ?? 100} label="FUEL" />
              <StatusBar value={a.ammoPct ?? 100} label="AMMO" />
            </div>
            <div className="text-[9px] text-muted-foreground space-y-0.5">
              <div>S/N: <span className="font-mono text-foreground/70">{a.serialNumber}</span></div>
              <div>UNIT: <span className="text-blue-400/80">{getUnitName(a.assignedUnitId || 0)}</span></div>
              {a.grid && <div className="grid-coord">{a.grid}</div>}
            </div>
            {a.notes && <div className="text-[9px] text-muted-foreground/70 mt-1.5 border-t border-border pt-1.5 line-clamp-1">{a.notes}</div>}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-8 text-xs text-muted-foreground">NO ASSETS REGISTERED</div>
        )}
      </div>

      {editAsset && (
        <Dialog open={!!editAsset} onOpenChange={v => !v && setEditAsset(undefined)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="text-sm tracking-widest">EDIT: {editAsset.name}</DialogTitle></DialogHeader>
            <AssetForm asset={editAsset} units={units} onClose={() => setEditAsset(undefined)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
