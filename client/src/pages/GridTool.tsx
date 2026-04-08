import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Unit, Threat } from "@shared/schema";
import { MapPin, Plus, Trash2, Copy, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Marker {
  id: string;
  label: string;
  grid: string;
  type: "friendly" | "enemy" | "objective" | "waypoint" | "extraction";
  notes: string;
}

const MARKER_CONFIG: Record<string, { color: string; symbol: string; label: string }> = {
  friendly:   { color: "text-blue-400",  symbol: "▲", label: "FRIENDLY" },
  enemy:      { color: "text-red-400",    symbol: "✕", label: "ENEMY" },
  objective:  { color: "text-yellow-400", symbol: "★", label: "OBJECTIVE" },
  waypoint:   { color: "text-blue-400",   symbol: "◆", label: "WAYPOINT" },
  extraction: { color: "text-orange-400", symbol: "⬡", label: "EXFIL/EXF" },
};

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <button onClick={copy} className="p-1 text-muted-foreground hover:text-blue-400 transition-colors" title="Copy grid">
      {copied ? <CheckCheck size={11} className="text-blue-400" /> : <Copy size={11} />}
    </button>
  );
}

export default function GridTool() {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [form, setForm] = useState({ label: "", grid: "", type: "waypoint" as Marker["type"], notes: "" });
  const [mgrs, setMgrs] = useState("");
  const [calcResult, setCalcResult] = useState("");

  const { data: units = [] } = useQuery<Unit[]>({ queryKey: ["/api/units"], queryFn: () => apiRequest("GET", "/api/units") });
  const { data: threats = [] } = useQuery<Threat[]>({ queryKey: ["/api/threats"], queryFn: () => apiRequest("GET", "/api/threats") });

  const addMarker = () => {
    if (!form.label || !form.grid) return;
    setMarkers(m => [...m, { ...form, id: Date.now().toString() }]);
    setForm(f => ({ ...f, label: "", grid: "", notes: "" }));
  };

  const removeMarker = (id: string) => setMarkers(m => m.filter(x => x.id !== id));

  // Simple MGRS formatter — pads and formats user input
  const formatMGRS = (raw: string) => {
    const clean = raw.toUpperCase().replace(/\s+/g, " ").trim();
    setMgrs(clean);
    setCalcResult(clean ? `FORMATTED: ${clean}` : "");
  };

  // Pull units and threats as quick-add references
  const unitRefs = units.map(u => ({ label: u.callsign, grid: u.grid, type: "friendly" as const }));
  const threatRefs = threats.filter(t => t.active).map(t => ({ label: t.label, grid: t.grid, type: "enemy" as const }));

  return (
    <div className="p-3 md:p-4 tac-page">
      <div className="mb-3">
        <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>GRID REFERENCE TOOL</h1>
        <div className="text-[10px] text-muted-foreground tracking-wider">MGRS COORDINATE MANAGER ▪ MARKER BOARD</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: add marker form */}
        <div className="space-y-3">
          <div className="bg-card border border-border rounded p-3">
            <div className="text-[10px] text-muted-foreground tracking-widest mb-3">ADD GRID MARKER</div>
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] tracking-wider">LABEL *</Label>
                  <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value.toUpperCase() }))}
                    placeholder="OBJ ALPHA" className="text-xs font-mono uppercase" />
                </div>
                <div>
                  <Label className="text-[10px] tracking-wider">TYPE</Label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as Marker["type"] }))}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MARKER_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.symbol} {v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-[10px] tracking-wider">MGRS GRID *</Label>
                <Input value={form.grid} onChange={e => setForm(f => ({ ...f, grid: e.target.value.toUpperCase() }))}
                  placeholder="38T LP 48210 73340" className="text-xs font-mono uppercase" />
              </div>
              <div>
                <Label className="text-[10px] tracking-wider">NOTES</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional description" className="text-xs" />
              </div>
              <Button size="sm" className="w-full bg-blue-800 hover:bg-blue-700 text-xs tracking-wider gap-1" onClick={addMarker}>
                <Plus size={12} /> ADD MARKER
              </Button>
            </div>
          </div>

          {/* MGRS formatter */}
          <div className="bg-card border border-border rounded p-3">
            <div className="text-[10px] text-muted-foreground tracking-widest mb-2">MGRS FORMATTER / VALIDATOR</div>
            <Input value={mgrs} onChange={e => formatMGRS(e.target.value)}
              placeholder="Paste or type MGRS..." className="text-xs font-mono uppercase" />
            {calcResult && (
              <div className="mt-2 flex items-center justify-between">
                <div className="text-[11px] font-mono text-blue-400">{calcResult}</div>
                <CopyBtn value={mgrs} />
              </div>
            )}
          </div>

          {/* Quick ref from Units / Threats */}
          {(unitRefs.length > 0 || threatRefs.length > 0) && (
            <div className="bg-card border border-border rounded p-3">
              <div className="text-[10px] text-muted-foreground tracking-widest mb-2">QUICK REFERENCE — LIVE DATA</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {unitRefs.map(r => (
                  <div key={r.label} className="flex items-center justify-between text-[10px] py-0.5">
                    <span className="text-blue-400 font-bold">▲ {r.label}</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-muted-foreground">{r.grid}</span>
                      <CopyBtn value={r.grid} />
                      <button onClick={() => setForm(f => ({ ...f, label: r.label, grid: r.grid, type: "friendly" }))}
                        className="text-[9px] text-muted-foreground hover:text-foreground px-1 py-0.5 bg-secondary rounded">USE</button>
                    </div>
                  </div>
                ))}
                {threatRefs.map(r => (
                  <div key={r.label} className="flex items-center justify-between text-[10px] py-0.5">
                    <span className="text-red-400 font-bold">✕ {r.label}</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-muted-foreground">{r.grid}</span>
                      <CopyBtn value={r.grid} />
                      <button onClick={() => setForm(f => ({ ...f, label: r.label, grid: r.grid, type: "enemy" }))}
                        className="text-[9px] text-muted-foreground hover:text-foreground px-1 py-0.5 bg-secondary rounded">USE</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: marker board */}
        <div className="bg-card border border-border rounded p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] text-muted-foreground tracking-widest">MARKER BOARD</div>
            <div className="text-[10px] text-muted-foreground">{markers.length} MARKERS</div>
          </div>

          {markers.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-xs">
              <MapPin size={24} className="mx-auto mb-2 opacity-30" />
              NO MARKERS — ADD GRIDS FROM THE LEFT PANEL
            </div>
          )}

          <div className="space-y-1.5">
            {markers.map(m => {
              const cfg = MARKER_CONFIG[m.type];
              return (
                <div key={m.id} className="flex items-center justify-between px-2 py-2 bg-secondary/30 rounded border border-border hover:border-blue-900/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-base leading-none shrink-0 ${cfg.color}`}>{cfg.symbol}</span>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold font-mono truncate">{m.label}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{m.grid}</div>
                      {m.notes && <div className="text-[9px] text-muted-foreground/60 truncate">{m.notes}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <span className={`text-[9px] font-bold tracking-wider ${cfg.color}`}>{cfg.label}</span>
                    <CopyBtn value={m.grid} />
                    <button onClick={() => removeMarker(m.id)} className="p-1 text-muted-foreground hover:text-red-400">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {markers.length > 0 && (
            <button onClick={() => setMarkers([])} className="mt-3 text-[10px] text-muted-foreground hover:text-red-400 transition-colors">
              CLEAR ALL MARKERS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
