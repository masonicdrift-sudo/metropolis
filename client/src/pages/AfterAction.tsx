import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { AfterActionReport, Operation } from "@shared/schema";
import { useState } from "react";
import { Plus, FileText, Trash2, ChevronDown, ChevronUp, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const CLASS_COLOR: Record<string, string> = {
  UNCLASS: "text-blue-400", CUI: "text-yellow-400", SECRET: "text-orange-400", TS: "text-red-400",
};

function AarForm({ aar, ops, onClose }: { aar?: AfterActionReport; ops: Operation[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: aar?.title || "",
    operationId: aar?.operationId || 0,
    operationName: aar?.operationName || "",
    date: aar?.date || new Date().toISOString().split("T")[0],
    classification: aar?.classification || "UNCLASS",
    summary: aar?.summary || "",
    whatWentWell: aar?.whatWentWell || "",
    sustainItems: aar?.sustainItems || "",
    improveItems: aar?.improveItems || "",
    lessonsLearned: aar?.lessonsLearned || "",
    casualties: aar?.casualties || "",
    equipment: aar?.equipment || "",
  });

  const create = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/aar", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/aar"] }); toast({ title: "AAR submitted" }); onClose(); },
  });
  const update = useMutation({
    mutationFn: (d: any) => apiRequest("PATCH", `/api/aar/${aar?.id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/aar"] }); toast({ title: "AAR updated" }); onClose(); },
  });

  const set = (k: string) => (v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.title) { toast({ title: "Title required", variant: "destructive" }); return; }
    if (aar) update.mutate(form);
    else create.mutate(form);
  };

  const handleOpSelect = (opId: string) => {
    const id = Number(opId);
    const op = ops.find(o => o.id === id);
    setForm(f => ({ ...f, operationId: id, operationName: op?.name || "" }));
  };

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      <div className="space-y-3">
        <div>
          <Label className="text-[10px] tracking-wider">REPORT TITLE *</Label>
          <Input value={form.title} onChange={e => set("title")(e.target.value)} placeholder="AAR - OP NAME - DATE" className="text-xs" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] tracking-wider">LINKED OPERATION</Label>
            <Select value={String(form.operationId)} onValueChange={handleOpSelect}>
              <SelectTrigger className="text-xs"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">— NONE —</SelectItem>
                {ops.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] tracking-wider">DATE</Label>
            <Input type="date" value={form.date} onChange={e => set("date")(e.target.value)} className="text-xs" />
          </div>
        </div>
        <div>
          <Label className="text-[10px] tracking-wider">CLASSIFICATION</Label>
          <Select value={form.classification} onValueChange={set("classification")}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["UNCLASS","CUI","SECRET","TS"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {[
        { k: "summary", label: "MISSION SUMMARY" },
        { k: "whatWentWell", label: "WHAT WENT WELL" },
        { k: "sustainItems", label: "SUSTAIN (S)" },
        { k: "improveItems", label: "IMPROVE (I)" },
        { k: "lessonsLearned", label: "LESSONS LEARNED" },
        { k: "casualties", label: "CASUALTY / EQUIPMENT LOSS" },
        { k: "equipment", label: "EQUIPMENT / LOGISTICS NOTES" },
      ].map(({ k, label }) => (
        <div key={k}>
          <Label className="text-[10px] tracking-wider">{label}</Label>
          <Textarea value={(form as any)[k]} onChange={e => set(k)(e.target.value)} className="text-xs h-16" />
        </div>
      ))}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>CANCEL</Button>
        <Button size="sm" className="text-xs bg-blue-800 hover:bg-blue-700" onClick={submit} disabled={create.isPending || update.isPending}>
          {aar ? "UPDATE" : "SUBMIT"} AAR
        </Button>
      </div>
    </div>
  );
}

function AarCard({ aar, canAdmin, onDelete }: { aar: AfterActionReport; canAdmin: boolean; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const cls = CLASS_COLOR[aar.classification] || "text-muted-foreground";

  return (
    <div className="bg-card border border-border rounded mb-2">
      <div className="flex items-start justify-between px-3 py-2.5 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText size={12} className="text-blue-400 shrink-0" />
            {aar.docNumber ? <span className="text-[10px] font-mono text-muted-foreground/70">#{aar.docNumber}</span> : null}
            <span className="text-xs font-bold tracking-wider">{aar.title}</span>
            <span className={`text-[9px] font-bold tracking-wider ${cls}`}>{aar.classification}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {aar.date} ▪ BY {aar.submittedBy}{aar.operationName ? ` ▪ OP: ${aar.operationName}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          {canAdmin && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1 text-muted-foreground hover:text-red-400">
              <Trash2 size={11} />
            </button>
          )}
          {expanded ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-border space-y-2 mt-1">
          {[
            { k: "summary", label: "MISSION SUMMARY" },
            { k: "whatWentWell", label: "WHAT WENT WELL" },
            { k: "sustainItems", label: "SUSTAIN" },
            { k: "improveItems", label: "IMPROVE" },
            { k: "lessonsLearned", label: "LESSONS LEARNED" },
            { k: "casualties", label: "CASUALTIES / LOSS" },
            { k: "equipment", label: "EQUIPMENT NOTES" },
          ].map(({ k, label }) => {
            const val = (aar as any)[k];
            if (!val) return null;
            return (
              <div key={k}>
                <div className="text-[9px] text-muted-foreground tracking-wider">{label}</div>
                <div className="text-[11px] whitespace-pre-wrap">{val}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AfterActionPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canAdmin = user?.accessLevel === "admin" || user?.accessLevel === "owner";
  const [open, setOpen] = useState(false);

  const { data: aars = [] } = useQuery<AfterActionReport[]>({ queryKey: ["/api/aar"], queryFn: () => apiRequest("GET", "/api/aar") });
  const { data: ops = [] } = useQuery<Operation[]>({ queryKey: ["/api/operations"], queryFn: () => apiRequest("GET", "/api/operations") });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/aar/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/aar"] }); toast({ title: "AAR deleted" }); },
  });

  return (
    <div className="p-3 md:p-4 tac-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>AFTER ACTION REPORTS</h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">{aars.length} TOTAL REPORTS</div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-800 hover:bg-blue-700 text-xs tracking-wider gap-1">
              <Plus size={12} /> NEW AAR
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="text-sm tracking-widest">SUBMIT AFTER ACTION REPORT</DialogTitle></DialogHeader>
            <AarForm ops={ops} onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {aars.length === 0 && (
        <div className="bg-card border border-border rounded p-8 text-center text-muted-foreground text-xs">NO AFTER ACTION REPORTS</div>
      )}
      {aars.map(aar => (
        <AarCard key={aar.id} aar={aar} canAdmin={canAdmin} onDelete={() => del.mutate(aar.id)} />
      ))}
    </div>
  );
}
