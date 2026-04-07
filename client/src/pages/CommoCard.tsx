import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Radio, Shield, Lock, ChevronDown, ChevronUp, Plus, Trash2, CheckCircle, Edit, Copy, Check } from "lucide-react";
import type { CommoCard } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

// ── Types matching the JSON stored in DB ─────────────────────────────────────
interface Net { label: string; freq: string; callsigns?: string; notes?: string; tdl?: string; }
interface RangerNets {
  label: string; color: string; encrypted: boolean;
  primaryKey: string; primaryTdl: string; backupKey: string; backupTdl: string;
  nets: Net[];
}
interface Keycall { word: string; meaning: string; externalOnly: boolean; }

function parseJSON<T>(str: string, fallback: T): T {
  try { return JSON.parse(str); } catch { return fallback; }
}

// ── Small copy button ─────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); };
  return (
    <button onClick={copy} className="ml-1 text-muted-foreground/50 hover:text-green-400 transition-colors">
      {done ? <Check size={9} className="text-green-400" /> : <Copy size={9} />}
    </button>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────
function Divider() {
  return <div className="border-t border-dashed border-border/60 my-3 flex items-center gap-2">
    <span className="text-[9px] text-muted-foreground/30 tracking-widest">──────────────</span>
  </div>;
}

// ── Crypto block ──────────────────────────────────────────────────────────────
function CryptoBlock({ card }: { card: CommoCard }) {
  return (
    <div className="bg-red-950/10 border border-red-900/30 rounded p-3">
      <div className="flex items-center gap-2 mb-2">
        <Lock size={10} className="text-red-400" />
        <span className="text-[9px] font-bold tracking-[0.2em] text-red-400">CRYPTO</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px]">Key:</span>
          <span className="font-bold text-red-300 tracking-wider">{card.primaryKey}<CopyBtn text={card.primaryKey} /></span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px]">TDL:</span>
          <span className="text-foreground/80 text-[10px]">{card.primaryTdl}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px]">Backup Key:</span>
          <span className="font-bold text-red-300 tracking-wider">{card.backupKey}<CopyBtn text={card.backupKey} /></span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px]">TDL:</span>
          <span className="text-foreground/80 text-[10px]">{card.backupTdl}</span>
        </div>
      </div>
    </div>
  );
}

// ── Nets table ────────────────────────────────────────────────────────────────
function NetsTable({ nets }: { nets: Net[] }) {
  return (
    <div className="rounded border border-border overflow-hidden overflow-x-auto max-w-full">
      <table className="w-full text-xs min-w-[520px]">
        <thead>
          <tr className="bg-secondary/50 border-b border-border text-[9px] text-muted-foreground tracking-[0.15em]">
            <th className="text-left px-3 py-1.5">NET / CHANNEL</th>
            <th className="text-center px-3 py-1.5">FREQ (mHz)</th>
            <th className="text-left px-3 py-1.5">CALLSIGNS / STATIONS</th>
            <th className="text-left px-3 py-1.5">NOTES</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {nets.map((net, i) => {
            const isConvoy = !net.freq;
            const isAirNet = ["ATG", "Inter-Ship", "Ship 1", "Ship 2"].includes(net.label);
            const isMedSuas = ["MEDICAL", "sUAS OPS"].includes(net.label);
            return (
              <tr key={i} className={`transition-colors hover:bg-secondary/20 ${isAirNet ? "bg-blue-950/10" : ""} ${isMedSuas ? "bg-green-950/10" : ""} ${isConvoy ? "bg-yellow-950/10" : ""}`}>
                <td className="px-3 py-1.5">
                  <span className={`font-bold tracking-wider text-[10px] ${
                    isAirNet ? "text-blue-400" :
                    isMedSuas ? "text-green-400" :
                    isConvoy ? "text-yellow-400" :
                    "text-foreground"
                  }`}>{net.label}</span>
                </td>
                <td className="px-3 py-1.5 text-center">
                  {net.freq ? (
                    <div className="flex items-center justify-center gap-1">
                      <span className="kpi-value text-sm text-green-400">{net.freq}</span>
                      <CopyBtn text={net.freq} />
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-[9px]">—</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-[10px] text-muted-foreground">
                  {net.callsigns || "—"}
                </td>
                <td className="px-3 py-1.5 text-[10px] text-muted-foreground/70 italic">
                  {net.notes || ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Ranger Nets block ─────────────────────────────────────────────────────────
function RangerNetsBlock({ data }: { data: RangerNets }) {
  return (
    <div className="bg-red-950/15 border border-red-900/40 rounded overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-red-900/30 bg-red-950/20">
        <Shield size={11} className="text-red-400" />
        <span className="text-[10px] font-bold tracking-[0.2em] text-red-400">
          {data.label} ({data.color}) — ENCRYPTED
        </span>
        <Lock size={9} className="text-red-400/60" />
      </div>
      {/* Ranger crypto */}
      <div className="px-3 py-2 border-b border-red-900/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 text-[10px] font-mono">
        <div><span className="text-muted-foreground">Key: </span><span className="font-bold text-red-300 tracking-wider">{data.primaryKey}</span></div>
        <div><span className="text-muted-foreground">TDL: </span><span className="text-foreground/80">{data.primaryTdl}</span></div>
        <div><span className="text-muted-foreground">Backup: </span><span className="font-bold text-red-300 tracking-wider">{data.backupKey}</span></div>
        <div><span className="text-muted-foreground">Backup: </span><span className="text-foreground/80">{data.backupTdl}</span></div>
      </div>
      {/* Ranger net table */}
      <div className="overflow-x-auto max-w-full">
      <table className="w-full text-xs min-w-[320px]">
        <thead>
          <tr className="bg-red-950/20 border-b border-red-900/20 text-[9px] text-red-400/70 tracking-[0.15em]">
            <th className="text-left px-3 py-1.5">NET</th>
            <th className="text-center px-3 py-1.5">FREQ</th>
            <th className="text-left px-3 py-1.5">TDL</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-red-900/20">
          {data.nets.map((net, i) => {
            const isMedevac = net.label === "MEDEVAC";
            const isCsar = net.label === "CSAR" || net.label === "CAS";
            return (
              <tr key={i} className={`hover:bg-red-950/10 transition-colors ${isMedevac ? "bg-green-950/10" : ""} ${isCsar ? "bg-blue-950/10" : ""}`}>
                <td className="px-3 py-1 font-bold tracking-wider text-[10px] text-foreground/90">{net.label}</td>
                <td className="px-3 py-1 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="kpi-value text-sm text-red-300">{net.freq}</span>
                    <CopyBtn text={net.freq} />
                  </div>
                </td>
                <td className="px-3 py-1 text-[10px] text-muted-foreground font-mono">{net.tdl || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// ── Keycalls block ────────────────────────────────────────────────────────────
function KeycallsBlock({ keycalls, theme, note }: { keycalls: Keycall[]; theme?: string; note?: string }) {
  return (
    <div className="rounded border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/50 border-b border-border">
        <div className="flex items-center gap-2">
          <Radio size={10} className="text-yellow-400" />
          <span className="text-[9px] font-bold tracking-[0.2em] text-yellow-400">KEYCALLS</span>
          {theme && <span className="text-[9px] text-muted-foreground/60">— {theme}</span>}
        </div>
      </div>
      <div className="overflow-x-auto max-w-full">
      <table className="w-full text-xs min-w-[340px]">
        <thead>
          <tr className="border-b border-border text-[9px] text-muted-foreground tracking-[0.15em]">
            <th className="text-left px-3 py-1.5">KEYCALL WORD</th>
            <th className="text-left px-3 py-1.5">MEANING / ACTION</th>
            <th className="text-center px-3 py-1.5">SCOPE</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {keycalls.map((kc, i) => (
            <tr key={i} className={`hover:bg-secondary/20 transition-colors ${!kc.externalOnly ? "bg-yellow-950/10" : ""}`}>
              <td className="px-3 py-1.5">
                <div className="flex items-center gap-1">
                  <span className={`font-bold font-mono tracking-[0.15em] text-sm ${kc.externalOnly ? "text-foreground" : "text-yellow-400"}`}>
                    {kc.word}
                  </span>
                  <CopyBtn text={kc.word} />
                </div>
              </td>
              <td className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground tracking-wider">{kc.meaning}</td>
              <td className="px-3 py-1.5 text-center">
                {kc.externalOnly
                  ? <span className="text-[9px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded tracking-wider">EXTERNAL</span>
                  : <span className="text-[9px] text-yellow-400 bg-yellow-950/30 border border-yellow-900/40 px-1.5 py-0.5 rounded tracking-wider">ALL USE</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {note && (
        <div className="px-3 py-2 border-t border-border bg-secondary/20 text-[9px] text-yellow-400/70 tracking-wider italic">
          ⚠ {note}
        </div>
      )}
    </div>
  );
}

// ── Full card view ────────────────────────────────────────────────────────────
function CardView({ card }: { card: CommoCard }) {
  const nets = parseJSON<Net[]>(card.nets, []);
  const rangerNets = parseJSON<RangerNets | null>(card.rangerNets, null);
  const keycalls = parseJSON<Keycall[]>(card.keycalls, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between pb-3 border-b border-dashed border-border/60">
        <div>
          <h2 className="text-base font-bold tracking-[0.15em] text-green-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            {card.title}
          </h2>
          <div className="text-[9px] text-muted-foreground tracking-widest mt-0.5">EFF: {card.effectiveDate} ▪ CLASSIFICATION: RESTRICTED</div>
        </div>
        {card.active && (
          <span className="badge-active text-[9px] px-2 py-1 rounded font-bold tracking-wider flex items-center gap-1">
            <CheckCircle size={9} /> ACTIVE
          </span>
        )}
      </div>

      {/* Crypto */}
      <CryptoBlock card={card} />

      <Divider />

      {/* Primary Nets */}
      <div>
        <div className="text-[9px] font-bold tracking-[0.2em] text-muted-foreground mb-2">PRIMARY NETS</div>
        <NetsTable nets={nets} />
      </div>

      <Divider />

      {/* Ranger Nets */}
      {rangerNets && rangerNets.nets?.length > 0 && (
        <div>
          <RangerNetsBlock data={rangerNets} />
        </div>
      )}

      <Divider />

      {/* Keycalls */}
      {keycalls.length > 0 && (
        <KeycallsBlock keycalls={keycalls} theme={card.keycallTheme || ""} note={card.keycallNote || ""} />
      )}
    </div>
  );
}

// ── Create/Edit Card form (admin+) ────────────────────────────────────────────
function CreateCardForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: "", effectiveDate: "",
    primaryKey: "", primaryTdl: "Same",
    backupKey: "", backupTdl: "Same",
    nets: "", rangerNets: "", keycalls: "",
    keycallTheme: "", keycallNote: "",
  });

  const create = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/commo-cards", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/commo-cards"] }); toast({ title: "Commo card created" }); onClose(); },
    onError: () => toast({ title: "Failed to create card", variant: "destructive" }),
  });

  const submit = () => {
    if (!form.title || !form.effectiveDate) { toast({ title: "Title and date required", variant: "destructive" }); return; }
    create.mutate({
      ...form,
      nets: form.nets || "[]",
      rangerNets: form.rangerNets || "{}",
      keycalls: form.keycalls || "[]",
      active: false,
      createdBy: user?.username,
    });
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-1 sm:col-span-2"><Label className="text-[9px] tracking-wider">CARD TITLE *</Label>
          <Input placeholder="COMMO CARD - 24FEB2026" value={form.title} onChange={set("title")} className="text-xs font-mono uppercase" /></div>
        <div><Label className="text-[9px] tracking-wider">EFFECTIVE DATE *</Label>
          <Input placeholder="24FEB2026" value={form.effectiveDate} onChange={set("effectiveDate")} className="text-xs font-mono uppercase" /></div>
        <div />
        <div><Label className="text-[9px] tracking-wider">PRIMARY KEY</Label>
          <Input placeholder="ANUB" value={form.primaryKey} onChange={set("primaryKey")} className="text-xs font-mono uppercase tracking-widest" /></div>
        <div><Label className="text-[9px] tracking-wider">PRIMARY TDL</Label>
          <Input placeholder="Same" value={form.primaryTdl} onChange={set("primaryTdl")} className="text-xs font-mono" /></div>
        <div><Label className="text-[9px] tracking-wider">BACKUP KEY</Label>
          <Input placeholder="AMON" value={form.backupKey} onChange={set("backupKey")} className="text-xs font-mono uppercase tracking-widest" /></div>
        <div><Label className="text-[9px] tracking-wider">BACKUP TDL</Label>
          <Input placeholder="Same" value={form.backupTdl} onChange={set("backupTdl")} className="text-xs font-mono" /></div>
      </div>
      <div className="bg-secondary/30 rounded p-2 text-[9px] text-muted-foreground/70 leading-relaxed">
        For Nets, Ranger Nets, and Keycalls — paste JSON arrays. Leave blank to add later. Contact your admin for format help.
      </div>
      <div><Label className="text-[9px] tracking-wider">NETS JSON (optional)</Label>
        <Textarea placeholder='[{"label":"ATG","freq":"49.0","callsigns":"Gypsy Flight"}]' value={form.nets} onChange={set("nets")} className="text-[10px] h-20 font-mono" /></div>
      <div><Label className="text-[9px] tracking-wider">KEYCALL THEME</Label>
        <Input placeholder="Egyptian Mythology Theme" value={form.keycallTheme} onChange={set("keycallTheme")} className="text-xs" /></div>
      <div><Label className="text-[9px] tracking-wider">KEYCALL NOTE</Label>
        <Input placeholder="All Keycalls except BROKEN CRYPTO are external use only." value={form.keycallNote} onChange={set("keycallNote")} className="text-xs" /></div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" size="sm" onClick={onClose} className="text-xs">CANCEL</Button>
        <Button size="sm" onClick={submit} className="text-xs bg-green-800 hover:bg-green-700" disabled={create.isPending}>CREATE CARD</Button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CommoCardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const { data: cards = [] } = useQuery<CommoCard[]>({
    queryKey: ["/api/commo-cards"],
    queryFn: () => apiRequest("GET", "/api/commo-cards"),
  });

  const activate = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/commo-cards/${id}/activate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/commo-cards"] }); toast({ title: "Card set as active" }); },
  });
  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/commo-cards/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/commo-cards"] }); toast({ title: "Card deleted" }); },
  });

  // Auto-select active card or first card
  const activeCard = cards.find(c => c.active) || cards[0] || null;
  const viewCard = selectedId ? cards.find(c => c.id === selectedId) : activeCard;

  return (
    <div
      className={cn(
        "tac-page flex min-h-0 w-full",
        isMobile
          ? "flex-col min-h-[calc(100dvh-7.25rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))]"
          : "flex-row min-h-[min(100dvh,calc(100vh-3rem))]",
      )}
    >

      {/* ── Card selector (top strip on phone, sidebar on desktop) ───────── */}
      <div
        className={cn(
          "border-border bg-card flex flex-col shrink-0",
          isMobile
            ? "w-full border-b max-h-[min(40vh,220px)]"
            : "w-52 border-r border-b-0",
        )}
      >
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
          <Radio size={12} className="text-green-400" />
          <span className="text-[10px] font-bold tracking-[0.15em] text-green-400">COMMO CARDS</span>
        </div>

        <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
          {cards.map(c => (
            <button key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full text-left px-2 py-2 rounded transition-all text-xs ${
                viewCard?.id === c.id
                  ? "bg-green-950/60 border border-green-900/50 text-green-400"
                  : "hover:bg-secondary text-muted-foreground hover:text-foreground"
              }`}>
              <div className="flex items-center gap-1 mb-0.5">
                {c.active && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
                <span className="font-mono font-bold text-[10px] truncate tracking-wider">{c.title}</span>
              </div>
              <div className="text-[9px] text-muted-foreground/60">EFF: {c.effectiveDate}</div>
            </button>
          ))}
          {cards.length === 0 && (
            <div className="text-[10px] text-muted-foreground/50 text-center py-4">NO CARDS</div>
          )}
        </div>

        {isAdmin && (
          <div className="px-2 pb-3 border-t border-border pt-2">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full text-[10px] bg-green-900/50 hover:bg-green-800/60 border border-green-800/40 text-green-400 gap-1">
                  <Plus size={10} /> NEW CARD
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle className="text-sm tracking-widest">CREATE COMMO CARD</DialogTitle></DialogHeader>
                <CreateCardForm onClose={() => setCreateOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* ── Main card view ──────────────────────────────────── */}
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain">
        {viewCard ? (
          <div className="p-3 sm:p-5 max-w-5xl mx-auto w-full">
            {/* Admin actions */}
            {isAdmin && (
              <div className="flex gap-2 mb-4">
                {!viewCard.active && (
                  <Button size="sm" onClick={() => activate.mutate(viewCard.id)}
                    className="text-[10px] bg-green-900/50 hover:bg-green-800 border border-green-800/40 text-green-400 gap-1">
                    <CheckCircle size={10} /> SET AS ACTIVE
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => del.mutate(viewCard.id)}
                  className="text-[10px] text-red-400 hover:text-red-300 border-red-900/40 gap-1 ml-auto">
                  <Trash2 size={10} /> DELETE CARD
                </Button>
              </div>
            )}
            <CardView card={viewCard} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Radio size={32} className="mb-3 opacity-20" />
            <div className="text-xs tracking-wider">NO COMMO CARD LOADED</div>
            {isAdmin && <div className="text-[10px] mt-1 opacity-60">Create one using the sidebar</div>}
          </div>
        )}
      </div>
    </div>
  );
}
