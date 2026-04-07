import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { CommsLog, InsertCommsLog } from "@shared/schema";
import { useState, useRef, useId, useEffect } from "react";
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
type Field = { key: string; label: string; hint?: string; multiline?: boolean; required?: boolean; options?: string[] };
type Template = { title: string; description: string; fields: Field[]; build: (vals: Record<string, string>) => string };

const O = {
  grid: ["38T LP 4821 7334", "38T LP 5300 7400", "N/A", "UNK"],
  yesNo: ["YES", "NO"],
  equip: ["GREEN", "YELLOW", "RED"],
  contact: ["No contact", "NEG", "Visual ID", "Effective fire", "Moving NW"],
  pax: ["12 all UP", "6 UP 1 WIA", "Unknown strength", "0 PAX"],
  log: ["Class III 80%, Class V 75%", "GREEN LOG", "Ammunition critical", "Fuel 50%"],
  saluteSize: ["Squad", "Platoon", "Company", "3x vehicles", "Unknown"],
  saluteAct: ["Moving NW", "Emplacing IED", "Defensive", "Patrolling", "Unknown"],
  time: ["0115L", "0215L", "0342Z", "NOW"],
  nbc: ["N", "B", "C", "R"],
  medevacSec: ["N", "P", "E", "X"],
  medevacEq: ["N", "A", "O", "W"],
  mark: ["A — Panels", "B — Pyro", "C — Smoke", "D — None", "E — Other"],
  fireMeth: ["Fire for effect", "Adjust fire", "Suppress", "Illumination"],
  fireEff: ["Suppress", "Destroy", "Neutralize", "Illuminate"],
  flashPri: ["IMMEDIATE ACTION", "BREAK BREAK", "ALL STATIONS"],
  casevac: ["0 WIA / 0 KIA", "1 WIA", "2 LITTER"],
};

const TEMPLATES: Record<string, Template> = {
  SITREP: {
    title: "SITREP",
    description: "Situation Report — current status update",
    fields: [
      { key: "location", label: "LOCATION (GRID)", hint: "38T LP 4821 7334", options: O.grid },
      { key: "pax", label: "PAX / STRENGTH", hint: "12 all UP", options: O.pax },
      { key: "contact", label: "ENEMY CONTACT", hint: "No contact / Contact at...", options: O.contact },
      { key: "status", label: "EQUIPMENT STATUS", hint: "GREEN / YELLOW / RED", options: O.equip },
      { key: "logStatus", label: "LOGISTICS STATUS", hint: "Class III 80%, Class V 75%", options: O.log },
      { key: "notes", label: "ADDITIONAL NOTES", multiline: true, options: ["All quiet", "Awaiting orders", "Resupply requested"] },
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
      { key: "size", label: "S — SIZE", hint: "e.g. Squad, Plt, 3x vehicles", required: true, options: O.saluteSize },
      { key: "activity", label: "A — ACTIVITY", hint: "e.g. Moving NW, emplacing IED", required: true, options: O.saluteAct },
      { key: "location", label: "L — LOCATION (GRID)", hint: "38T LP 5300 7400", required: true, options: O.grid },
      { key: "unit", label: "U — UNIT / ID", hint: "Unknown / BTR-80s / uniforms", options: ["Unknown", "BTR-80s", "Uniformed infantry", "Civilian clothes"] },
      { key: "time", label: "T — TIME OBSERVED", hint: "e.g. 0115L", required: true, options: O.time },
      { key: "equipment", label: "E — EQUIPMENT", hint: "e.g. 3x BTR-80, RPGs", options: ["3x BTR-80, RPGs", "Small arms only", "RPK / PKM", "None observed"] },
    ],
    build: (v) =>
      `SALUTE: S-${v.size || "UNK"} | A-${v.activity || "UNK"} | L-${v.location || "UNK"} | U-${v.unit || "UNK"} | T-${v.time || "UNK"} | E-${v.equipment || "UNK"}`,
  },

  FRAGO: {
    title: "FRAGO",
    description: "Fragmentary Order — change to existing orders",
    fields: [
      { key: "frago_num", label: "FRAGO #", hint: "e.g. FRAGO 04", options: ["FRAGO 01", "FRAGO 02", "FRAGO 03", "FRAGO 04"] },
      { key: "ref", label: "REFERENCE OP", hint: "e.g. OP IRON VEIL", options: ["OP IRON VEIL", "OP GRAY HAWK", "CURRENT OPORD"] },
      { key: "situation", label: "SITUATION CHANGE", multiline: true, required: true, options: ["Enemy shifted NW", "Weather degraded", "Route impassable", "No change — confirm previous"] },
      { key: "mission", label: "NEW MISSION / TASK", multiline: true, required: true, options: ["Continue mission", "Hold in place", "Retrograde to PL BLUE", "Conduct relief in place"] },
      { key: "coord", label: "COORDINATION INSTRUCTIONS", multiline: true, options: ["Report PIR to TOC", "Deconflict fires with G3", "Maintain comms on PRIMARY"] },
      { key: "ack", label: "ACK REQUIRED", hint: "YES / NO", options: O.yesNo },
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
      { key: "l1_grid", label: "1. PICKUP LOCATION (GRID)", hint: "38T LP 4821 7334", required: true, options: O.grid },
      { key: "l2_freq", label: "2. RADIO FREQ / CALLSIGN", hint: "e.g. 34.75 / ALPHA-1", options: ["34.75 / ALPHA-1", "PRIMARY / TOC", "MEDEVAC / 58.0"] },
      { key: "l3_patients", label: "3. # PATIENTS (A/P/L)", hint: "e.g. 2A 1P 0L (Ambulatory/Precedence/Litter)", options: ["2A 1P 0L", "1U 0P 0L", "0A 2L 0P"] },
      { key: "l4_equip", label: "4. SPECIAL EQUIPMENT", hint: "N / A / O / W (None/Hoist/Oxygen/Winch)", options: O.medevacEq },
      { key: "l5_detail", label: "5. # PATIENTS (detail)", hint: "e.g. 3 US Military", options: ["3 US Military", "2 US / 1 LN", "1 urgent surgical"] },
      { key: "l6_security", label: "6. PICKUP SITE SECURITY", hint: "N / P / E / X (None/Possible/Enemy/Enemy armed)", options: O.medevacSec },
      { key: "l7_method", label: "7. METHOD OF MARKING", hint: "A/B/C/D/E — Panels/Pyro/Smoke/None/Other", options: O.mark },
      { key: "l8_nationality", label: "8. PATIENT NATIONALITY / STATUS", hint: "e.g. US Military", options: ["US Military", "Coalition", "Local national", "Unknown"] },
      { key: "l9_nbc", label: "9. NBC CONTAMINATION", hint: "N / B / C / R", options: O.nbc },
    ],
    build: (v) =>
      `9-LINE MEDEVAC: 1-${v.l1_grid||"?"} 2-${v.l2_freq||"?"} 3-${v.l3_patients||"?"} 4-${v.l4_equip||"N"} 5-${v.l5_detail||"?"} 6-${v.l6_security||"N"} 7-${v.l7_method||"?"} 8-${v.l8_nationality||"?"} 9-${v.l9_nbc||"N"}`,
  },

  MEDEVAC_9LINE: {
    title: "MEDEVAC 9-LINE",
    description: "Full 9-Line Medical Evacuation Request",
    fields: [
      { key: "l1_grid", label: "1. PICKUP LOCATION (GRID)", required: true, options: O.grid },
      { key: "l2_freq", label: "2. RADIO FREQ / CALLSIGN", options: ["34.75 / ALPHA-1", "PRIMARY / TOC", "MEDEVAC / 58.0"] },
      { key: "l3_patients", label: "3. # PATIENTS BY PRECEDENCE", hint: "e.g. 1 Urgent, 2 Priority", options: ["1 Urgent, 0 Priority", "2 Priority", "1 Routine"] },
      { key: "l4_equip", label: "4. SPECIAL EQUIPMENT REQUIRED", options: O.medevacEq },
      { key: "l5_detail", label: "5. # PATIENTS BY TYPE", hint: "Litter / Ambulatory", options: ["2 Litter, 1 Ambulatory", "All ambulatory", "All litter"] },
      { key: "l6_security", label: "6. PICKUP SITE SECURITY", options: O.medevacSec },
      { key: "l7_method", label: "7. METHOD OF MARKING PICKUP SITE", options: O.mark },
      { key: "l8_nationality", label: "8. PATIENT NATIONALITY & STATUS", options: ["US Military", "Coalition", "LN", "Unknown"] },
      { key: "l9_nbc", label: "9. NBC CONTAMINATION", options: O.nbc },
    ],
    build: (v) =>
      `MEDEVAC 9-LINE: 1-${v.l1_grid||"?"} | 2-${v.l2_freq||"?"} | 3-${v.l3_patients||"?"} | 4-${v.l4_equip||"N"} | 5-${v.l5_detail||"?"} | 6-${v.l6_security||"N"} | 7-${v.l7_method||"?"} | 8-${v.l8_nationality||"?"} | 9-${v.l9_nbc||"N"}`,
  },

  FIRE_MISSION: {
    title: "FIRE MISSION",
    description: "Call for indirect fire support",
    fields: [
      { key: "observer", label: "OBSERVER ID / CALLSIGN", required: true, options: ["ALPHA-1", "JTAC-2", "FO BRAVO", "TOC"] },
      { key: "target_grid", label: "TARGET GRID", required: true, options: O.grid },
      { key: "description", label: "TARGET DESCRIPTION", hint: "e.g. Enemy infantry in open, moving NW", required: true, options: ["Enemy infantry in open", "Motorized platoon", "Dismounted squad", "Building / structure"] },
      { key: "method", label: "METHOD OF ENGAGEMENT", hint: "e.g. Fire for effect / Adjust fire", options: O.fireMeth },
      { key: "effect", label: "DESIRED EFFECT", hint: "e.g. Suppress / Destroy / Illuminate", options: O.fireEff },
      { key: "danger_close", label: "DANGER CLOSE?", hint: "YES (with distance) / NO", options: ["NO", "YES — 400m", "YES — danger close approved"] },
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
      { key: "cl1", label: "CLASS I — FOOD/WATER", hint: "e.g. 3 days", options: ["3 days", "24 hrs", "Critical — resupply needed"] },
      { key: "cl3", label: "CLASS III — FUEL", hint: "e.g. 60%", options: ["100%", "75%", "50%", "25% — critical"] },
      { key: "cl5", label: "CLASS V — AMMO", hint: "e.g. 75% basic load", options: ["100% basic load", "75%", "50%", "BLACK on 5.56"] },
      { key: "cl9", label: "CLASS IX — REPAIR PARTS", hint: "e.g. Need 2x track pads M1A2", options: ["NMC — awaiting parts", "Fully mission capable", "2x tires on order"] },
      { key: "casevac", label: "CASEVAC STATUS", hint: "e.g. 0 WIA / 0 KIA", options: O.casevac },
      { key: "equipment", label: "EQUIPMENT DOWN", hint: "e.g. 1x Humvee NMC — alternator", options: ["All green", "1x Humvee NMC", "1x generator down"] },
      { key: "requests", label: "RESUPPLY REQUESTS", multiline: true, options: ["None", "Class V 7.62mm", "Water — 500L", "MREs — 2 days"] },
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
      { key: "subject", label: "SUBJECT", required: true, options: O.flashPri },
      { key: "situation", label: "SITUATION", multiline: true, required: true, options: ["Contact — breaking station", "MEDEVAC launched", "TOC under attack", "Comms degraded"] },
      { key: "action", label: "IMMEDIATE ACTION REQUIRED", multiline: true, required: true, options: ["Acknowledge by net", "Button up — stand to", "Report SITREP to TOC", "Execute FRAGO 01"] },
    ],
    build: (v) =>
      `FLASH — ${v.subject || ""}: SITUATION: ${v.situation || ""} | ACTION REQUIRED: ${v.action || ""}`,
  },

  CONTACT_REPORT: {
    title: "CONTACT REPORT",
    description: "Initial enemy contact report",
    fields: [
      { key: "time", label: "TIME OF CONTACT", hint: "e.g. 0142L", required: true, options: O.time },
      { key: "location", label: "YOUR LOCATION (GRID)", required: true, options: O.grid },
      { key: "enemy_loc", label: "ENEMY LOCATION (GRID / DIRECTION)", required: true, options: ["200m north", "Across wadi east", ...O.grid] },
      { key: "description", label: "ENEMY DESCRIPTION", hint: "Size, weapons, uniforms", required: true, options: ["Squad — small arms", "Mounted patrol — PKM", "Sniper team suspected", "Unknown strength"] },
      { key: "action", label: "FRIENDLY ACTION TAKEN", hint: "e.g. Returned fire, breaking contact", options: ["Returned fire", "Breaking contact", "Fixing — awaiting orders", "No engagement"] },
      { key: "casualties", label: "FRIENDLY CASUALTIES", hint: "e.g. 1 WIA, no KIA", options: ["None", "1 WIA", "1 KIA", "Multiple WIA"] },
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
      { key: "what", label: "WHAT WAS OBSERVED", required: true, options: ["Vehicle movement", "Dismounted personnel", "Aircraft", "Indirect fire", "Nothing significant"] },
      { key: "location", label: "LOCATION (GRID)", required: true, options: O.grid },
      { key: "time", label: "TIME", hint: "e.g. 0215L", options: O.time },
      { key: "details", label: "ADDITIONAL DETAILS", multiline: true, options: ["Observed 5 min", "Continuing to monitor", "Lost visual"] },
    ],
    build: (v) =>
      `SPOT REPORT: ${v.what || ""} at ${v.location || "UNK"} at ${v.time || "UNK"}${v.details ? " — " + v.details : ""}`,
  },
};

function TemplateFieldRow({
  field,
  value,
  setVals,
}: {
  field: Field;
  value: string;
  setVals: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const dlId = useId();
  const presetRef = useRef<HTMLSelectElement>(null);
  const setKey = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setVals(v => ({ ...v, [key]: e.target.value }));

  const applyPreset = (raw: string) => {
    if (!raw) return;
    setVals(s => ({ ...s, [field.key]: raw }));
    if (presetRef.current) presetRef.current.selectedIndex = 0;
  };

  return (
    <div className={field.multiline ? "col-span-2" : ""}>
      <label className={`text-[9px] tracking-wider block mb-1 ${field.required ? "text-green-400/80" : "text-muted-foreground"}`}>
        {field.label}{field.required && <span className="text-green-400/60 ml-1">(key field)</span>}
      </label>
      {field.options && field.options.length > 0 && field.multiline && (
        <select
          ref={presetRef}
          className="mb-1 w-full h-8 rounded-md border border-input bg-secondary text-[10px] px-2 text-foreground touch-manipulation"
          defaultValue=""
          onChange={e => applyPreset(e.target.value)}
          aria-label={`${field.label} quick presets`}
        >
          <option value="">Preset or type below…</option>
          {field.options.map(o => (
            <option key={o} value={o}>{o.length > 56 ? `${o.slice(0, 53)}…` : o}</option>
          ))}
        </select>
      )}
      {field.multiline ? (
        <Textarea
          value={value}
          onChange={setKey(field.key)}
          placeholder={field.hint || ""}
          className="text-[10px] min-h-[3.25rem] font-mono touch-manipulation"
        />
      ) : field.options && field.options.length > 0 ? (
        <>
          <Input
            value={value}
            onChange={setKey(field.key)}
            placeholder={field.hint || "Type or choose suggestion"}
            className="text-[10px] h-8 font-mono touch-manipulation"
            list={dlId}
          />
          <datalist id={dlId}>
            {field.options.map(o => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </>
      ) : (
        <Input
          value={value}
          onChange={setKey(field.key)}
          placeholder={field.hint || ""}
          className="text-[10px] h-8 font-mono touch-manipulation"
        />
      )}
    </div>
  );
}

// ── Format template panel ─────────────────────────────────────────────────────
function FormatTemplate({ type, onFill }: { type: string; onFill: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => { setVals({}); }, [type]);
  const tmpl = TEMPLATES[type];

  if (!tmpl) return null;

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
        <div className="flex flex-col min-[380px]:flex-row min-[380px]:items-center gap-0.5 sm:gap-2 text-left min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <FileText size={10} className="shrink-0" />
            <span className="font-bold">{tmpl.title} FORMAT</span>
          </div>
          <span className="text-muted-foreground/60 normal-case text-[9px] leading-tight">{tmpl.description}</span>
        </div>
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>

      {open && (
        <div className="bg-secondary/20 border-t border-border p-3 space-y-2">
          <div className="text-[9px] text-muted-foreground/60 tracking-wider mb-2">
            Use presets from the menu or type freely (datalist suggestions on single-line fields). Multiline fields: preset fills the box — edit as needed.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tmpl.fields.map(f => (
              <TemplateFieldRow key={f.key} field={f} value={vals[f.key] || ""} setVals={setVals} />
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
    <div className="p-3 md:p-4 tac-page">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>COMMUNICATIONS CENTER</h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">
            {unacked > 0 ? <span className="text-yellow-400">{unacked} UNACKNOWLEDGED</span> : "ALL MESSAGES ACK'D"} ▪ {comms.length} TOTAL MSGS
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">

        {/* Compose */}
        <div className="md:col-span-5 bg-card border border-border rounded">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Radio size={11} className="text-green-400" />
            <span className="text-[10px] font-bold tracking-[0.15em] text-green-400">COMPOSE MESSAGE</span>
          </div>
          <div className="p-3 space-y-2.5">
            {/* From / To */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
        <div className="md:col-span-7 bg-card border border-border rounded min-h-0 flex flex-col">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 py-2 border-b border-border shrink-0">
            <span className="text-[10px] font-bold tracking-[0.15em] text-green-400 shrink-0">MESSAGE LOG</span>
            <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
              <div className="tac-filter-row sm:flex-wrap sm:overflow-visible">
                {["ALL", ...CHANNELS].map(ch => (
                  <button key={ch} onClick={() => setFilterChan(ch)}
                    className={`text-[9px] px-2 py-0.5 rounded tracking-wider transition-all ${filterChan === ch ? "bg-green-900 text-green-400 border border-green-800" : "text-muted-foreground bg-secondary hover:text-foreground"}`}>
                    {ch}
                  </button>
                ))}
              </div>
              {isOwner && (
                confirmClear ? (
                  <div className="flex items-center gap-1 flex-wrap shrink-0">
                    <span className="text-[9px] text-red-400 tracking-wider">CLEAR ALL?</span>
                    <button onClick={() => clearLog.mutate()} className="text-[9px] bg-red-900/60 border border-red-800/50 text-red-300 px-2 py-0.5 rounded hover:bg-red-800 tracking-wider">CONFIRM</button>
                    <button onClick={() => setConfirmClear(false)} className="text-[9px] text-muted-foreground hover:text-foreground px-1">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmClear(true)}
                    className="text-[9px] text-red-400/60 hover:text-red-400 flex items-center gap-1 tracking-wider transition-colors shrink-0" title="Clear entire log">
                    <Trash2 size={9} /> CLEAR LOG
                  </button>
                )
              )}
            </div>
          </div>
          <div className="divide-y divide-border overflow-y-auto min-h-0 max-h-[min(28rem,calc(100dvh-14rem))] md:max-h-[calc(100vh-220px)]">
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
