import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { Award, Operation } from "@shared/schema";
import { useState } from "react";
import { Plus, Star, Trash2, Medal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { SubPageNav } from "@/components/SubPageNav";
import { TRAINING_SUB } from "@/lib/appNav";
import { ProfileLink } from "@/components/ProfileLink";

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  medal:         { label: "MEDAL",         color: "text-yellow-400", icon: "🎖" },
  commendation:  { label: "COMMENDATION",  color: "text-blue-400",  icon: "⭐" },
  citation:      { label: "CITATION",      color: "text-blue-400",   icon: "📋" },
  achievement:   { label: "ACHIEVEMENT",   color: "text-orange-400", icon: "🏆" },
};

function AwardForm({ onClose, users, ops }: { onClose: () => void; users: any[]; ops: Operation[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    username: "", awardName: "", awardType: "commendation",
    reason: "", relatedOpId: 0, relatedOpName: "",
  });

  const create = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/awards", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/awards"] }); toast({ title: "Award granted" }); onClose(); },
  });

  const set = (k: string) => (v: string | number) => setForm(f => ({ ...f, [k]: v }));
  const handleOp = (id: string) => {
    const op = ops.find(o => o.id === Number(id));
    setForm(f => ({ ...f, relatedOpId: Number(id), relatedOpName: op?.name || "" }));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] tracking-wider">RECIPIENT *</Label>
          <Select value={form.username} onValueChange={set("username")}>
            <SelectTrigger className="text-xs"><SelectValue placeholder="Select operator" /></SelectTrigger>
            <SelectContent>{users.map((u: any) => <SelectItem key={u.username} value={u.username}>{u.username}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] tracking-wider">AWARD TYPE</Label>
          <Select value={form.awardType} onValueChange={set("awardType")}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-[10px] tracking-wider">AWARD NAME *</Label>
          <Input value={form.awardName} onChange={e => set("awardName")(e.target.value)} placeholder="e.g. Valor Under Fire" className="text-xs" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-[10px] tracking-wider">LINKED OPERATION</Label>
          <Select value={String(form.relatedOpId)} onValueChange={handleOp}>
            <SelectTrigger className="text-xs"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">— NONE —</SelectItem>
              {ops.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-[10px] tracking-wider">REASON / CITATION</Label>
          <Textarea value={form.reason} onChange={e => set("reason")(e.target.value)} className="text-xs h-20" placeholder="Describe the action or achievement..." />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>CANCEL</Button>
        <Button size="sm" className="text-xs bg-yellow-800 hover:bg-yellow-700 text-yellow-100"
          onClick={() => {
            if (!form.username || !form.awardName) { toast({ title: "Recipient and award name required", variant: "destructive" }); return; }
            create.mutate(form);
          }} disabled={create.isPending}>GRANT AWARD</Button>
      </div>
    </div>
  );
}

export default function AwardsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canAdmin = user?.accessLevel === "admin" || user?.accessLevel === "owner";
  const [open, setOpen] = useState(false);
  const [filterUser, setFilterUser] = useState("all");

  const { data: awards = [] } = useQuery<Award[]>({ queryKey: ["/api/awards"], queryFn: () => apiRequest("GET", "/api/awards") });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"], queryFn: () => apiRequest("GET", "/api/users"), enabled: canAdmin });
  const { data: ops = [] } = useQuery<Operation[]>({ queryKey: ["/api/operations"], queryFn: () => apiRequest("GET", "/api/operations") });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/awards/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/awards"] }); toast({ title: "Award removed" }); },
  });

  const allUsers = Array.from(new Set(awards.map(a => a.username)));
  const filtered = filterUser === "all" ? awards : awards.filter(a => a.username === filterUser);

  const fmt = (iso: string) => { try { return new Date(iso).toLocaleDateString(); } catch { return iso; } };

  return (
    <div className="p-3 md:p-4 tac-page">
      <SubPageNav items={TRAINING_SUB} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>AWARDS & COMMENDATIONS</h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">{awards.length} TOTAL AWARDS</div>
        </div>
        {canAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-yellow-800 hover:bg-yellow-700 text-yellow-100 text-xs tracking-wider gap-1">
                <Star size={12} /> GRANT AWARD
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="text-sm tracking-widest">GRANT AWARD</DialogTitle></DialogHeader>
              <AwardForm onClose={() => setOpen(false)} users={users} ops={ops} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filter */}
      {allUsers.length > 0 && (
        <div className="tac-filter-row mb-3">
          {["all", ...allUsers].map(u => (
            <button key={u} onClick={() => setFilterUser(u)}
              className={`px-3 py-1 rounded text-[10px] tracking-wider uppercase transition-all ${filterUser === u ? "bg-yellow-900/50 text-yellow-400 border border-yellow-800" : "text-muted-foreground hover:text-foreground bg-secondary"}`}>
              {u === "all" ? "ALL" : u}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="bg-card border border-border rounded p-8 text-center text-muted-foreground text-xs">NO AWARDS ON RECORD</div>
      )}

      <div className="space-y-2">
        {filtered.map(a => {
          const cfg = TYPE_CONFIG[a.awardType] || TYPE_CONFIG.commendation;
          return (
            <div key={a.id} className="bg-card border border-border rounded px-4 py-3 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">{cfg.icon}</span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold tracking-widest ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-xs font-bold font-mono">{a.awardName}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    AWARDED TO:{" "}
                    <ProfileLink username={a.username} className="text-foreground font-bold hover:text-blue-400">
                      {a.username}
                    </ProfileLink>
                    {" "}
                    ▪ BY{" "}
                    <ProfileLink username={a.awardedBy} className="text-muted-foreground hover:text-foreground">
                      {a.awardedBy}
                    </ProfileLink>{" "}
                    ▪ {fmt(a.awardedAt)}
                    {a.relatedOpName ? ` ▪ OP: ${a.relatedOpName}` : ""}
                  </div>
                  {a.reason && <div className="text-[11px] mt-1 text-muted-foreground italic">"{a.reason}"</div>}
                </div>
              </div>
              {canAdmin && (
                <button onClick={() => del.mutate(a.id)} className="p-1 text-muted-foreground hover:text-red-400 shrink-0">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
