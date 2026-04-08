import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { TrainingRecord, IsofacDoc } from "@shared/schema";
import { SIGN_IN_ISO_FAC_TYPES } from "@shared/schema";
import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { SubPageNav } from "@/components/SubPageNav";
import { TRAINING_SUB } from "@/lib/appNav";

const SIGN_IN_TYPE_SET = new Set<string>(SIGN_IN_ISO_FAC_TYPES);

const RESULT_COLOR: Record<string, string> = {
  pass: "text-blue-400", fail: "text-red-400", qualified: "text-blue-400", expired: "text-orange-400",
};
const CAT_COLOR: Record<string, string> = {
  general: "text-muted-foreground", weapons: "text-red-400", medical: "text-blue-400",
  comms: "text-blue-400", leadership: "text-yellow-400", special: "text-orange-400",
};

type TrainingRow = TrainingRecord & {
  attachedDocTitle?: string | null;
  attachedDocType?: string | null;
};

function SignInForm({ onClose, users }: { onClose: () => void; users: { username: string }[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    username: "",
    eventName: "",
    category: "general",
    date: new Date().toISOString().split("T")[0],
    result: "pass",
    instructor: "",
    expiresAt: "",
    notes: "",
    attachedIsofacDocId: "0",
  });

  const { data: isofacDocs = [] } = useQuery<IsofacDoc[]>({
    queryKey: ["/api/isofac"],
    queryFn: () => apiRequest("GET", "/api/isofac"),
  });

  const attachableDocs = useMemo(
    () => isofacDocs.filter((d) => SIGN_IN_TYPE_SET.has(d.type)),
    [isofacDocs],
  );

  const create = useMutation({
    mutationFn: (d: Record<string, unknown>) => apiRequest("POST", "/api/training", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/training"] });
      toast({ title: "Sign-in recorded" });
      onClose();
    },
    onError: (err: Error) => toast({ title: err.message || "Save failed", variant: "destructive" }),
  });

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] tracking-wider">OPERATOR *</Label>
            <Select value={form.username} onValueChange={set("username")}>
              <SelectTrigger className="text-xs"><SelectValue placeholder="Select operator" /></SelectTrigger>
              <SelectContent>{users.map((u) => <SelectItem key={u.username} value={u.username}>{u.username}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] tracking-wider">CATEGORY</Label>
            <Select value={form.category} onValueChange={set("category")}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["general", "weapons", "medical", "comms", "leadership", "special"].map((c) => (
                  <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-[10px] tracking-wider">EVENT / ENTRY NAME *</Label>
          <Input value={form.eventName} onChange={(e) => set("eventName")(e.target.value)} placeholder="e.g. Range day, Rehearsal, Lane training" className="text-xs" />
        </div>
        <div>
          <Label className="text-[10px] tracking-wider">ATTACH TO ORDER / PLAN (ISOFAC)</Label>
          <Select value={form.attachedIsofacDocId} onValueChange={set("attachedIsofacDocId")}>
            <SelectTrigger className="text-xs"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">— None —</SelectItem>
              {attachableDocs.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  [{d.type}] {d.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[9px] text-muted-foreground mt-1">OPORD, CONOP, FRAGORD, and other plan types from ISOFAC.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] tracking-wider">DATE</Label>
            <Input type="date" value={form.date} onChange={(e) => set("date")(e.target.value)} className="text-xs" />
          </div>
          <div>
            <Label className="text-[10px] tracking-wider">RESULT</Label>
            <Select value={form.result} onValueChange={set("result")}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["pass", "fail", "qualified", "expired"].map((r) => <SelectItem key={r} value={r}>{r.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] tracking-wider">INSTRUCTOR</Label>
            <Input value={form.instructor} onChange={(e) => set("instructor")(e.target.value)} placeholder="Username / callsign" className="text-xs" />
          </div>
          <div>
            <Label className="text-[10px] tracking-wider">EXPIRES (OPTIONAL)</Label>
            <Input type="date" value={form.expiresAt} onChange={(e) => set("expiresAt")(e.target.value)} className="text-xs" />
          </div>
        </div>
        <div>
          <Label className="text-[10px] tracking-wider">NOTES</Label>
          <Textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} className="text-xs h-14" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>CANCEL</Button>
        <Button
          size="sm"
          className="text-xs bg-blue-800 hover:bg-blue-700"
          onClick={() => {
            if (!form.username || !form.eventName) {
              toast({ title: "Operator and event name required", variant: "destructive" });
              return;
            }
            const attachedIsofacDocId = Number(form.attachedIsofacDocId) || 0;
            create.mutate({
              username: form.username,
              eventName: form.eventName,
              category: form.category,
              date: form.date,
              result: form.result,
              instructor: form.instructor,
              expiresAt: form.expiresAt,
              notes: form.notes,
              attachedIsofacDocId,
            });
          }}
          disabled={create.isPending}
        >
          ADD SIGN-IN
        </Button>
      </div>
    </div>
  );
}

export default function TrainingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canAdmin = user?.accessLevel === "admin" || user?.accessLevel === "owner";
  const [open, setOpen] = useState(false);
  const [filterUser, setFilterUser] = useState("all");
  const [filterCat, setFilterCat] = useState("all");

  useEffect(() => {
    if (!canAdmin) setFilterUser("all");
  }, [canAdmin]);

  const { data: records = [] } = useQuery<TrainingRow[]>({
    queryKey: ["/api/training"],
    queryFn: () => apiRequest("GET", "/api/training"),
  });
  const { data: users = [] } = useQuery<{ username: string }[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users"),
    enabled: canAdmin,
  });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/training/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/training"] });
      toast({ title: "Entry removed" });
    },
  });

  const allUsers = Array.from(new Set(records.map((r) => r.username)));
  const cats = ["all", "general", "weapons", "medical", "comms", "leadership", "special"];

  const filtered = records.filter((r) => {
    if (filterUser !== "all" && r.username !== filterUser) return false;
    if (filterCat !== "all" && r.category !== filterCat) return false;
    return true;
  });

  const expiring = records.filter((r) => {
    if (!r.expiresAt) return false;
    const exp = new Date(r.expiresAt);
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    return exp <= soon && exp >= new Date();
  });

  const fmt = (s: string) => {
    try {
      return new Date(s).toLocaleDateString();
    } catch {
      return s;
    }
  };

  return (
    <div className="p-3 md:p-4 tac-page">
      <SubPageNav items={TRAINING_SUB} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>SIGN-IN SHEET</h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">
            {canAdmin
              ? `${records.length} ENTRIES ▪ ${expiring.length} EXPIRING SOON`
              : `${records.length} YOUR ENTRIES ▪ ${expiring.length} EXPIRING SOON`}
          </div>
        </div>
        {canAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-blue-800 hover:bg-blue-700 text-xs tracking-wider gap-1">
                <Plus size={12} /> ADD SIGN-IN
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="text-sm tracking-widest">NEW SIGN-IN ENTRY</DialogTitle></DialogHeader>
              <SignInForm onClose={() => setOpen(false)} users={users} />
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

      {canAdmin && allUsers.length > 0 && (
        <div className="tac-filter-row mb-2">
          {["all", ...allUsers].map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setFilterUser(u)}
              className={`px-2 py-1 rounded text-[10px] tracking-wider uppercase transition-all ${filterUser === u ? "bg-blue-900/50 text-blue-400 border border-blue-800" : "text-muted-foreground hover:text-foreground bg-secondary"}`}
            >
              {u === "all" ? "ALL OPERATORS" : u}
            </button>
          ))}
        </div>
      )}
      {!canAdmin && (
        <p className="text-[10px] text-muted-foreground/80 mb-2">Showing your sign-in entries. Admins add new rows for the team.</p>
      )}
      <div className="tac-filter-row mb-3">
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilterCat(c)}
            className={`px-2 py-1 rounded text-[10px] tracking-wider uppercase transition-all ${filterCat === c ? "bg-secondary text-foreground border border-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            {c.toUpperCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-card border border-border rounded p-8 text-center text-muted-foreground text-xs">NO SIGN-IN ENTRIES</div>
      )}
      <div className="space-y-2">
        {filtered.map((r) => {
          const isExpiringSoon = r.expiresAt && (() => {
            const exp = new Date(r.expiresAt!);
            const soon = new Date();
            soon.setDate(soon.getDate() + 30);
            return exp <= soon && exp >= new Date();
          })();
          return (
            <div key={r.id} className="bg-card border border-border rounded px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-bold tracking-widest ${CAT_COLOR[r.category] || ""}`}>{r.category.toUpperCase()}</span>
                    <span className="text-xs font-bold">{r.eventName}</span>
                    <span className={`text-[9px] font-bold tracking-wider ${RESULT_COLOR[r.result] || ""}`}>{r.result.toUpperCase()}</span>
                    {isExpiringSoon && <span className="text-[9px] text-orange-400 font-bold">⚠ EXPIRING</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                    <span>OPR: <span className="text-foreground font-bold font-mono">{r.username}</span></span>
                    <span>▪ {fmt(r.date)}</span>
                    {r.instructor && <span>▪ INSTR: {r.instructor}</span>}
                    {r.expiresAt && (
                      <span className={isExpiringSoon ? "text-orange-400" : ""}>
                        ▪ EXP: {fmt(r.expiresAt)}
                      </span>
                    )}
                  </div>
                  {r.attachedIsofacDocId > 0 && (r.attachedDocTitle || r.attachedDocType) && (
                    <div className="text-[10px] text-blue-300/90 mt-0.5">
                      Attached: {r.attachedDocType ? `[${r.attachedDocType}] ` : ""}{r.attachedDocTitle || `Doc #${r.attachedIsofacDocId}`}
                    </div>
                  )}
                  {r.notes && <div className="text-[10px] text-muted-foreground/60 mt-0.5">{r.notes}</div>}
                </div>
                {canAdmin && (
                  <button type="button" onClick={() => del.mutate(r.id)} className="p-1 text-muted-foreground hover:text-red-400 shrink-0">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
