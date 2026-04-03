import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { CommsLog, InsertCommsLog } from "@shared/schema";
import { useState } from "react";
import { Radio, Send, CheckCheck } from "lucide-react";
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

export default function Communications() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<InsertCommsLog>>({
    channel: "PRIMARY", type: "SITREP", priority: "routine",
  });
  const [filterChan, setFilterChan] = useState("ALL");

  const { data: comms = [] } = useQuery<CommsLog[]>({ queryKey: ["/api/comms"], queryFn: () => apiRequest("GET", "/api/comms") });

  const send = useMutation({
    mutationFn: (d: InsertCommsLog) => apiRequest("POST", "/api/comms", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/comms"] });
      toast({ title: "Message transmitted" });
      setForm(f => ({ ...f, message: "", fromCallsign: f.fromCallsign, toCallsign: f.toCallsign }));
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
        <div className="col-span-4 bg-card border border-border rounded">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Radio size={11} className="text-green-400" />
            <span className="text-[10px] font-bold tracking-[0.15em] text-green-400">COMPOSE MESSAGE</span>
          </div>
          <div className="p-3 space-y-2.5">
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
            <div>
              <Label className="text-[9px] tracking-wider text-muted-foreground">CHANNEL</Label>
              <Select value={form.channel} onValueChange={set("channel")}>
                <SelectTrigger className="text-xs h-7"><SelectValue /></SelectTrigger>
                <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[9px] tracking-wider text-muted-foreground">MSG TYPE</Label>
                <Select value={form.type} onValueChange={set("type")}>
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
            <div>
              <Label className="text-[9px] tracking-wider text-muted-foreground">MESSAGE TEXT</Label>
              <Textarea placeholder="Enter message text..." value={form.message || ""} onChange={e => set("message")(e.target.value)} className="text-xs h-28 font-mono" data-testid="input-message" />
            </div>

            {/* SALUTE template helper */}
            {form.type === "SALUTE" && (
              <div className="bg-secondary/50 rounded p-2 text-[10px] text-muted-foreground space-y-0.5">
                <div className="text-[9px] font-bold tracking-wider text-green-400 mb-1">SALUTE FORMAT</div>
                <div>S - SIZE (# of personnel/vehicles)</div>
                <div>A - ACTIVITY (what they're doing)</div>
                <div>L - LOCATION (grid)</div>
                <div>U - UNIT (identification)</div>
                <div>T - TIME (observed)</div>
                <div>E - EQUIPMENT</div>
              </div>
            )}
            {form.type === "SITREP" && (
              <div className="bg-secondary/50 rounded p-2 text-[10px] text-muted-foreground space-y-0.5">
                <div className="text-[9px] font-bold tracking-wider text-green-400 mb-1">SITREP FORMAT</div>
                <div>Location, PAX count, contact/neg contact, status</div>
              </div>
            )}
            {form.type === "CASEVAC" && (
              <div className="bg-secondary/50 rounded p-2 text-[10px] text-muted-foreground space-y-0.5">
                <div className="text-[9px] font-bold tracking-wider text-red-400 mb-1">9-LINE MEDEVAC</div>
                <div>1-Grid 2-Freq 3-#Patients 4-Equipment 5-#Patients(detail) 6-Security 7-Method 8-Marking 9-Nationality</div>
              </div>
            )}

            <Button size="sm" onClick={transmit} disabled={send.isPending}
              className="w-full bg-green-800 hover:bg-green-700 text-xs tracking-wider gap-1" data-testid="button-transmit">
              <Send size={11} /> TRANSMIT
            </Button>
          </div>
        </div>

        {/* Log */}
        <div className="col-span-8 bg-card border border-border rounded">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-[10px] font-bold tracking-[0.15em] text-green-400">MESSAGE LOG</span>
            <div className="flex gap-1">
              {["ALL", ...CHANNELS].map(ch => (
                <button key={ch} onClick={() => setFilterChan(ch)}
                  className={`text-[9px] px-2 py-0.5 rounded tracking-wider transition-all ${filterChan === ch ? "bg-green-900 text-green-400 border border-green-800" : "text-muted-foreground bg-secondary hover:text-foreground"}`}>
                  {ch}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-border overflow-y-auto max-h-[calc(100vh-240px)]">
            {filtered.length === 0 && <div className="py-8 text-center text-xs text-muted-foreground">NO MESSAGES</div>}
            {filtered.map(msg => (
              <div key={msg.id} className={`px-3 py-2.5 ${priorityColor[msg.priority] || ""}`} data-testid={`msg-${msg.id}`}>
                <div className="flex items-center gap-2 mb-1">
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
