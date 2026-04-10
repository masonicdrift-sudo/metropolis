import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { Broadcast } from "@shared/schema";
import { useState } from "react";
import { Plus, Trash2, AlertTriangle, Radio, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ProfileLink } from "@/components/ProfileLink";
import { SubPageNav } from "@/components/SubPageNav";
import { ADMIN_SUB } from "@/lib/appNav";

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  flash:     { label: "FLASH",     color: "text-red-400",    bg: "bg-red-950/60",    border: "border-red-700" },
  immediate: { label: "IMMEDIATE", color: "text-orange-400", bg: "bg-orange-950/60", border: "border-orange-700" },
  priority:  { label: "PRIORITY",  color: "text-yellow-400", bg: "bg-yellow-950/60", border: "border-yellow-700" },
};

function BroadcastForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ title: "", message: "", priority: "flash", expiresAt: "" });

  const create = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/broadcasts", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/broadcasts"] }); toast({ title: "Broadcast sent to all users" }); onClose(); },
  });

  return (
    <div className="space-y-3">
      <div className="bg-red-950/30 border border-red-800/40 rounded px-3 py-2 text-[11px] text-red-300">
        This message will immediately appear as a full-screen alert for ALL logged-in users.
      </div>
      <div>
        <Label className="text-[10px] tracking-wider">PRIORITY</Label>
        <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}><span className={v.color}>{v.label}</span></SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-[10px] tracking-wider">TITLE *</Label>
        <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="IMMEDIATE ACTION REQUIRED" className="text-xs font-bold uppercase" />
      </div>
      <div>
        <Label className="text-[10px] tracking-wider">MESSAGE *</Label>
        <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          className="text-xs h-24" placeholder="Broadcast message body..." />
      </div>
      <div>
        <Label className="text-[10px] tracking-wider">AUTO-EXPIRE (OPTIONAL)</Label>
        <Input type="datetime-local" value={form.expiresAt}
          onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : "" }))}
          className="text-xs" />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>CANCEL</Button>
        <Button size="sm" className="text-xs bg-red-800 hover:bg-red-700 text-white tracking-wider"
          onClick={() => {
            if (!form.title || !form.message) { return; }
            create.mutate(form);
          }} disabled={create.isPending}>
          <Radio size={12} className="mr-1" /> SEND BROADCAST
        </Button>
      </div>
    </div>
  );
}

export default function BroadcastsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canAdmin = user?.accessLevel === "admin" || user?.accessLevel === "owner";
  const [open, setOpen] = useState(false);

  const { data: all = [] } = useQuery<Broadcast[]>({
    queryKey: ["/api/broadcasts/all"],
    queryFn: () => apiRequest("GET", "/api/broadcasts/all"),
    enabled: canAdmin,
  });

  const dismiss = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/broadcasts/${id}/dismiss`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/broadcasts/all"] }),
  });
  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/broadcasts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/broadcasts/all"] }); toast({ title: "Broadcast deleted" }); },
  });

  const fmt = (iso: string) => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };

  return (
    <div className="p-3 md:p-4 tac-page">
      <SubPageNav items={ADMIN_SUB} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>FLASH BROADCASTS</h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">
            {all.filter(b => b.active).length} ACTIVE ▪ {all.length} TOTAL BROADCASTS
          </div>
        </div>
        {canAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-red-800 hover:bg-red-700 text-white text-xs tracking-wider gap-1">
                <Radio size={12} /> NEW BROADCAST
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="text-sm tracking-widest text-red-400">SEND FLASH BROADCAST</DialogTitle></DialogHeader>
              <BroadcastForm onClose={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {all.length === 0 && (
        <div className="bg-card border border-border rounded p-8 text-center text-muted-foreground text-xs">NO BROADCASTS ON RECORD</div>
      )}

      <div className="space-y-2">
        {all.map(b => {
          const cfg = PRIORITY_CONFIG[b.priority] || PRIORITY_CONFIG.priority;
          return (
            <div key={b.id} className={`rounded border px-4 py-3 ${b.active ? `${cfg.bg} ${cfg.border}` : "bg-card border-border opacity-50"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] font-bold tracking-widest ${cfg.color}`}>{cfg.label}</span>
                    {b.active ? (
                      <span className="text-[9px] bg-red-800/50 text-red-300 px-1.5 py-0.5 rounded font-bold tracking-wider">ACTIVE</span>
                    ) : (
                      <span className="text-[9px] text-muted-foreground tracking-wider">DISMISSED</span>
                    )}
                    <span className="text-xs font-bold">{b.title}</span>
                  </div>
                  <div className="text-[11px] text-foreground/80 mb-1">{b.message}</div>
                  <div className="text-[10px] text-muted-foreground">
                    SENT BY{" "}
                    <ProfileLink username={b.sentBy} className="text-muted-foreground hover:text-foreground">
                      {b.sentBy}
                    </ProfileLink>{" "}
                    ▪ {fmt(b.sentAt)}
                    {b.expiresAt && ` ▪ EXPIRES: ${fmt(b.expiresAt)}`}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {b.active && (
                    <button onClick={() => dismiss.mutate(b.id)} className="p-1 text-muted-foreground hover:text-yellow-400" title="Dismiss">
                      <X size={13} />
                    </button>
                  )}
                  <button onClick={() => del.mutate(b.id)} className="p-1 text-muted-foreground hover:text-red-400" title="Delete">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
