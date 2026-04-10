import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { Perstat } from "@shared/schema";
import { useState } from "react";
import { UserCheck, Clock, ChevronDown, Edit } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { SubPageNav } from "@/components/SubPageNav";
import { personnelSubNavForAccess } from "@/lib/appNav";
import { ProfileLink } from "@/components/ProfileLink";

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  active:   { label: "ACTIVE",    color: "text-blue-400",  dot: "bg-blue-500" },
  off_duty: { label: "OFF DUTY",  color: "text-yellow-400", dot: "bg-yellow-500" },
  leave:    { label: "ON LEAVE",  color: "text-blue-400",   dot: "bg-blue-500" },
  mia:      { label: "MIA",       color: "text-orange-400", dot: "bg-orange-500 animate-pulse" },
  kia:      { label: "KIA",       color: "text-red-500",    dot: "bg-red-600" },
};

function EditModal({ perstat, username, onClose }: { perstat?: Perstat; username?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState(perstat?.dutyStatus || "active");
  const [notes, setNotes] = useState(perstat?.notes || "");
  const target = perstat?.username || username || "";

  const mut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/perstat", { username: target, dutyStatus: status, notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/perstat"] }); toast({ title: "PERSTAT updated" }); onClose(); },
  });

  return (
    <div className="space-y-3">
      <div className="text-[10px] text-muted-foreground tracking-wider">OPERATOR: <span className="text-foreground font-bold font-mono">{target}</span></div>
      <div>
        <Label className="text-[10px] tracking-wider">DUTY STATUS</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-[10px] tracking-wider">NOTES (OPTIONAL)</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="text-xs h-16" placeholder="Location, reason, etc." />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>CANCEL</Button>
        <Button size="sm" className="text-xs bg-blue-800 hover:bg-blue-700" onClick={() => mut.mutate()} disabled={mut.isPending}>UPDATE</Button>
      </div>
    </div>
  );
}

export default function PerstatPage() {
  const { user } = useAuth();
  const canEdit = user?.accessLevel === "admin" || user?.accessLevel === "owner";
  const [editEntry, setEditEntry] = useState<Perstat | undefined>();
  const [selfOpen, setSelfOpen] = useState(false);

  const { data: entries = [] } = useQuery<Perstat[]>({
    queryKey: ["/api/perstat"],
    queryFn: () => apiRequest("GET", "/api/perstat"),
    
  });

  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users"),
    enabled: canEdit,
  });

  const myEntry = entries.find(e => e.username === user?.username);
  const counts = Object.keys(STATUS_CONFIG).reduce((acc, k) => {
    acc[k] = entries.filter(e => e.dutyStatus === k).length;
    return acc;
  }, {} as Record<string, number>);

  const fmt = (iso: string) => {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  return (
    <div className="p-3 md:p-4 tac-page">
      <SubPageNav items={personnelSubNavForAccess(user?.accessLevel)} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>PERSTAT — PERSONNEL ACCOUNTABILITY</h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">{entries.length} ACCOUNTED ▪ {counts.active || 0} ACTIVE ▪ {counts.mia || 0} MIA ▪ {counts.kia || 0} KIA</div>
        </div>
        <Button size="sm" className="bg-blue-800 hover:bg-blue-700 text-xs tracking-wider gap-1" onClick={() => setSelfOpen(true)}>
          <UserCheck size={12} /> MY STATUS
        </Button>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <div key={k} className="bg-card border border-border rounded px-3 py-2">
            <div className="text-[9px] text-muted-foreground tracking-wider">{v.label}</div>
            <div className={`kpi-value text-xl ${v.color}`}>{counts[k] || 0}</div>
          </div>
        ))}
      </div>

      {/* Roster */}
      <div className="bg-card border border-border rounded">
        <div className="px-3 py-2 border-b border-border text-[10px] text-muted-foreground tracking-widest">ACCOUNTABILITY ROSTER</div>
        {entries.length === 0 && (
          <div className="px-3 py-8 text-center text-muted-foreground text-xs">NO STATUS REPORTS — PERSONNEL MUST CHECK IN</div>
        )}
        <div className="divide-y divide-border">
          {entries.map(e => {
            const cfg = STATUS_CONFIG[e.dutyStatus] || STATUS_CONFIG.active;
            return (
              <div key={e.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 py-2.5 hover:bg-secondary/20 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                  <div>
                    <div className="text-xs font-bold font-mono tracking-wider">
                      <ProfileLink username={e.username} className="text-foreground hover:text-blue-400 font-bold">
                        {e.username}
                      </ProfileLink>
                    </div>
                    {e.notes && <div className="text-[10px] text-muted-foreground">{e.notes}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden md:block">
                    <div className={`text-[10px] font-bold tracking-wider ${cfg.color}`}>{cfg.label}</div>
                    <div className="text-[9px] text-muted-foreground flex items-center gap-1"><Clock size={9} />{fmt(e.lastSeen)}</div>
                  </div>
                  <span className={`md:hidden text-[9px] font-bold tracking-wider ${cfg.color}`}>{cfg.label}</span>
                  {canEdit && (
                    <button onClick={() => setEditEntry(e)} className="p-1 text-muted-foreground hover:text-foreground">
                      <Edit size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Self status modal */}
      <Dialog open={selfOpen} onOpenChange={setSelfOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm tracking-widest">UPDATE MY STATUS</DialogTitle></DialogHeader>
          <EditModal perstat={myEntry} username={user?.username} onClose={() => setSelfOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Admin edit modal */}
      {editEntry && (
        <Dialog open={!!editEntry} onOpenChange={v => !v && setEditEntry(undefined)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="text-sm tracking-widest">EDIT PERSTAT — {editEntry.username}</DialogTitle></DialogHeader>
            <EditModal perstat={editEntry} onClose={() => setEditEntry(undefined)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
