import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Unit, Operation, IntelReport, CommsLog, Asset, Threat } from "@shared/schema";
import { Clock, Activity, AlertTriangle, Radio, Shield, Package, Zap, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  const z = time.getUTCHours();
  return (
    <div className="text-right">
      <div className="kpi-value text-lg">{pad(z)}{pad(time.getUTCMinutes())}{pad(time.getUTCSeconds())}Z</div>
      <div className="text-[10px] text-muted-foreground tracking-widest">
        {time.toUTCString().slice(0, 16).toUpperCase()}
      </div>
    </div>
  );
}

function KPICard({ label, value, sub, color = "text-green-400", alert = false }: { label: string; value: string | number; sub?: string; color?: string; alert?: boolean }) {
  return (
    <div className={`bg-card border rounded p-3 ${alert ? "border-red-800/60 tactical-active" : "border-border"}`}>
      <div className="text-[10px] text-muted-foreground tracking-[0.12em] mb-1">{label}</div>
      <div className={`kpi-value text-xl ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function ThreatLevel({ level }: { level: "LOW" | "GUARDED" | "ELEVATED" | "HIGH" | "SEVERE" }) {
  const colors: Record<string, string> = {
    LOW: "bg-green-500", GUARDED: "bg-blue-500",
    ELEVATED: "bg-yellow-500", HIGH: "bg-orange-500", SEVERE: "bg-red-500",
  };
  const levels = ["LOW", "GUARDED", "ELEVATED", "HIGH", "SEVERE"];
  const idx = levels.indexOf(level);
  return (
    <div className="bg-card border border-border rounded p-3">
      <div className="text-[10px] text-muted-foreground tracking-[0.12em] mb-2">THREAT LEVEL</div>
      <div className="flex gap-1 items-end mb-1">
        {levels.map((l, i) => (
          <div key={l} className={`flex-1 rounded-sm transition-all ${i <= idx ? colors[l] : "bg-secondary"}`}
            style={{ height: `${(i + 1) * 6 + 6}px` }} />
        ))}
      </div>
      <div className={`text-xs font-bold tracking-widest ${
        level === "SEVERE" ? "text-red-400" :
        level === "HIGH" ? "text-orange-400" :
        level === "ELEVATED" ? "text-yellow-400" :
        "text-green-400"
      }`}>{level}</div>
    </div>
  );
}

export default function Dashboard() {
  const { data: units = [] } = useQuery<Unit[]>({ queryKey: ["/api/units"], queryFn: () => apiRequest("GET", "/api/units") });
  const { data: ops = [] } = useQuery<Operation[]>({ queryKey: ["/api/operations"], queryFn: () => apiRequest("GET", "/api/operations") });
  const { data: intel = [] } = useQuery<IntelReport[]>({ queryKey: ["/api/intel"], queryFn: () => apiRequest("GET", "/api/intel") });
  const { data: comms = [] } = useQuery<CommsLog[]>({ queryKey: ["/api/comms"], queryFn: () => apiRequest("GET", "/api/comms") });
  const { data: assets = [] } = useQuery<Asset[]>({ queryKey: ["/api/assets"], queryFn: () => apiRequest("GET", "/api/assets") });
  const { data: threatsRaw = [] } = useQuery<Threat[]>({ queryKey: ["/api/threats"], queryFn: () => apiRequest("GET", "/api/threats") });
  const threats: Threat[] = threatsRaw;

  const activeOps = ops.filter(o => o.status === "active").length;
  const activeUnits = units.filter(u => u.status === "active").length;
  const criticalIntel = intel.filter(r => r.threat === "critical").length;
  const unackComms = comms.filter(c => !c.acknowledged).length;
  const opAssets = assets.filter(a => a.status === "operational").length;
  const activeThreats = threats.filter(t => t.active).length;
  const criticalThreats = threats.filter(t => t.active && t.confidence === "confirmed").length;
  const totalPax = units.reduce((acc, u) => acc + u.pax, 0);

  const threatLevel = criticalThreats >= 3 ? "SEVERE" : criticalThreats >= 2 ? "HIGH" : activeThreats >= 3 ? "ELEVATED" : "GUARDED";

  const recentComms = comms.slice(0, 5);
  const recentIntel = intel.slice(0, 4);

  const priorityColor: Record<string, string> = {
    flash: "text-red-400", immediate: "text-orange-400",
    priority: "text-yellow-400", routine: "text-muted-foreground",
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em] text-green-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            TACTICAL OPERATIONS CENTER
          </h1>
          <div className="text-[10px] text-muted-foreground tracking-widest">SECTOR ALPHA // COMBINED ARMS TEAM</div>
        </div>
        <LiveClock />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-2 xl:grid-cols-8">
        <KPICard label="ACTIVE OPS" value={activeOps} sub={`${ops.length} total`} color={activeOps > 0 ? "text-green-400" : "text-muted-foreground"} />
        <KPICard label="ACTIVE UNITS" value={activeUnits} sub={`${totalPax} PAX`} />
        <KPICard label="CRIT INTEL" value={criticalIntel} color={criticalIntel > 0 ? "text-red-400" : "text-green-400"} alert={criticalIntel > 0} sub="unverified rpts" />
        <KPICard label="UNACK COMMS" value={unackComms} color={unackComms > 0 ? "text-yellow-400" : "text-green-400"} />
        <KPICard label="ASSETS OP" value={`${opAssets}/${assets.length}`} sub="operational" />
        <KPICard label="ACT THREATS" value={activeThreats} color={activeThreats > 0 ? "text-orange-400" : "text-green-400"} alert={criticalThreats > 0} />
        <KPICard label="CONFIRMED" value={criticalThreats} color={criticalThreats > 0 ? "text-red-400" : "text-green-400"} sub="threats" />
        <ThreatLevel level={threatLevel as any} />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-3">

        {/* Ops Status */}
        <div className="col-span-5 bg-card border border-border rounded">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Activity size={11} className="text-green-400" />
            <span className="text-[10px] font-bold tracking-[0.15em] text-green-400">OPERATIONS STATUS</span>
          </div>
          <div className="divide-y divide-border">
            {ops.length === 0 && <div className="px-3 py-4 text-xs text-muted-foreground text-center">NO OPS IN QUEUE</div>}
            {ops.map(op => (
              <div key={op.id} className="px-3 py-2 hover:bg-secondary/30 transition-colors" data-testid={`op-row-${op.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`badge-${op.status} text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase`}>{op.status}</span>
                      <span className={`badge-${op.priority} text-[9px] px-1.5 py-0.5 rounded tracking-wider uppercase`}>{op.priority}</span>
                    </div>
                    <div className="text-xs font-bold tracking-wider text-foreground truncate">{op.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate mt-0.5">{op.objective}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="grid-coord">{op.grid.slice(-11)}</div>
                    <div className="text-[9px] text-muted-foreground uppercase mt-0.5">{op.type}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Units Board */}
        <div className="col-span-4 bg-card border border-border rounded">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Shield size={11} className="text-green-400" />
            <span className="text-[10px] font-bold tracking-[0.15em] text-green-400">UNIT STATUS BOARD</span>
          </div>
          <div className="divide-y divide-border">
            {units.map(u => (
              <div key={u.id} className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-secondary/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`badge-${u.status} text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase`}>{u.status}</span>
                    <span className="text-xs font-bold text-foreground">{u.callsign}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground capitalize mt-0.5">{u.type} ▪ {u.commander}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="kpi-value text-xs">{u.pax}<span className="text-[9px] text-muted-foreground ml-0.5">PAX</span></div>
                  <div className="grid-coord text-[10px]">{u.grid.slice(-9)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Threats */}
        <div className="col-span-3 bg-card border border-border rounded">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <AlertTriangle size={11} className="text-red-400" />
            <span className="text-[10px] font-bold tracking-[0.15em] text-red-400">THREAT BOARD</span>
          </div>
          <div className="divide-y divide-border">
            {threats.filter(t => t.active).slice(0, 5).map(t => (
              <div key={t.id} className="px-3 py-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className={`badge-${t.confidence} text-[9px] px-1 py-0.5 rounded font-bold tracking-wider uppercase`}>{t.confidence}</span>
                </div>
                <div className="text-[11px] font-bold text-foreground leading-tight">{t.label}</div>
                <div className="text-[10px] text-muted-foreground">{t.category.replace(/_/g, " ").toUpperCase()}</div>
                <div className="grid-coord text-[10px] mt-0.5">{t.grid.slice(-9)}</div>
              </div>
            ))}
            {threats.filter(t => t.active).length === 0 && (
              <div className="px-3 py-4 text-[11px] text-green-400 text-center tracking-wider">NO ACTIVE THREATS</div>
            )}
          </div>
        </div>

        {/* Recent Comms */}
        <div className="col-span-6 bg-card border border-border rounded">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Radio size={11} className="text-green-400" />
            <span className="text-[10px] font-bold tracking-[0.15em] text-green-400">COMMS LOG — RECENT</span>
          </div>
          <div className="divide-y divide-border">
            {recentComms.map(c => (
              <div key={c.id} className={`px-3 py-2 ${!c.acknowledged ? "bg-yellow-950/10" : ""}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`badge-${c.priority} text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase`}>{c.priority}</span>
                  <span className="text-[10px] font-bold text-green-400">{c.fromCallsign}</span>
                  <span className="text-[9px] text-muted-foreground">→</span>
                  <span className="text-[10px] text-muted-foreground">{c.toCallsign}</span>
                  <span className="text-[9px] text-muted-foreground ml-auto">[{c.channel}]</span>
                  {!c.acknowledged && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />}
                </div>
                <div className="text-[11px] text-foreground leading-snug line-clamp-2">{c.message}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Intel Summary */}
        <div className="col-span-6 bg-card border border-border rounded">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <TrendingUp size={11} className="text-green-400" />
            <span className="text-[10px] font-bold tracking-[0.15em] text-green-400">INTEL SUMMARY</span>
          </div>
          <div className="divide-y divide-border">
            {recentIntel.map(r => (
              <div key={r.id} className="px-3 py-2">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`badge-${r.classification.toLowerCase()} text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider`}>{r.classification}</span>
                  <span className={`badge-${r.threat} text-[9px] px-1.5 py-0.5 rounded tracking-wider uppercase`}>{r.threat}</span>
                  <span className="text-[9px] text-muted-foreground ml-auto">{r.category}</span>
                </div>
                <div className="text-[11px] font-bold text-foreground">{r.title}</div>
                <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{r.summary}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
