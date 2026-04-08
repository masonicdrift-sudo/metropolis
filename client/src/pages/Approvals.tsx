import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Approval } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isStaff = user?.accessLevel === "admin" || user?.accessLevel === "owner";
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const { data: rows = [] } = useQuery<Approval[]>({
    queryKey: ["/api/approvals", status],
    queryFn: () =>
      apiRequest(
        "GET",
        status === "all" ? "/api/approvals" : `/api/approvals?status=${encodeURIComponent(status)}`,
      ),
    enabled: !!user && isStaff,
  });

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [note, setNote] = useState("");

  const approve = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/approvals/${id}/approve`, { decisionNote: note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/approvals"] }); setOpen(false); setSelected(null); },
  });
  const reject = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/approvals/${id}/reject`, { decisionNote: note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/approvals"] }); setOpen(false); setSelected(null); },
  });

  if (!isStaff) {
    return (
      <div className="p-4 tac-page">
        <div className="text-sm font-bold tracking-wider text-muted-foreground">APPROVALS</div>
        <div className="text-xs text-muted-foreground mt-2">Admin/owner access only.</div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 tac-page flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-green-400" />
        <h1 className="text-sm font-bold tracking-[0.15em] text-green-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          APPROVALS
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="h-8 text-[10px] w-[9.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">PENDING</SelectItem>
              <SelectItem value="approved">APPROVED</SelectItem>
              <SelectItem value="rejected">REJECTED</SelectItem>
              <SelectItem value="all">ALL</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground tracking-wider">{rows.length} {status.toUpperCase()}</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded overflow-hidden">
        <div className="divide-y divide-border">
          {rows.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">NO {status.toUpperCase()} APPROVALS</div>
          ) : (
            rows.map((a) => (
              <button
                key={a.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-secondary/20"
                onClick={() => {
                  setSelected(a);
                  setNote("");
                  setOpen(true);
                }}
              >
                <div className="text-[10px] font-mono text-muted-foreground">
                  {new Date(a.requestedAt).toLocaleString()} · {a.requestedBy} · {a.status.toUpperCase()}
                </div>
                <div className="text-xs font-mono">
                  {a.action} {a.entityType} #{a.entityId}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <Dialog open={open && !!selected} onOpenChange={(o) => { setOpen(o); if (!o) setSelected(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-wider">DECISION</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="text-xs font-mono">
                {selected.action} {selected.entityType} #{selected.entityId}
              </div>
              <Textarea className="text-xs font-mono min-h-[6rem]" placeholder="Decision note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            {selected && selected.status === "pending" && (
              <>
                <Button variant="destructive" size="sm" onClick={() => reject.mutate(selected.id)} disabled={reject.isPending}>Reject</Button>
                <Button size="sm" className="bg-green-800 hover:bg-green-700" onClick={() => approve.mutate(selected.id)} disabled={approve.isPending}>Approve</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

