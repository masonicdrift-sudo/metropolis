import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { IntelReport, InsertIntelReport } from "@shared/schema";
import { useState } from "react";
import { Plus, ShieldAlert, Trash2, CheckCircle, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

function IntelForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const now = new Date().toISOString();
  const [form, setForm] = useState<Partial<InsertIntelReport>>({ classification: "UNCLASS", category: "HUMINT", threat: "low", timestamp: now, verified: false });

  const create = useMutation({
    mutationFn: (d: InsertIntelReport) => apiRequest("POST", "/api/intel", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/intel"] }); toast({ title: "Intel report filed" }); onClose(); },
  });

  const set = (k: keyof InsertIntelReport) => (v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.title || !form.summary || !form.source) { toast({ title: "Fill required fields", variant: "destructive" }); return; }
    create.mutate(form as InsertIntelReport);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label className="text-[10px] tracking-wider">TITLE *</Label>
          <Input placeholder="Report title..." value={form.title || ""} onChange={e => set("title")(e.target.value)} className="text-xs" data-testid="input-intel-title" /></div>
        <div><Label className="text-[10px] tracking-wider">CLASSIFICATION</Label>
          <Select value={form.classification} onValueChange={set("classification")}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{["UNCLASS","CUI","SECRET","TS"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select></div>
        <div><Label className="text-[10px] tracking-wider">CATEGORY</Label>
          <Select value={form.category} onValueChange={set("category")}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{["HUMINT","SIGINT","IMINT","OSINT","CYBER"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select></div>
        <div><Label className="text-[10px] tracking-wider">THREAT LEVEL</Label>
          <Select value={form.threat} onValueChange={set("threat")}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{["low","moderate","high","critical"].map(t => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}</SelectContent>
          </Select></div>
        <div><Label className="text-[10px] tracking-wider">SOURCE *</Label>
          <Input placeholder="Source callsign..." value={form.source || ""} onChange={e => set("source")(e.target.value)} className="text-xs" /></div>
        <div className="col-span-2"><Label className="text-[10px] tracking-wider">GRID (optional)</Label>
          <Input placeholder="38T LP 1234 5678" value={form.grid || ""} onChange={e => set("grid")(e.target.value)} className="font-mono text-xs" /></div>
        <div className="col-span-2"><Label className="text-[10px] tracking-wider">SUMMARY *</Label>
          <Textarea placeholder="Intelligence summary..." value={form.summary || ""} onChange={e => set("summary")(e.target.value)} className="text-xs h-20" /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onClose} className="text-xs">CANCEL</Button>
        <Button size="sm" onClick={submit} className="text-xs bg-green-800 hover:bg-green-700" data-testid="button-submit-intel">FILE REPORT</Button>
      </div>
    </div>
  );
}

export default function Intel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<IntelReport | null>(null);
  const [filter, setFilter] = useState("all");

  const { data: reports = [] } = useQuery<IntelReport[]>({ queryKey: ["/api/intel"], queryFn: () => apiRequest("GET", "/api/intel") });

  const verify = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/intel/${id}`, { verified: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/intel"] }),
  });
  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/intel/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/intel"] }); toast({ title: "Report deleted" }); },
  });

  const categories = ["all", "HUMINT", "SIGINT", "IMINT", "OSINT", "CYBER"];
  const filtered = filter === "all" ? reports : reports.filter(r => r.category === filter);

  const counts = { HUMINT: 0, SIGINT: 0, IMINT: 0, OSINT: 0, CYBER: 0, critical: 0, unverified: 0 };
  reports.forEach(r => {
    if (r.category in counts) (counts as any)[r.category]++;
    if (r.threat === "critical") counts.critical++;
    if (!r.verified) counts.unverified++;
  });

  return (
    <div className="p-3 md:p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>INTELLIGENCE COLLECTION</h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">{counts.critical} CRITICAL // {counts.unverified} UNVERIFIED</div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-green-800 hover:bg-green-700 text-xs tracking-wider gap-1" data-testid="button-new-intel">
              <Plus size={12} /> FILE REPORT
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="text-sm tracking-widest">FILE INTEL REPORT</DialogTitle></DialogHeader>
            <IntelForm onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI mini row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
        {Object.entries(counts).slice(0, 5).map(([cat, c]) => (
          <div key={cat} className="bg-card border border-border rounded px-3 py-2">
            <div className="text-[9px] text-muted-foreground tracking-wider">{cat}</div>
            <div className="kpi-value text-base">{c as number}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-1 mb-3">
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={`px-3 py-1 rounded text-[10px] tracking-wider font-bold uppercase transition-all ${filter === c ? "bg-green-900 text-green-400 border border-green-800" : "text-muted-foreground hover:text-foreground bg-secondary"}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Reports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {filtered.map(r => (
          <div key={r.id} className={`bg-card border rounded p-3 ${r.threat === "critical" && !r.verified ? "border-red-800/60 tactical-active" : "border-border"}`} data-testid={`intel-row-${r.id}`}>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1 flex-wrap">
                <span className={`badge-${r.classification.toLowerCase()} text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider`}>{r.classification}</span>
                <span className={`badge-${r.threat} text-[9px] px-1.5 py-0.5 rounded tracking-wider uppercase`}>{r.threat}</span>
                <span className="text-[9px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{r.category}</span>
                {r.verified && <span className="text-[9px] text-green-400 flex items-center gap-0.5"><CheckCircle size={9} /> VERIFIED</span>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setViewing(r)} className="p-1 text-muted-foreground hover:text-foreground" data-testid={`view-intel-${r.id}`}><Eye size={11} /></button>
                {!r.verified && <button onClick={() => verify.mutate(r.id)} className="p-1 text-muted-foreground hover:text-green-400" data-testid={`verify-intel-${r.id}`}><CheckCircle size={11} /></button>}
                <button onClick={() => del.mutate(r.id)} className="p-1 text-muted-foreground hover:text-red-400" data-testid={`delete-intel-${r.id}`}><Trash2 size={11} /></button>
              </div>
            </div>
            <div className="text-xs font-bold text-foreground leading-tight mb-1">{r.title}</div>
            <div className="text-[11px] text-muted-foreground line-clamp-2 mb-1.5">{r.summary}</div>
            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
              <span>SRC: {r.source}</span>
              {r.grid && <span className="grid-coord">{r.grid}</span>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-8 text-xs text-muted-foreground">NO INTELLIGENCE REPORTS</div>
        )}
      </div>

      {/* View detail dialog */}
      {viewing && (
        <Dialog open={!!viewing} onOpenChange={v => !v && setViewing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xs tracking-widest flex items-center gap-2">
                <span className={`badge-${viewing.classification.toLowerCase()} text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider`}>{viewing.classification}</span>
                <span>{viewing.title}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div><div className="text-[9px] text-muted-foreground tracking-wider">CATEGORY</div><div className="font-bold">{viewing.category}</div></div>
                <div><div className="text-[9px] text-muted-foreground tracking-wider">THREAT</div><div className={`badge-${viewing.threat} inline-block text-[9px] px-1.5 py-0.5 rounded tracking-wider uppercase mt-0.5`}>{viewing.threat}</div></div>
                <div><div className="text-[9px] text-muted-foreground tracking-wider">STATUS</div><div className="font-bold">{viewing.verified ? "✓ VERIFIED" : "UNVERIFIED"}</div></div>
              </div>
              <div><div className="text-[9px] text-muted-foreground tracking-wider mb-1">SOURCE</div><div>{viewing.source}</div></div>
              {viewing.grid && <div><div className="text-[9px] text-muted-foreground tracking-wider mb-1">GRID</div><div className="grid-coord">{viewing.grid}</div></div>}
              <div><div className="text-[9px] text-muted-foreground tracking-wider mb-1">SUMMARY</div>
                <div className="bg-secondary/50 rounded p-2 leading-relaxed">{viewing.summary}</div></div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
