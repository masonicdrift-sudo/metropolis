import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Threat, InsertThreat } from "@shared/schema";
import { useState } from "react";
import { Plus, Target, Trash2, ShieldOff, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["IED","enemy_force","sniper","artillery","drone","cyber","NBC","unknown"];

function ThreatForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const now = new Date().toISOString();
  const [form, setForm] = useState<Partial<InsertThreat>>({ category: "enemy_force", confidence: "possible", active: true, timestamp: now });

  const create = useMutation({
    mutationFn: (d: InsertThreat) => apiRequest("POST", "/api/threats", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/threats"] }); toast({ title: "Threat logged" }); onClose(); },
  });

  const set = (k: keyof InsertThreat) => (v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.label || !form.grid || !form.reportedBy) { toast({ title: "Fill required fields", variant: "destructive" }); return; }
    create.mutate(form as InsertThreat);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-2"><Label className="text-[10px] tracking-wider">THREAT LABEL *</Label>
          <Input placeholder="Enemy BTR-80 Plt" value={form.label || ""} onChange={e => set("label")(e.target.value)} className="text-xs" data-testid="input-threat-label" /></div>
        <div><Label className="text-[10px] tracking-wider">CATEGORY</Label>
          <Select value={form.category} onValueChange={set("category")}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace("_"," ").toUpperCase()}</SelectItem>)}</SelectContent>
          </Select></div>
        <div><Label className="text-[10px] tracking-wider">CONFIDENCE</Label>
          <Select value={form.confidence} onValueChange={set("confidence")}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{["possible","probable","confirmed"].map(c => <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="col-span-2"><Label className="text-[10px] tracking-wider">GRID *</Label>
          <Input placeholder="38T LP 1234 5678" value={form.grid || ""} onChange={e => set("grid")(e.target.value)} className="font-mono text-xs" /></div>
        <div className="col-span-2"><Label className="text-[10px] tracking-wider">REPORTED BY *</Label>
          <Input placeholder="ALPHA-1 / HUMINT-SOURCE" value={form.reportedBy || ""} onChange={e => set("reportedBy")(e.target.value)} className="text-xs" /></div>
        <div className="col-span-2"><Label className="text-[10px] tracking-wider">NOTES</Label>
          <Textarea value={form.notes || ""} onChange={e => set("notes")(e.target.value)} className="text-xs h-16" /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onClose} className="text-xs">CANCEL</Button>
        <Button size="sm" onClick={submit} className="text-xs bg-red-900 hover:bg-red-800" data-testid="button-submit-threat">LOG THREAT</Button>
      </div>
    </div>
  );
}

export default function Threats() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reqOpen, setReqOpen] = useState(false);
  const [reqThreat, setReqThreat] = useState<Threat | null>(null);
  const [reqNote, setReqNote] = useState("");
  const [open, setOpen] = useState(false);
  const [showActive, setShowActive] = useState(true);

  const { data: threats = [] } = useQuery<Threat[]>({ queryKey: ["/api/threats"], queryFn: () => apiRequest("GET", "/api/threats") });

  const neutralize = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/threats/${id}`, { active: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/threats"] }); toast({ title: "Threat neutralized" }); },
  });
  const requestAction = useMutation({
    mutationFn: (body: { id: number; note: string }) => apiRequest("POST", `/api/threats/${body.id}/request-action`, { actionType: "target_action", note: body.note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/approvals"] }); toast({ title: "Action requested", description: "Pending approval." }); },
  });
  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/threats/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/threats"] }); toast({ title: "Threat removed" }); },
  });

  const displayed = showActive ? threats.filter(t => t.active) : threats;
  const confirmed = threats.filter(t => t.active && t.confidence === "confirmed").length;
  const probable = threats.filter(t => t.active && t.confidence === "probable").length;
  const possible = threats.filter(t => t.active && t.confidence === "possible").length;

  const confBorder: Record<string, string> = {
    confirmed: "border-l-4 border-l-red-600",
    probable: "border-l-4 border-l-orange-600",
    possible: "border-l-4 border-l-yellow-600",
  };

  return (
    <div className="p-3 md:p-4 tac-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>THREAT BOARD</h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">
            <span className="text-red-400">{confirmed} CONFIRMED</span> ▪ <span className="text-orange-400">{probable} PROBABLE</span> ▪ <span className="text-yellow-400">{possible} POSSIBLE</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button onClick={() => setShowActive(a => !a)}
            className={`text-[10px] px-3 py-1 rounded tracking-wider border transition-all ${showActive ? "bg-blue-900 text-blue-400 border-blue-800" : "text-muted-foreground border-border bg-secondary"}`}>
            {showActive ? "ACTIVE ONLY" : "ALL THREATS"}
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-red-900 hover:bg-red-800 text-xs tracking-wider gap-1" data-testid="button-new-threat">
                <Plus size={12} /> LOG THREAT
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="text-sm tracking-widest">LOG NEW THREAT</DialogTitle></DialogHeader>
              <ThreatForm onClose={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Threat summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {["IED","enemy_force","sniper","drone"].map(cat => {
          const c = threats.filter(t => t.category === cat && t.active).length;
          return (
            <div key={cat} className="bg-card border border-border rounded px-3 py-2">
              <div className="text-[9px] text-muted-foreground tracking-wider">{cat.replace("_"," ").toUpperCase()}</div>
              <div className={`kpi-value text-xl ${c > 0 ? "text-red-400" : "text-muted-foreground"}`}>{c}</div>
            </div>
          );
        })}
      </div>

      {/* Threat list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {displayed.map(t => (
          <div key={t.id} className={`bg-card border rounded p-3 ${confBorder[t.confidence]} ${!t.active ? "opacity-50" : ""}`} data-testid={`threat-card-${t.id}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className={`badge-${t.confidence} text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase`}>{t.confidence}</span>
                  <span className="text-[9px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded uppercase">{t.category.replace("_"," ")}</span>
                  {t.docNumber ? <span className="text-[9px] font-mono text-muted-foreground/70">#{t.docNumber}</span> : null}
                  {!t.active && <span className="text-[9px] text-blue-600 font-bold tracking-wider">NEUTRALIZED</span>}
                </div>
                <div className="text-xs font-bold">{t.label}</div>
              </div>
              <div className="flex gap-1">
                {t.active && (
                  <button onClick={() => neutralize.mutate(t.id)} title="Mark neutralized"
                    className="p-1 text-muted-foreground hover:text-blue-400" data-testid={`neutralize-${t.id}`}><ShieldOff size={11} /></button>
                )}
                  <button
                    onClick={() => { setReqThreat(t); setReqNote(""); setReqOpen(true); }}
                    title="Request action (approval)"
                    className="p-1 text-muted-foreground hover:text-blue-400"
                    data-testid={`request-action-${t.id}`}
                  >
                    <Send size={11} />
                  </button>
                <button onClick={() => del.mutate(t.id)} className="p-1 text-muted-foreground hover:text-red-400" data-testid={`delete-threat-${t.id}`}><Trash2 size={11} /></button>
              </div>
            </div>
            <div className="text-[9px] text-muted-foreground space-y-0.5">
              <div className="grid-coord">{t.grid}</div>
              <div>RPT BY: <span className="text-foreground/70">{t.reportedBy}</span></div>
              {t.notes && <div className="text-[9px] mt-1 text-muted-foreground/70 line-clamp-2">{t.notes}</div>}
            </div>
          </div>
        ))}
        {displayed.length === 0 && (
          <div className="col-span-2 py-10 text-center text-xs text-blue-400 tracking-wider">NO ACTIVE THREATS DETECTED</div>
        )}
      </div>

      <Dialog open={reqOpen} onOpenChange={(o) => { setReqOpen(o); if (!o) setReqThreat(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-sm tracking-widest">REQUEST ACTION</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="text-[10px] text-muted-foreground font-mono">
              {reqThreat ? `TARGET: ${reqThreat.label} (${reqThreat.grid})` : ""}
            </div>
            <Label className="text-[10px] tracking-wider">REQUEST NOTE</Label>
            <Textarea value={reqNote} onChange={(e) => setReqNote(e.target.value)} className="text-xs h-20" placeholder="Requested action / desired effects / timing…" />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setReqOpen(false)}>CANCEL</Button>
              <Button
                size="sm"
                className="text-xs bg-blue-900 hover:bg-blue-800"
                disabled={!reqThreat || !reqNote.trim() || requestAction.isPending}
                onClick={() => {
                  if (!reqThreat) return;
                  requestAction.mutate({ id: reqThreat.id, note: reqNote.trim() });
                  setReqOpen(false);
                }}
              >
                SUBMIT
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
