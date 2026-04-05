import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { TrainingRecord } from "@shared/schema";
import { useState } from "react";
import { Plus, Trash2, GraduationCap, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const RESULT_COLOR: Record<string, string> = {
  pass: "text-green-400", fail: "text-red-400", qualified: "text-blue-400", expired: "text-orange-400",
};
const CAT_COLOR: Record<string, string> = {
  general: "text-muted-foreground", weapons: "text-red-400", medical: "text-green-400",
  comms: "text-blue-400", leadership: "text-yellow-400", special: "text-orange-400",
};

function TrainingForm({ onClose, users }: { onClose: () => void; users: any[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    username: "", eventName: "", category: "general",
    date: new Date().toISOString().split("T")[0],
    result: "pass", instructor: "", expiresAt: "", notes: "",
  });

  const create = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/training", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/training"] }); toast({ title: "Training record added" }); onClose(); },
  });

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] tracking-wider">OPERATOR *</Label>
          <Select value={form.username} onValueChange={set("username")}>
            <SelectTrigger className="text-xs"><SelectValue placeholder="Select operator" /></SelectTrigger>
            <SelectContent>{users.map((u: any) => <SelectItem key={u.username} value={u.username}>{u.username}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] tracking-wider">CATEGORY</Label>
          <Select value={form.category} onValueChange={set("category")}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["general","weapons","medical","comms","leadership","special"].map(c => (
                <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label className="text-[10px] tracking-wider">EVENT / QUALIFICATION NAME *</Label>
          <Input value={form.eventName} onChange={e => set("eventName")(e.target.value)} placeholder="e.g. CQB Qualification, TCCC, JTAC Cert" className="text-xs" />
        </div>
        <div>
          <Label className="text-[10px] tracking-wider">DATE</Label>
          <Input type="date" value={form.date} onChange={e => set("date")(e.target.value)} className="text-xs" />
        </div>
        <div>
          <Label className="text-[10px] tracking-wider">RESULT</Label>
          <Select value={form.result} onValueChange={set("result")}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["pass","fail","qualified","expired"].map(r => <SelectItem key={r} value={r}>{r.toUpperCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] tracking-wider">INSTRUCTOR</Label>
          <Input value={form.instructor} onChange={e => set("instructor")(e.target.value)} placeholder="Username / callsign" className="text-xs" />
        </div>
        <div>
          <Label className="text-[10px] tracking-wider">EXPIRES (OPTIONAL)</Label>
          <Input type="date" value={form.expiresAt} onChange={e => set("expiresAt")(e.target.value)} className="text-xs" />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px] tracking-wider">NOTES</Label>
          <Textarea value={form.notes} onChange={e => set("notes")(e.target.value)} className="text-xs h-14" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>CANCEL</Button>
        <Button size="sm" className="text-xs bg-green-800 hover:bg-green-700"
          onClick={() => {
            if (!form.username || !form.eventName) { toast({ title: "Operator and event name required", variant: "destructive" }); return; }
            create.mutate(form);
          }} disabled={create.isPending}>LOG TRAINING</Button>
      </div>
    </div>
  );
}

export default function TrainingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canAdmin = user?.role === "admin" || user?.role === "owner";
  const [open, setOpen] = useState(false);
  const [filterUser, setFilterUser] = useState("all");
  const [filterCat, setFilterCat] = useState("all");

  const { data: records = [] } = useQuery<TrainingRecord[]>({ queryKey: ["/api/training"], queryFn: () => apiRequest("GET", "/api/training") });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"], queryFn: () => apiRequest("GET", "/api/users"), enabled: canAdmin });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/training/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/training"] }); toast({ title: "Record removed" }); },
  });

  const allUsers = Array.from(new Set(records.map(r => r.username)));
  const cats = ["all", "general","weapons","medical","comms","leadership","special"];

  const filtered = records.filter(r => {
    if (filterUser !== "all" && r.username !== filterUser) return false;
    if (filterCat !== "all" && r.category !== filterCat) return false;
    return true;
  });

  const expiring = records.filter(r => {
    if (!r.expiresAt) return false;
    const exp = new Date(r.expiresAt);
    const soon = new Date(); soon.setDate(soon.getDate() + 30);
    return exp <= soon && exp >= new Date();
  });

  const fmt = (s: string) => { try { return new Date(s).toLocaleDateString(); } catch { return s; } };

  return (
    <div className="p-3 md:p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>TRAINING RECORDS</h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">{records.length} RECORDS ▪ {expiring.length} EXPIRING SOON</div>
        </div>
        {canAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-green-800 hover:bg-green-700 text-xs tracking-wider gap-1">
                <Plus size={12} /> LOG TRAINING
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="text-sm tracking-widest">LOG TRAINING EVENT</DialogTitle></DialogHeader>
              <TrainingForm onClose={() => setOpen(false)} users={users} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {expiring.length > 0 && (
        <div className="bg-orange-950/30 border border-orange-800/50 rounded px-3 py-2 mb-3 flex items-center gap-2">
          <AlertTriangle size={13} className="text-orange-400 shrink-0" />
          <div className="text-[11px] text-orange-300">
            <span className="font-bold">{expiring.length} qualification{expiring.length > 1 ? "s" : ""}</span> expiring within 30 days
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-1 mb-2">
        {allUsers.length > 0 && ["all", ...allUsers].map(u => (
          <button key={u} onClick={() => setFilterUser(u)}
            className={`px-2 py-1 rounded text-[10px] tracking-wider uppercase transition-all ${filterUser === u ? "bg-green-900/50 text-green-400 border border-green-800" : "text-muted-foreground hover:text-foreground bg-secondary"}`}>
            {u === "all" ? "ALL OPERATORS" : u}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {cats.map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`px-2 py-1 rounded text-[10px] tracking-wider uppercase transition-all ${filterCat === c ? "bg-secondary text-foreground border border-border" : "text-muted-foreground hover:text-foreground"}`}>
            {c.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Records table */}
      <div className="bg-card border border-border rounded">
        <table className="w-full text-xs mobile-card-table">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground tracking-[0.12em]">
              <th className="text-left px-3 py-2">OPERATOR</th>
              <th className="text-left px-3 py-2">EVENT</th>
              <th className="text-left px-3 py-2">CATEGORY</th>
              <th className="text-left px-3 py-2">DATE</th>
              <th className="text-left px-3 py-2">RESULT</th>
              <th className="text-left px-3 py-2">EXPIRES</th>
              <th className="text-left px-3 py-2">NOTES</th>
              {canAdmin && <th className="text-left px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(r => {
              const isExpiringSoon = r.expiresAt && (() => {
                const exp = new Date(r.expiresAt!); const soon = new Date(); soon.setDate(soon.getDate() + 30);
                return exp <= soon && exp >= new Date();
              })();
              return (
                <tr key={r.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-3 py-2 font-bold font-mono" data-label="OPERATOR">{r.username}</td>
                  <td className="px-3 py-2" data-label="EVENT">{r.eventName}</td>
                  <td className="px-3 py-2" data-label="CATEGORY">
                    <span className={`text-[10px] font-bold tracking-wider ${CAT_COLOR[r.category] || ""}`}>{r.category.toUpperCase()}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground" data-label="DATE">{fmt(r.date)}</td>
                  <td className="px-3 py-2" data-label="RESULT">
                    <span className={`text-[10px] font-bold tracking-wider ${RESULT_COLOR[r.result] || ""}`}>{r.result.toUpperCase()}</span>
                  </td>
                  <td className="px-3 py-2" data-label="EXPIRES">
                    {r.expiresAt ? (
                      <span className={isExpiringSoon ? "text-orange-400 font-bold" : "text-muted-foreground"}>
                        {fmt(r.expiresAt)}{isExpiringSoon && " ⚠"}
                      </span>
                    ) : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-[10px] max-w-[120px] truncate" data-label="NOTES">{r.notes || "—"}</td>
                  {canAdmin && (
                    <td className="px-3 py-2">
                      <button onClick={() => del.mutate(r.id)} className="p-1 text-muted-foreground hover:text-red-400"><Trash2 size={11} /></button>
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={canAdmin ? 8 : 7} className="px-3 py-8 text-center text-muted-foreground">NO TRAINING RECORDS</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
