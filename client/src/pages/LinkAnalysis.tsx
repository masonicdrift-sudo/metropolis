import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Casualty, EntityLink, IntelReport, IsofacDoc, Operation, Threat } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link2, Plus, Trash2 } from "lucide-react";

function entityLabel(type: string, id: string): string {
  return `${type}:${id}`;
}

type EntityType = "operations" | "intel" | "isofac" | "threats" | "casualties";
type EntityOption = { id: string; label: string };

const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: "intel", label: "INTEL" },
  { value: "operations", label: "OPERATIONS" },
  { value: "isofac", label: "ISOFAC" },
  { value: "threats", label: "THREATS" },
  { value: "casualties", label: "CASUALTIES" },
];

function optionsFor(type: EntityType, data: unknown): EntityOption[] {
  if (type === "intel") {
    return ((data as IntelReport[]) || []).map((r) => ({ id: String(r.id), label: `${r.id} — ${r.title}` }));
  }
  if (type === "operations") {
    return ((data as Operation[]) || []).map((o) => ({ id: String(o.id), label: `${o.id} — ${o.name}` }));
  }
  if (type === "isofac") {
    return ((data as IsofacDoc[]) || []).map((d) => ({ id: String(d.id), label: `${d.id} — ${d.type} — ${d.title}` }));
  }
  if (type === "threats") {
    return ((data as Threat[]) || []).map((t) => ({ id: String(t.id), label: `${t.id} — ${t.category} — ${t.label}` }));
  }
  return ((data as Casualty[]) || []).map((c) => ({ id: String(c.id), label: `${c.id} — ${c.precedence.toUpperCase()} — ${c.displayName}` }));
}

export default function LinkAnalysisPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const mobile = useIsMobile();

  const [target, setTarget] = useState<{ type: EntityType; id: string }>({ type: "intel", id: "" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    aType: "intel" as EntityType,
    aId: "",
    bType: "isofac" as EntityType,
    bId: "",
    relation: "related",
    note: "",
  });

  const queryKey = useMemo(() => ["/api/entity-links", target.type, target.id] as const, [target.type, target.id]);
  const { data: links = [], isLoading } = useQuery<EntityLink[]>({
    queryKey,
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/entity-links?type=${encodeURIComponent(target.type)}&id=${encodeURIComponent(target.id)}`,
      ),
    enabled: !!user && !!target.type && !!target.id.trim(),
  });

  const { data: intel = [] } = useQuery<IntelReport[]>({ queryKey: ["/api/intel"], queryFn: () => apiRequest("GET", "/api/intel"), enabled: !!user });
  const { data: operations = [] } = useQuery<Operation[]>({ queryKey: ["/api/operations"], queryFn: () => apiRequest("GET", "/api/operations"), enabled: !!user });
  const { data: isofac = [] } = useQuery<IsofacDoc[]>({ queryKey: ["/api/isofac"], queryFn: () => apiRequest("GET", "/api/isofac"), enabled: !!user });
  const { data: threats = [] } = useQuery<Threat[]>({ queryKey: ["/api/threats"], queryFn: () => apiRequest("GET", "/api/threats"), enabled: !!user });
  const { data: casualties = [] } = useQuery<Casualty[]>({ queryKey: ["/api/casualties"], queryFn: () => apiRequest("GET", "/api/casualties"), enabled: !!user });

  const dataFor = (t: EntityType) => {
    if (t === "intel") return intel;
    if (t === "operations") return operations;
    if (t === "isofac") return isofac;
    if (t === "threats") return threats;
    return casualties;
  };

  const createMut = useMutation({
    mutationFn: (body: typeof form) =>
      apiRequest("POST", "/api/entity-links", {
        aType: body.aType,
        aId: body.aId,
        bType: body.bType,
        bId: body.bId,
        relation: body.relation,
        note: body.note,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/entity-links"] });
      toast({ title: "Link created" });
      setOpen(false);
      setForm((f) => ({ ...f, note: "" }));
    },
    onError: () => toast({ title: "Link create failed", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/entity-links/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/entity-links"] });
      toast({ title: "Link removed" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  return (
    <div className="p-3 md:p-4 tac-page flex flex-col min-h-0 gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-green-400" />
            <h1 className="text-sm font-bold tracking-[0.15em] text-green-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              LINK ANALYSIS
            </h1>
          </div>
          <div className="text-[10px] text-muted-foreground tracking-wider mt-0.5">
            Cross-reference objects across the node (Intel, Ops, ISOFAC, Threats, Comms, etc.).
          </div>
        </div>
        <Button size="sm" className="h-8 text-[10px] tracking-wider bg-green-800 hover:bg-green-700" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> NEW LINK
        </Button>
      </div>

      <div className={cn("bg-card border border-border rounded p-3", mobile && "p-3")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label className="text-[9px] tracking-wider text-muted-foreground">TARGET TYPE</Label>
            <Select value={target.type} onValueChange={(v) => setTarget((t) => ({ ...t, type: v as EntityType, id: "" }))}>
              <SelectTrigger className="h-9 text-xs font-mono touch-manipulation min-h-[44px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[9px] tracking-wider text-muted-foreground">TARGET</Label>
            <Select value={target.id} onValueChange={(v) => setTarget((t) => ({ ...t, id: v }))}>
              <SelectTrigger className="h-9 text-xs font-mono touch-manipulation min-h-[44px]"><SelectValue placeholder="Select item…" /></SelectTrigger>
              <SelectContent className="max-h-[min(70dvh,320px)]">
                {optionsFor(target.type, dataFor(target.type)).map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded overflow-hidden flex-1 min-h-0">
        <div className="px-3 py-2 border-b border-border text-[10px] tracking-widest text-muted-foreground flex items-center justify-between">
          <span>{isLoading ? "LOADING…" : `${links.length} LINKS`}</span>
          <span className="text-[9px] text-muted-foreground/70">{target.id ? `for ${entityLabel(target.type, target.id)}` : "set a target"}</span>
        </div>
        <div className="divide-y divide-border overflow-y-auto min-h-0 max-h-[calc(100dvh-14rem)] md:max-h-[calc(100vh-220px)]">
          {links.length === 0 && !isLoading && (
            <div className="py-10 text-center text-xs text-muted-foreground">NO LINKS</div>
          )}
          {links.map((l) => {
            const left = entityLabel(l.aType, l.aId);
            const right = entityLabel(l.bType, l.bId);
            const canDel = !!user && (l.createdBy === user.username || user.accessLevel === "admin" || user.accessLevel === "owner");
            return (
              <div key={l.id} className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[9px] font-mono text-muted-foreground">{left}</span>
                  <span className="text-[9px] text-muted-foreground">↔</span>
                  <span className="text-[9px] font-mono text-muted-foreground">{right}</span>
                  <span className="text-[9px] bg-secondary px-1.5 rounded text-muted-foreground">{l.relation}</span>
                  <span className="text-[9px] text-muted-foreground ml-auto">BY {l.createdBy}</span>
                  {canDel && (
                    <button
                      type="button"
                      className="p-2 min-w-[36px] min-h-[36px] rounded text-muted-foreground hover:text-red-400 hover:bg-red-950/20"
                      onClick={() => deleteMut.mutate(l.id)}
                      title="Remove link"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {l.note ? (
                  <div className="text-[11px] font-mono text-foreground/90 mt-1 whitespace-pre-wrap">{l.note}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-wider">CREATE LINK</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">A TYPE</Label>
                <Select value={form.aType} onValueChange={(v) => setForm((f) => ({ ...f, aType: v as EntityType, aId: "" }))}>
                  <SelectTrigger className="h-9 text-xs font-mono touch-manipulation min-h-[44px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">A ENTITY</Label>
                <Select value={form.aId} onValueChange={(v) => setForm((f) => ({ ...f, aId: v }))}>
                  <SelectTrigger className="h-9 text-xs font-mono touch-manipulation min-h-[44px]"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent className="max-h-[min(70dvh,320px)]">
                    {optionsFor(form.aType, dataFor(form.aType)).map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">B TYPE</Label>
                <Select value={form.bType} onValueChange={(v) => setForm((f) => ({ ...f, bType: v as EntityType, bId: "" }))}>
                  <SelectTrigger className="h-9 text-xs font-mono touch-manipulation min-h-[44px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">B ENTITY</Label>
                <Select value={form.bId} onValueChange={(v) => setForm((f) => ({ ...f, bId: v }))}>
                  <SelectTrigger className="h-9 text-xs font-mono touch-manipulation min-h-[44px]"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent className="max-h-[min(70dvh,320px)]">
                    {optionsFor(form.bType, dataFor(form.bType)).map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">RELATION</Label>
                <Select value={form.relation} onValueChange={(v) => setForm((f) => ({ ...f, relation: v }))}>
                  <SelectTrigger className="h-9 text-xs font-mono touch-manipulation min-h-[44px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["related", "supports", "derivedFrom"].map((r) => (
                      <SelectItem key={r} value={r}>{r.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">NOTE (OPTIONAL)</Label>
                <Textarea className="text-xs font-mono min-h-[2.5rem]" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Why linked" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              className="bg-green-800 hover:bg-green-700"
              onClick={() => {
                if (!form.aId.trim() || !form.bId.trim()) {
                  toast({ title: "Select A and B entities", variant: "destructive" });
                  return;
                }
                createMut.mutate({
                  ...form,
                  aId: form.aId.trim(),
                  bId: form.bId.trim(),
                  relation: form.relation.trim() || "related",
                  note: form.note.trim(),
                });
              }}
              disabled={createMut.isPending || !form.aId || !form.bId}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

