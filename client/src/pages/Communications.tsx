import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { CommsLog, InsertCommsLog } from "@shared/schema";
import { useState } from "react";
import { Radio, Send, CheckCheck, ChevronDown, ChevronUp, FileText, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const MSG_TYPES = ["SITREP","SALUTE","FRAGO","CASEVAC","FIRE_MISSION","LOGSTAT","FLASH","CONTACT_REPORT","MEDEVAC_9LINE","SPOT_REPORT"];
const CHANNELS = ["PRIMARY","ALTERNATE","CONTINGENCY","EMERGENCY"];
const PRIORITIES = ["routine","priority","immediate","flash"];

const priorityColor: Record<string, string> = {
  flash: "border-l-4 border-l-red-500 bg-red-950/10",
  immediate: "border-l-4 border-l-orange-500 bg-orange-950/10",
  priority: "border-l-4 border-l-yellow-600 bg-yellow-950/10",
  routine: "border-l-2 border-l-border",
};

// ── Format template definitions ──────────────────────────────────────────────
type Field = { key: string; label: string; hint?: string; multiline?: boolean; required?: boolean };
type Template = { title: string; description: string; fields: Field[]; build: (vals: Record<string, string>) => string };

const TEMPLATES: Record<string, Template> = {
  SITREP: {
    title: "SITREP",
    description: "Situation Report — current status update",
    fields: [
      { key: "location", label: "LOCATION (GRID)", hint: "38T LP 4821 7334" },
      { key: "pax", label: "PAX / STRENGTH", hint: "12 all UP" },
      { key: "contact", label: "ENEMY CONTACT", hint: "No contact / Contact at..." },
      { key: "status", label: "EQUIPMENT STATUS", hint: "GREEN / YELLOW / RED" },
      { key: "logStatus", label: "LOGISTICS STATUS", hint: "Class III 80%, Class V 75%" },
      { key: "notes", label: "ADDITIONAL NOTES", multiline: true },
    ],
    build: (v) => [
      `SITREP:`,
      `LOC: ${v.location || "N/A"}`,
      `STR: ${v.pax || "N/A"}`,
      `CONTACT: ${v.contact || "NEG"}`,
      `EQUIP: ${v.status || "GREEN"}`,
      `LOG: ${v.logStatus || "N/A"}`,
      v.notes ? `NOTES: ${v.notes}` : "",
    ].filter(Boolean).join(" | "),
  },

  SALUTE: {
    title: "SALUTE REPORT",
    description: "Enemy sighting report",
    fields: [
      { key: "size", label: "S — SIZE", hint: "e.g. Squad, Plt, 3x vehicles", required: true },
      { key: "activity", label: "A — ACTIVITY", hint: "e.g. Moving NW, emplacing IED", required: true },
      { key: "location", label: "L — LOCATION (GRID)", hint: "38T LP 5300 7400", required: true },
      { key: "unit", label: "U — UNIT / ID", hint: "Unknown / BTR-80s / uniforms" },
      { key: "time", label: "T — TIME OBSERVED", hint: "e.g. 0115L", required: true },
      { key: "equipment", label: "E — EQUIPMENT", hint: "e.g. 3x BTR-80, RPGs" },
    ],
    build: (v) =>
      `SALUTE: S-${v.size || "UNK"} | A-${v.activity || "UNK"} | L-${v.location || "UNK"} | U-${v.unit || "UNK"} | T-${v.time || "UNK"} | E-${v.equipment || "UNK"}`,
  },

  FRAGO: {
    title: "FRAGO",
    description: "Fragmentary Order — change to existing orders",
    fields: [
      { key: "frago_num", label: "FRAGO #", hint: "e.g. FRAGO 04" },
      { key: "ref", label: "REFERENCE OP", hint: "e.g. OP IRON VEIL" },
      { key: "situation", label: "SITUATION CHANGE", multiline: true, required: true },
      { key: "mission", label: "NEW MISSION / TASK", multiline: true, required: true },
      { key: "coord", label: "COORDINATION INSTRUCTIONS", multiline: true },
      { key: "ack", label: "ACK REQUIRED", hint: "YES / NO" },
    ],
    build: (v) => [
      `${v.frago_num || "FRAGO"} REF: ${v.ref || "N/A"}`,
      `SITUATION: ${v.situation || ""}`,
      `MISSION: ${v.mission || ""}`,
      v.coord ? `COORD: ${v.coord}` : "",
      `ACK: ${v.ack || "YES"}`,
    ].filter(Boolean).join(" || "),
  },

  CASEVAC: {
    title: "CASEVAC REQUEST",
    description: "Casualty Evacuation — 9-Line format",
    fields: [
      { key: "l1_grid", label: "1. PICKUP LOCATION (GRID)", hint: "38T LP 4821 7334", required: true },
      { key: "l2_freq", label: "2. RADIO FREQ / CALLSIGN", hint: "e.g. 34.75 / ALPHA-1" },
      { key: "l3_patients", label: "3. # PATIENTS (A/P/L)", hint: "e.g. 2A 1P 0L (Ambulatory/Precedence/Litter)" },
      { key: "l4_equip", label: "4. SPECIAL EQUIPMENT", hint: "N / A / O / W (None/Hoist/Oxygen/Winch)" },
      { key: "l5_detail", label: "5. # PATIENTS (detail)", hint: "e.g. 3 US Military" },
      { key: "l6_security", label: "6. PICKUP SITE SECURITY", hint: "N / P / E / X (None/Possible/Enemy/Enemy armed)" },
      { key: "l7_method", label: "7. METHOD OF MARKING", hint: "A/B/C/D/E — Panels/Pyro/Smoke/None/Other" },
      { key: "l8_nationality", label: "8. PATIENT NATIONALITY / STATUS", hint: "e.g. US Military" },
      { key: "l9_nbc", label: "9. NBC CONTAMINATION", hint: "N / B / C / R" },
    ],
    build: (v) =>
      `9-LINE MEDEVAC: 1-${v.l1_grid||"?"} 2-${v.l2_freq||"?"} 3-${v.l3_patients||"?"} 4-${v.l4_equip||"N"} 5-${v.l5_detail||"?"} 6-${v.l6_security||"N"} 7-${v.l7_method||"?"} 8-${v.l8_nationality||"?"} 9-${v.l9_nbc||"N"}`,
  },

  MEDEVAC_9LINE: {
    title: "MEDEVAC 9-LINE",
    description: "Full 9-Line Medical Evacuation Request",
    fields: [
      { key: "l1_grid", label: "1. PICKUP LOCATION (GRID)", required: true },
      { key: "l2_freq", label: "2. RADIO FREQ / CALLSIGN" },
      { key: "l3_patients", label: "3. # PATIENTS BY PRECEDENCE", hint: "e.g. 1 Urgent, 2 Priority" },
      { key: "l4_equip", label: "4. SPECIAL EQUIPMENT REQUIRED" },
      { key: "l5_detail", label: "5. # PATIENTS BY TYPE", hint: "Litter / Ambulatory" },
      { key: "l6_security", label: "6. PICKUP SITE SECURITY" },
      { key: "l7_method", label: "7. METHOD OF MARKING PICKUP SITE" },
      { key: "l8_nationality", label: "8. PATIENT NATIONALITY & STATUS" },
      { key: "l9_nbc", label: "9. NBC CONTAMINATION" },
    ],
    build: (v) =>
      `MEDEVAC 9-LINE: 1-${v.l1_grid||"?"} | 2-${v.l2_freq||"?"} | 3-${v.l3_patients||"?"} | 4-${v.l4_equip||"N"} | 5-${v.l5_detail||"?"} | 6-${v.l6_security||"N"} | 7-${v.l7_method||"?"} | 8-${v.l8_nationality||"?"} | 9-${v.l9_nbc||"N"}`,
  },

  FIRE_MISSION: {
    title: "FIRE MISSION",
    description: "Call for indirect fire support",
    fields: [
      { key: "observer", label: "OBSERVER ID / CALLSIGN", required: true },
      { key: "target_grid", label: "TARGET GRID", required: true },
      { key: "description", label: "TARGET DESCRIPTION", hint: "e.g. Enemy infantry in open, moving NW", required: true },
      { key: "method", label: "METHOD OF ENGAGEMENT", hint: "e.g. Fire for effect / Adjust fire" },
      { key: "effect", label: "DESIRED EFFECT", hint: "e.g. Suppress / Destroy / Illuminate" },
      { key: "danger_close", label: "DANGER CLOSE?", hint: "YES (with distance) / NO" },
    ],
    build: (v) => [
      `FIRE MISSION:`,
      `OBSERVER: ${v.observer || "UNK"}`,
      `TGT GRID: ${v.target_grid || "UNK"}`,
      `TGT DESC: ${v.description || ""}`,
      `METHOD: ${v.method || "FFE"}`,
      `EFFECT: ${v.effect || "SUPPRESS"}`,
      v.danger_close ? `DANGER CLOSE: ${v.danger_close}` : "",
    ].filter(Boolean).join(" | "),
  },

  LOGSTAT: {
    title: "LOGSTAT",
    description: "Logistics Status Report",
    fields: [
      { key: "cl1", label: "CLASS I — FOOD/WATER", hint: "e.g. 3 days" },
      { key: "cl3", label: "CLASS III — FUEL", hint: "e.g. 60%" },
      { key: "cl5", label: "CLASS V — AMMO", hint: "e.g. 75% basic load" },
      { key: "cl9", label: "CLASS IX — REPAIR PARTS", hint: "e.g. Need 2x track pads M1A2" },
      { key: "casevac", label: "CASEVAC STATUS", hint: "e.g. 0 WIA / 0 KIA" },
      { key: "equipment", label: "EQUIPMENT DOWN", hint: "e.g. 1x Humvee NMC — alternator" },
      { key: "requests", label: "RESUPPLY REQUESTS", multiline: true },
    ],
    build: (v) => [
      `LOGSTAT:`,
      `CI: ${v.cl1 || "N/A"}`,
      `CIII: ${v.cl3 || "N/A"}`,
      `CV: ${v.cl5 || "N/A"}`,
      `CIX: ${v.cl9 || "N/A"}`,
      `CASEVAC: ${v.casevac || "0 WIA/KIA"}`,
      v.equipment ? `EQ DOWN: ${v.equipment}` : "",
      v.requests ? `REQUESTS: ${v.requests}` : "",
    ].filter(Boolean).join(" | "),
  },

  FLASH: {
    title: "FLASH MESSAGE",
    description: "Highest priority — immediate action required",
    fields: [
      { key: "subject", label: "SUBJECT", required: true },
      { key: "situation", label: "SITUATION", multiline: true, required: true },
      { key: "action", label: "IMMEDIATE ACTION REQUIRED", multiline: true, required: true },
    ],
    build: (v) =>
      `FLASH — ${v.subject || ""}: SITUATION: ${v.situation || ""} | ACTION REQUIRED: ${v.action || ""}`,
  },

  CONTACT_REPORT: {
    title: "CONTACT REPORT",
    description: "Initial enemy contact report",
    fields: [
      { key: "time", label: "TIME OF CONTACT", hint: "e.g. 0142L", required: true },
      { key: "location", label: "YOUR LOCATION (GRID)", required: true },
      { key: "enemy_loc", label: "ENEMY LOCATION (GRID / DIRECTION)", required: true },
      { key: "description", label: "ENEMY DESCRIPTION", hint: "Size, weapons, uniforms", required: true },
      { key: "action", label: "FRIENDLY ACTION TAKEN", hint: "e.g. Returned fire, breaking contact" },
      { key: "casualties", label: "FRIENDLY CASUALTIES", hint: "e.g. 1 WIA, no KIA" },
    ],
    build: (v) => [
      `CONTACT REPORT:`,
      `TIME: ${v.time || "UNK"}`,
      `MY LOC: ${v.location || "UNK"}`,
      `ENEMY: ${v.enemy_loc || "UNK"} — ${v.description || "UNK"}`,
      `ACTION: ${v.action || "UNK"}`,
      v.casualties ? `CAS: ${v.casualties}` : "",
    ].filter(Boolean).join(" | "),
  },

  SPOT_REPORT: {
    title: "SPOT REPORT",
    description: "Quick battlefield observation report",
    fields: [
      { key: "what", label: "WHAT WAS OBSERVED", required: true },
      { key: "location", label: "LOCATION (GRID)", required: true },
      { key: "time", label: "TIME", hint: "e.g. 0215L" },
      { key: "details", label: "ADDITIONAL DETAILS", multiline: true },
    ],
    build: (v) =>
      `SPOT REPORT: ${v.what || ""} at ${v.location || "UNK"} at ${v.time || "UNK"}${v.details ? " — " + v.details : ""}`,
  },
};

// ── Format template panel ─────────────────────────────────────────────────────
function FormatTemplate({ type, onFill }: { type: string; onFill: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const tmpl = TEMPLATES[type];
  if (!tmpl) return null;

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setVals(v => ({ ...v, [key]: e.target.value }));

  const handleFill = () => {
    const text = tmpl.build(vals);
    onFill(text);
    setOpen(false);
    setVals({});
  };

  const handleClear = () => setVals({});

  return (
    <div className="border border-border rounded overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 text-[10px] tracking-wider transition-colors ${open ? "bg-green-950/30 text-green-400" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
      >
        <div className="flex items-center gap-2">
          <FileText size={10} />
          <span className="font-bold">{tmpl.title} FORMAT TEMPLATE</span>
          <span className="text-muted-foreground/60 normal-case">{tmpl.description}</span>
        </div>
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>

      {open && (
        <div className="bg-secondary/20 border-t border-border p-3 space-y-2">
          <div className="text-[9px] text-muted-foreground/60 tracking-wider mb-2">
            Fill any fields — only filled fields will be included. All fields are optional.
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tmpl.fields.map(f => (
              <div key={f.key} className={f.multiline ? "col-span-2" : ""}>
                <label className={`text-[9px] tracking-wider block mb-1 ${f.required ? "text-green-400/80" : "text-muted-foreground"}`}>
                  {f.label}{f.required && <span className="text-green-400/60 ml-1">(key field)</span>}
                </label>
                {f.multiline ? (
                  <Textarea
                    value={vals[f.key] || ""}
                    onChange={set(f.key)}
                    placeholder={f.hint || ""}
                    className="text-[10px] h-12 font-mono"
                  />
                ) : (
                  <Input
                    value={vals[f.key] || ""}
                    onChange={set(f.key)}
                    placeholder={f.hint || ""}
                    className="text-[10px] h-7 font-mono"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleFill}
              className="text-[10px] bg-green-800 hover:bg-green-700 h-7 px-3 tracking-wider">
              INSERT INTO MESSAGE
            </Button>
            <Button size="sm" variant="outline" onClick={handleClear}
              className="text-[10px] h-7 px-3 tracking-wider">
              CLEAR
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Communications page ──────────────────────────────────────────────────
export default function Communications() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const [form, setForm] = useState<Partial<InsertCommsLog>>({
    channel: "PRIMARY", type: "SITREP", priority: "routine",
  });
  const [filterChan, setFilterChan] = useState("ALL");
  const [confirmClear, setConfirmClear] = useState(false);

  const { data: comms = [] } = useQuery<CommsLog[]>({ queryKey: ["/api/comms"], queryFn: () => apiRequest("GET", "/api/comms") });

  const deleteEntry = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/comms/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/comms"] }),
  });

  const clearLog = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/comms"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/comms"] }); toast({ title: "Comms log cleared" }); setConfirmClear(false); },
  });

  const send = useMutation({
    mutationFn: (d: InsertCommsLog) => apiRequest("POST", "/api/comms", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/comms"] });
      toast({ title: "Message transmitted" });
      setForm(f => ({ ...f, message: "" }));
    },
  });
  const ack = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/comms/${id}/ack`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/comms"] }),
  });

  const transmit = () => {
    if (!form.fromCallsign || !form.toCallsign || !form.message) {
      toast({ title: "Fill FROM, TO, and MESSAGE", variant: "destructive" }); return;
    }
    send.mutate({ ...form, timestamp: new Date().toISOString() } as InsertCommsLog);
  };

  const set = (k: keyof InsertCommsLog) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const filtered = filterChan === "ALL" ? comms : comms.filter(c => c.channel === filterChan);
  const unacked = comms.filter(c => !c.acknowledged).length;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>COMMUNICATIONS CENTER</h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">
            {unacked > 0 ? <span className="text-yellow-400">{unacked} UNACKNOWLEDGED</span> : "ALL MESSAGES ACK'D"} ▪ {comms.length} TOTAL MSGS
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">

        {/* Compose */}
        <div className="col-span-5 bg-card border border-border rounded">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Radio size={11} className="text-green-400" />
            <span className="text-[10px] font-bold tracking-[0.15em] text-green-400">COMPOSE MESSAGE</span>
          </div>
          <div className="p-3 space-y-2.5">
            {/* From / To */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[9px] tracking-wider text-muted-foreground">FROM (CALLSIGN)</Label>
                <Input placeholder="ALPHA-1" value={form.fromCallsign || ""} onChange={e => set("fromCallsign")(e.target.value)} className="text-xs h-7 font-mono uppercase" data-testid="input-from" />
              </div>
              <div>
                <Label className="text-[9px] tracking-wider text-muted-foreground">TO (CALLSIGN)</Label>
                <Input placeholder="TOC" value={form.toCallsign || ""} onChange={e => set("toCallsign")(e.target.value)} className="text-xs h-7 font-mono uppercase" data-testid="input-to" />
              </div>
            </div>

            {/* Channel / Type / Priority */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[9px] tracking-wider text-muted-foreground">CHANNEL</Label>
                <Select value={form.channel} onValueChange={set("channel")}>
                  <SelectTrigger className="text-xs h-7"><SelectValue /></SelectTrigger>
                  <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[9px] tracking-wider text-muted-foreground">MSG TYPE</Label>
                <Select value={form.type} onValueChange={v => { set("type")(v); setForm(f => ({ ...f, message: "" })); }}>
                  <SelectTrigger className="text-xs h-7"><SelectValue /></SelectTrigger>
                  <SelectContent>{MSG_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[9px] tracking-wider text-muted-foreground">PRIORITY</Label>
                <Select value={form.priority} onValueChange={set("priority")}>
                  <SelectTrigger className="text-xs h-7"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Format template — collapsible fillable form */}
            {form.type && TEMPLATES[form.type] && (
              <FormatTemplate
                type={form.type}
                onFill={(text) => setForm(f => ({ ...f, message: text }))}
              />
            )}

            {/* Message text */}
            <div>
              <Label className="text-[9px] tracking-wider text-muted-foreground">
                MESSAGE TEXT <span className="text-muted-foreground/50">(edit after template fill, or write manually)</span>
              </Label>
              <Textarea
                placeholder="Enter message text or use the template above..."
                value={form.message || ""}
                onChange={e => set("message")(e.target.value)}
                className="text-xs h-24 font-mono"
                data-testid="input-message"
              />
            </div>

            <Button size="sm" onClick={transmit} disabled={send.isPending}
              className="w-full bg-green-800 hover:bg-green-700 text-xs tracking-wider gap-1" data-testid="button-transmit">
              <Send size={11} /> TRANSMIT
            </Button>
          </div>
        </div>

        {/* Log */}
        <div className="col-span-7 bg-card border border-border rounded">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-[10px] font-bold tracking-[0.15em] text-green-400">MESSAGE LOG</span>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {["ALL", ...CHANNELS].map(ch => (
                  <button key={ch} onClick={() => setFilterChan(ch)}
                    className={`text-[9px] px-2 py-0.5 rounded tracking-wider transition-all ${filterChan === ch ? "bg-green-900 text-green-400 border border-green-800" : "text-muted-foreground bg-secondary hover:text-foreground"}`}>
                    {ch}
                  </button>
                ))}
              </div>
              {isOwner && (
                confirmClear ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-red-400 tracking-wider">CLEAR ALL?</span>
                    <button onClick={() => clearLog.mutate()} className="text-[9px] bg-red-900/60 border border-red-800/50 text-red-300 px-2 py-0.5 rounded hover:bg-red-800 tracking-wider">CONFIRM</button>
                    <button onClick={() => setConfirmClear(false)} className="text-[9px] text-muted-foreground hover:text-foreground px-1">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmClear(true)}
                    className="text-[9px] text-red-400/60 hover:text-red-400 flex items-center gap-1 tracking-wider transition-colors" title="Clear entire log">
                    <Trash2 size={9} /> CLEAR LOG
                  </button>
                )
              )}
            </div>
          </div>
          <div className="divide-y divide-border overflow-y-auto max-h-[calc(100vh-220px)]">
            {filtered.length === 0 && <div className="py-8 text-center text-xs text-muted-foreground">NO MESSAGES</div>}
            {filtered.map(msg => (
              <div key={msg.id} className={`px-3 py-2.5 ${priorityColor[msg.priority] || ""}`} data-testid={`msg-${msg.id}`}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`badge-${msg.priority} text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase`}>{msg.priority}</span>
                  <span className="text-[10px] font-bold text-green-400">{msg.fromCallsign}</span>
                  <span className="text-[9px] text-muted-foreground">▶</span>
                  <span className="text-[10px] font-bold">{msg.toCallsign}</span>
                  <span className="text-[9px] bg-secondary px-1.5 rounded text-muted-foreground">{msg.type}</span>
                  <span className="text-[9px] text-muted-foreground">[{msg.channel}]</span>
                  <span className="text-[9px] text-muted-foreground ml-auto">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  {!msg.acknowledged ? (
                    <button onClick={() => ack.mutate(msg.id)} className="text-[9px] text-yellow-400 hover:text-yellow-300 flex items-center gap-0.5 ml-1" data-testid={`ack-${msg.id}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />ACK
                    </button>
                  ) : (
                    <span className="text-[9px] text-green-600 flex items-center gap-0.5 ml-1"><CheckCheck size={9} />ACK</span>
                  )}
                  {isOwner && (
                    <button onClick={() => deleteEntry.mutate(msg.id)}
                      className="ml-1 p-0.5 text-muted-foreground/40 hover:text-red-400 transition-colors" title="Delete message">
                      <Trash2 size={9} />
                    </button>
                  )}
                </div>
                <div className="text-[11px] leading-relaxed text-foreground/90 font-mono pl-1">{msg.message}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
