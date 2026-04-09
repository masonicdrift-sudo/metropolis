import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { TrainingRecord, IsofacDoc, Operation } from "@shared/schema";
import { SIGN_IN_ISO_FAC_TYPES } from "@shared/schema";
import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, AlertTriangle, List, Users } from "lucide-react";
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

const SIGN_IN_TYPE_SET = new Set<string>(SIGN_IN_ISO_FAC_TYPES);

const RESULT_COLOR: Record<string, string> = {
  pass: "text-blue-400", fail: "text-red-400", qualified: "text-blue-400", expired: "text-orange-400",
};
const CAT_COLOR: Record<string, string> = {
  general: "text-muted-foreground", weapons: "text-red-400", medical: "text-blue-400",
  comms: "text-blue-400", leadership: "text-yellow-400", special: "text-orange-400",
};

/** Comma-separated roster names → profile links (handles legacy free-text as one token). */
export function InstructorField({ text, className }: { text: string; className?: string }) {
  const parts = text.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <span className={className}>
      {parts.map((p, i) => (
        <span key={`${p}-${i}`}>
          {i > 0 ? ", " : ""}
          <ProfileLink username={p} className="text-foreground/90 hover:text-blue-400 font-mono">
            {p}
          </ProfileLink>
        </span>
      ))}
    </span>
  );
}

type TrainingRow = TrainingRecord & {
  attachedDocTitle?: string | null;
  attachedDocType?: string | null;
  operationName?: string | null;
};

function SignInForm({ onClose, users }: { onClose: () => void; users: { username: string }[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [operators, setOperators] = useState<string[]>([]);
  const [instructors, setInstructors] = useState<string[]>([]);
  const [form, setForm] = useState({
    eventName: "",
    category: "general",
    date: new Date().toISOString().split("T")[0],
    result: "pass",
    expiresAt: "",
    notes: "",
    attachedIsofacDocId: "0",
    operationId: "0",
  });

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.username.localeCompare(b.username)),
    [users],
  );
  const addableOperators = useMemo(
    () => sortedUsers.filter((u) => !operators.includes(u.username)),
    [sortedUsers, operators],
  );
  const addableInstructors = useMemo(
    () => sortedUsers.filter((u) => !instructors.includes(u.username)),
    [sortedUsers, instructors],
  );

  const { data: operations = [] } = useQuery<Operation[]>({
    queryKey: ["/api/operations"],
    queryFn: () => apiRequest("GET", "/api/operations"),
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
    mutationFn: (d: Record<string, unknown>) => apiRequest("POST", "/api/training/batch", d),
    onSuccess: (data: { count?: number }) => {
      qc.invalidateQueries({ queryKey: ["/api/training"] });
      qc.invalidateQueries({ queryKey: ["/api/operations"] });
      const n = typeof data?.count === "number" ? data.count : 1;
      toast({ title: n === 1 ? "1 sign-in recorded" : `${n} sign-ins recorded` });
      onClose();
    },
    onError: (err: Error) => toast({ title: err.message || "Save failed", variant: "destructive" }),
  });

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <div className="rounded border border-border/60 bg-secondary/10 p-2 space-y-2">
          <Label className="text-[10px] tracking-wider text-muted-foreground">OPERATORS * (ONE SIGN-IN ROW EACH)</Label>
          <Select
            key={operators.join(",")}
            onValueChange={(v) => {
              if (v && !operators.includes(v)) setOperators((o) => [...o, v].sort((a, b) => a.localeCompare(b)));
            }}
          >
            <SelectTrigger className="text-xs h-8">
              <SelectValue placeholder="Add operator…" />
            </SelectTrigger>
            <SelectContent>
              {addableOperators.length === 0 ? (
                <div className="px-2 py-1.5 text-[10px] text-muted-foreground">Everyone selected</div>
              ) : (
                addableOperators.map((u) => (
                  <SelectItem key={u.username} value={u.username} className="text-xs font-mono">
                    {u.username}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {operators.length === 0 ? (
            <div className="text-[9px] text-muted-foreground/80">Select at least one operator.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {operators.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border border-border bg-background/80"
                >
                  <ProfileLink username={name} className="text-blue-300 hover:text-blue-200">{name}</ProfileLink>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-red-400 px-0.5"
                    title="Remove"
                    onClick={() => setOperators((o) => o.filter((x) => x !== name))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded border border-border/60 bg-secondary/10 p-2 space-y-2">
          <Label className="text-[10px] tracking-wider text-muted-foreground">INSTRUCTOR(S)</Label>
          <p className="text-[9px] text-muted-foreground/80 -mt-1">Optional. Same roster multi-select; stored as comma-separated names.</p>
          <Select
            key={instructors.join(",")}
            onValueChange={(v) => {
              if (v && !instructors.includes(v)) setInstructors((o) => [...o, v].sort((a, b) => a.localeCompare(b)));
            }}
          >
            <SelectTrigger className="text-xs h-8">
              <SelectValue placeholder="Add instructor…" />
            </SelectTrigger>
            <SelectContent>
              {addableInstructors.length === 0 ? (
                <div className="px-2 py-1.5 text-[10px] text-muted-foreground">Everyone selected</div>
              ) : (
                addableInstructors.map((u) => (
                  <SelectItem key={u.username} value={u.username} className="text-xs font-mono">
                    {u.username}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {instructors.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {instructors.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border border-border bg-background/80"
                >
                  <ProfileLink username={name} className="text-amber-200/90 hover:text-amber-100">{name}</ProfileLink>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-red-400 px-0.5"
                    title="Remove"
                    onClick={() => setInstructors((o) => o.filter((x) => x !== name))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[9px] text-muted-foreground/60">No instructors listed.</div>
          )}
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
        <div>
          <Label className="text-[10px] tracking-wider">EVENT / ENTRY NAME *</Label>
          <Input value={form.eventName} onChange={(e) => set("eventName")(e.target.value)} placeholder="e.g. Range day, Rehearsal, Lane training" className="text-xs" />
        </div>
        <div>
          <Label className="text-[10px] tracking-wider">LINK TO OPERATION (ATTENDANCE)</Label>
          <Select value={form.operationId} onValueChange={set("operationId")}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="— None —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">— None —</SelectItem>
              {operations.map((op) => (
                <SelectItem key={op.id} value={String(op.id)}>
                  {op.docNumber ? `#${op.docNumber} ` : ""}
                  {op.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[9px] text-muted-foreground mt-1">
            Counts each selected operator toward that operation&apos;s attendance on the Operations page.
          </p>
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
            if (operators.length === 0 || !form.eventName.trim()) {
              toast({ title: "Select at least one operator and enter an event name", variant: "destructive" });
              return;
            }
            const attachedIsofacDocId = Number(form.attachedIsofacDocId) || 0;
            const operationId = Number(form.operationId) || 0;
            const instructorJoined = instructors.join(", ");
            create.mutate({
              usernames: operators,
              eventName: form.eventName.trim(),
              category: form.category,
              date: form.date,
              result: form.result,
              instructor: instructorJoined,
              expiresAt: form.expiresAt,
              notes: form.notes,
              attachedIsofacDocId,
              operationId,
            });
          }}
          disabled={create.isPending}
        >
          RECORD SIGN-INS
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
  /** Flat list vs one block per event/date (roster) — each name links to profile. */
  const [viewMode, setViewMode] = useState<"list" | "roster">("roster");

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
      qc.invalidateQueries({ queryKey: ["/api/operations"] });
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

  const rosterGroups = useMemo(() => {
    const map = new Map<string, TrainingRow[]>();
    for (const r of filtered) {
      const key = JSON.stringify([r.eventName.trim(), r.date]);
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }
    const groups = Array.from(map.entries()).map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => a.username.localeCompare(b.username));
      const head = rows[0]!;
      return { key, eventName: head.eventName, date: head.date, rows: sorted };
    });
    groups.sort((a, b) => {
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      if (tb !== ta) return tb - ta;
      return a.eventName.localeCompare(b.eventName);
    });
    return groups;
  }, [filtered]);

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

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[9px] text-muted-foreground tracking-widest uppercase">View</span>
        <button
          type="button"
          onClick={() => setViewMode("roster")}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] tracking-wider uppercase transition-all ${
            viewMode === "roster" ? "bg-blue-900/50 text-blue-400 border border-blue-800" : "text-muted-foreground hover:text-foreground bg-secondary"
          }`}
        >
          <Users size={12} /> By event roster
        </button>
        <button
          type="button"
          onClick={() => setViewMode("list")}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] tracking-wider uppercase transition-all ${
            viewMode === "list" ? "bg-blue-900/50 text-blue-400 border border-blue-800" : "text-muted-foreground hover:text-foreground bg-secondary"
          }`}
        >
          <List size={12} /> All entries
        </button>
        <span className="text-[9px] text-muted-foreground/80 hidden sm:inline">Roster groups the same event + date; click a name for profile.</span>
      </div>

      {filtered.length === 0 && (
        <div className="bg-card border border-border rounded p-8 text-center text-muted-foreground text-xs">NO SIGN-IN ENTRIES</div>
      )}

      {viewMode === "roster" && filtered.length > 0 && (
        <div className="space-y-3 mb-4">
          {rosterGroups.map((g) => (
            <div key={g.key} className="bg-card border border-border rounded overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-secondary/25 flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-[11px] font-bold tracking-wide text-foreground">{g.eventName}</div>
                <div className="text-[9px] text-muted-foreground font-mono">
                  {fmt(g.date)} · {g.rows.length} signed
                </div>
              </div>
              <ul className="divide-y divide-border">
                {g.rows.map((r) => (
                  <li key={r.id} className="px-3 py-2 flex items-start justify-between gap-2 hover:bg-secondary/15">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <ProfileLink
                          username={r.username}
                          className="text-xs font-bold font-mono text-blue-300 hover:text-blue-200"
                        >
                          {r.username}
                        </ProfileLink>
                        <span className={`text-[9px] font-bold tracking-widest ${CAT_COLOR[r.category] || ""}`}>{r.category.toUpperCase()}</span>
                        <span className={`text-[9px] font-bold tracking-wider ${RESULT_COLOR[r.result] || ""}`}>{r.result.toUpperCase()}</span>
                        {r.operationName ? (
                          <span className="text-[9px] text-cyan-400/90 font-mono tracking-tight" title="Operation attendance">
                            OP: {r.operationName}
                          </span>
                        ) : null}
                      </div>
                      {r.instructor ? (
                        <div className="text-[9px] text-muted-foreground mt-0.5">
                          INSTR: <InstructorField text={r.instructor} className="inline" />
                        </div>
                      ) : null}
                      {r.notes ? <div className="text-[9px] text-muted-foreground/80 mt-0.5 line-clamp-2">{r.notes}</div> : null}
                    </div>
                    {canAdmin && (
                      <button type="button" onClick={() => del.mutate(r.id)} className="p-1 text-muted-foreground hover:text-red-400 shrink-0" title="Remove entry">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className={`space-y-2 ${viewMode === "roster" ? "hidden" : ""}`}>
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
                    {r.operationName ? (
                      <span className="text-[9px] text-cyan-400/90 font-mono" title="Linked operation (attendance)">
                        OP: {r.operationName}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                    <span>
                      OPR:{" "}
                      <ProfileLink username={r.username} className="text-foreground font-bold font-mono hover:text-blue-400">
                        {r.username}
                      </ProfileLink>
                    </span>
                    <span>▪ {fmt(r.date)}</span>
                    {r.instructor ? (
                      <span className="inline-flex flex-wrap items-center gap-x-1">
                        <span>▪ INSTR:</span> <InstructorField text={r.instructor} />
                      </span>
                    ) : null}
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
