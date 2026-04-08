import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Casualty, CasualtyEvac, CasualtyTreatment } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Ambulance, Plus, Trash2 } from "lucide-react";

const STATUS = ["open", "evac_requested", "evac_enroute", "evac_complete", "closed"] as const;
const PRECEDENCE = ["urgent", "priority", "routine"] as const;
const CLASSIF = ["UNCLASS", "CUI", "SECRET", "TS"] as const;

function precedenceBadge(p: string) {
  if (p === "urgent") return "text-red-400 bg-red-950/20 border-red-900/40";
  if (p === "priority") return "text-orange-400 bg-orange-950/20 border-orange-900/40";
  return "text-green-400/80 bg-green-950/10 border-green-900/20";
}

export default function MedicalCasualtyPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const mobile = useIsMobile();

  const { data: rows = [] } = useQuery<Casualty[]>({
    queryKey: ["/api/casualties"],
    queryFn: () => apiRequest("GET", "/api/casualties"),
    enabled: !!user,
  });

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Casualty | null>(null);

  const [form, setForm] = useState({
    displayName: "",
    unit: "",
    patientId: "",
    classification: "UNCLASS",
    status: "open",
    precedence: "routine",
    injury: "",
    locationGrid: "",
    incidentAt: new Date().toISOString(),
    notes: "",
  });

  const [evac, setEvac] = useState({
    callSign: "",
    pickupGrid: "",
    hlzName: "",
    destination: "",
    platform: "",
    requestedAt: "",
    eta: "",
  });

  const [treatmentNote, setTreatmentNote] = useState("");

  const openNew = () => {
    setSelected(null);
    setForm({
      displayName: "",
      unit: "",
      patientId: "",
      classification: "UNCLASS",
      status: "open",
      precedence: "routine",
      injury: "",
      locationGrid: "",
      incidentAt: new Date().toISOString(),
      notes: "",
    });
    setEvac({ callSign: "", pickupGrid: "", hlzName: "", destination: "", platform: "", requestedAt: "", eta: "" });
    setTreatmentNote("");
    setOpen(true);
  };

  const openEdit = (c: Casualty) => {
    setSelected(c);
    setForm({
      displayName: c.displayName,
      unit: c.unit || "",
      patientId: c.patientId || "",
      classification: c.classification || "UNCLASS",
      status: c.status || "open",
      precedence: c.precedence || "routine",
      injury: c.injury || "",
      locationGrid: c.locationGrid || "",
      incidentAt: c.incidentAt,
      notes: c.notes || "",
    });
    setEvac({ callSign: "", pickupGrid: "", hlzName: "", destination: "", platform: "", requestedAt: "", eta: "" });
    setTreatmentNote("");
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setSelected(null);
  };

  const createMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/casualties", { ...form, displayName: form.displayName.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/casualties"] });
      toast({ title: "Casualty created" });
      close();
    },
  });
  const updateMut = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/casualties/${selected!.id}`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/casualties"] });
      toast({ title: "Casualty updated" });
      close();
    },
  });
  const deleteMut = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/casualties/${selected!.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/casualties"] });
      toast({ title: "Casualty deleted" });
      close();
    },
  });

  const { data: evacRow } = useQuery<CasualtyEvac | null>({
    queryKey: ["/api/casualties", selected?.id, "evac"],
    queryFn: () => apiRequest("GET", `/api/casualties/${selected!.id}/evac`),
    enabled: !!user && !!selected,
  });

  const { data: treatments = [] } = useQuery<CasualtyTreatment[]>({
    queryKey: ["/api/casualties", selected?.id, "treatments"],
    queryFn: () => apiRequest("GET", `/api/casualties/${selected!.id}/treatments`),
    enabled: !!user && !!selected,
  });

  const upsertEvac = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/casualties/evac", {
        casualtyId: selected!.id,
        ...evac,
        nineLineJson: "",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/casualties", selected?.id, "evac"] });
      toast({ title: "Evac updated" });
    },
  });

  const addTx = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/casualties/treatments", {
        casualtyId: selected!.id,
        ts: new Date().toISOString(),
        note: treatmentNote.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/casualties", selected?.id, "treatments"] });
      setTreatmentNote("");
      toast({ title: "Treatment note added" });
    },
  });

  const delTx = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/casualties/treatments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/casualties", selected?.id, "treatments"] }),
  });

  const byStatus = useMemo(() => {
    const m = new Map<string, Casualty[]>();
    for (const c of rows) {
      const list = m.get(c.status) ?? [];
      list.push(c);
      m.set(c.status, list);
    }
    return STATUS.map((s) => ({ s, rows: m.get(s) ?? [] }));
  }, [rows]);

  return (
    <div className="p-3 md:p-4 tac-page flex flex-col min-h-0 gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Ambulance className="h-4 w-4 text-green-400" />
            <h1 className="text-sm font-bold tracking-[0.15em] text-green-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              MEDICAL / CASUALTY
            </h1>
          </div>
          <div className="text-[10px] text-muted-foreground tracking-wider mt-0.5">
            Casualty roster, evac tracking, and treatment notes (tactical v1).
          </div>
        </div>
        <Button size="sm" className="h-8 text-[10px] tracking-wider bg-green-800 hover:bg-green-700" onClick={openNew}>
          <Plus className="h-3.5 w-3.5 mr-1" /> NEW CASUALTY
        </Button>
      </div>

      <div className={cn("grid gap-3", mobile ? "grid-cols-1" : "grid-cols-5")}>
        {byStatus.map(({ s, rows }) => (
          <div key={s} className="bg-card border border-border rounded min-h-0 flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-[10px] tracking-widest text-muted-foreground flex items-center justify-between">
              <span>{s.replace(/_/g, " ").toUpperCase()}</span>
              <span className="text-[9px] text-muted-foreground/70">{rows.length}</span>
            </div>
            <div className="divide-y divide-border overflow-y-auto min-h-0 max-h-[min(34dvh,420px)] md:max-h-[calc(100vh-260px)]">
              {rows.map((c) => (
                <button key={c.id} type="button" className="w-full text-left px-3 py-2 hover:bg-secondary/20" onClick={() => openEdit(c)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-[9px] font-bold tracking-wider px-2 py-0.5 rounded border", precedenceBadge(c.precedence))}>
                      {c.precedence.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono font-bold truncate">{c.displayName}</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-1 flex flex-wrap gap-2">
                    {c.unit ? <span>{c.unit}</span> : <span>—</span>}
                    {c.locationGrid ? <span className="font-mono">{c.locationGrid}</span> : null}
                    <span className="ml-auto">{new Date(c.incidentAt).toLocaleString()}</span>
                  </div>
                </button>
              ))}
              {rows.length === 0 && <div className="py-6 text-center text-xs text-muted-foreground">NONE</div>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-wider">{selected ? "EDIT CASUALTY" : "NEW CASUALTY"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] tracking-wider">DISPLAY NAME *</Label>
                <Input className="h-9 text-xs font-mono" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="SPC DOE / UNK-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] tracking-wider">PRECEDENCE</Label>
                  <Select value={form.precedence} onValueChange={(v) => setForm((f) => ({ ...f, precedence: v }))}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{PRECEDENCE.map((p) => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] tracking-wider">STATUS</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ").toUpperCase()}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] tracking-wider">UNIT</Label>
                  <Input className="h-9 text-xs font-mono" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="2-1 IN" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] tracking-wider">PATIENT ID (OPT)</Label>
                  <Input className="h-9 text-xs font-mono" value={form.patientId} onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))} placeholder="DODID / local" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] tracking-wider">CLASSIFICATION</Label>
                  <Select value={form.classification} onValueChange={(v) => setForm((f) => ({ ...f, classification: v }))}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CLASSIF.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] tracking-wider">INCIDENT AT (ISO)</Label>
                  <Input className="h-9 text-xs font-mono" value={form.incidentAt} onChange={(e) => setForm((f) => ({ ...f, incidentAt: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] tracking-wider">LOCATION GRID</Label>
                <Input className="h-9 text-xs font-mono" value={form.locationGrid} onChange={(e) => setForm((f) => ({ ...f, locationGrid: e.target.value }))} placeholder="38T LP 1234 5678" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] tracking-wider">INJURY / MECHANISM</Label>
                <Textarea className="text-xs font-mono min-h-[5rem]" value={form.injury} onChange={(e) => setForm((f) => ({ ...f, injury: e.target.value }))} placeholder="GSW, blast, vehicle rollover..." />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-[10px] tracking-wider">NOTES</Label>
                <Textarea className="text-xs font-mono min-h-[5rem]" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            {selected && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-secondary/10 border border-border rounded p-3">
                  <div className="text-[9px] tracking-widest text-muted-foreground mb-2">EVAC (9-LINE HOOKS NEXT)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input className="h-8 text-[10px] font-mono" placeholder="Callsign" value={evac.callSign} onChange={(e) => setEvac((x) => ({ ...x, callSign: e.target.value }))} />
                    <Input className="h-8 text-[10px] font-mono" placeholder="Pickup grid" value={evac.pickupGrid} onChange={(e) => setEvac((x) => ({ ...x, pickupGrid: e.target.value }))} />
                    <Input className="h-8 text-[10px] font-mono" placeholder="HLZ/PZ name" value={evac.hlzName} onChange={(e) => setEvac((x) => ({ ...x, hlzName: e.target.value }))} />
                    <Input className="h-8 text-[10px] font-mono" placeholder="Destination" value={evac.destination} onChange={(e) => setEvac((x) => ({ ...x, destination: e.target.value }))} />
                    <Input className="h-8 text-[10px] font-mono" placeholder="Platform" value={evac.platform} onChange={(e) => setEvac((x) => ({ ...x, platform: e.target.value }))} />
                    <Input className="h-8 text-[10px] font-mono" placeholder="ETA / time" value={evac.eta} onChange={(e) => setEvac((x) => ({ ...x, eta: e.target.value }))} />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button size="sm" className="h-8 text-[10px] bg-green-800 hover:bg-green-700 tracking-wider" onClick={() => upsertEvac.mutate()} disabled={upsertEvac.isPending}>
                      SAVE EVAC
                    </Button>
                    <div className="text-[9px] text-muted-foreground">
                      Current: {evacRow ? `${evacRow.callSign || "—"} / ${evacRow.pickupGrid || "—"}` : "none"}
                    </div>
                  </div>
                </div>

                <div className="bg-secondary/10 border border-border rounded p-3">
                  <div className="text-[9px] tracking-widest text-muted-foreground mb-2">TREATMENT LOG</div>
                  <div className="space-y-2">
                    <Textarea className="text-xs font-mono min-h-[4.5rem]" placeholder="Interventions, vitals, meds, notes…" value={treatmentNote} onChange={(e) => setTreatmentNote(e.target.value)} />
                    <Button size="sm" className="h-8 text-[10px] bg-green-800 hover:bg-green-700 tracking-wider" onClick={() => addTx.mutate()} disabled={!treatmentNote.trim() || addTx.isPending}>
                      ADD NOTE
                    </Button>
                    <div className="space-y-1 max-h-[220px] overflow-y-auto">
                      {treatments.map((t) => (
                        <div key={t.id} className="border border-border/60 rounded p-2 bg-background/50">
                          <div className="text-[9px] text-muted-foreground flex items-center gap-2">
                            <span className="font-mono">{new Date(t.ts).toLocaleString()}</span>
                            <span className="font-bold">{t.performedBy}</span>
                            <span className="ml-auto">
                              <button type="button" className="p-1 text-muted-foreground hover:text-red-400" onClick={() => delTx.mutate(t.id)} title="Delete note">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </span>
                          </div>
                          <div className="text-[11px] font-mono whitespace-pre-wrap mt-1">{t.note}</div>
                        </div>
                      ))}
                      {treatments.length === 0 && <div className="text-[9px] text-muted-foreground/60">No notes yet.</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
            <Button variant="outline" size="sm" onClick={close}>Cancel</Button>
            {selected && (
              <Button variant="destructive" size="sm" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}>
                Delete
              </Button>
            )}
            <Button
              size="sm"
              className="bg-green-800 hover:bg-green-700"
              onClick={() => (selected ? updateMut.mutate() : createMut.mutate())}
              disabled={!form.displayName.trim() || createMut.isPending || updateMut.isPending}
            >
              {selected ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

