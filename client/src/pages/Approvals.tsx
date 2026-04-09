import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Approval } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProfileLink } from "@/components/ProfileLink";
import { useToast } from "@/hooks/use-toast";

function promotionPayloadSummary(payloadJson: string): string | null {
  try {
    const j = JSON.parse(payloadJson) as { promotions?: { username?: string; newRank?: string; effectiveDate?: string }[] };
    const list = j.promotions;
    if (!Array.isArray(list) || list.length === 0) return null;
    return list
      .map((p) => `${p.username ?? "?"} → ${p.newRank ?? "?"} (${p.effectiveDate ?? "?"})`)
      .join(" · ");
  } catch {
    return null;
  }
}

function loaPayloadSummary(payloadJson: string): string | null {
  try {
    const j = JSON.parse(payloadJson) as {
      subjectUsername?: string;
      startDate?: string;
      endDate?: string;
      loaRequestId?: number;
    };
    if (!j.subjectUsername && !j.startDate) return null;
    return `${j.subjectUsername ?? "?"} · ${j.startDate ?? "?"} → ${j.endDate ?? "?"}`;
  } catch {
    return null;
  }
}

function loaEarlyReturnPayloadSummary(payloadJson: string): string | null {
  try {
    const j = JSON.parse(payloadJson) as {
      subjectUsername?: string;
      returnDate?: string;
      previousEndDate?: string;
      reason?: string;
    };
    if (!j.returnDate && !j.subjectUsername) return null;
    return `${j.subjectUsername ?? "?"} · return by ${j.returnDate ?? "?"} (was ${j.previousEndDate ?? "?"})`;
  } catch {
    return null;
  }
}

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
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

  const deleteApproval = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/approvals/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/approvals"] });
      setOpen(false);
      setSelected(null);
      toast({ title: "Approval record deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
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
        <ShieldCheck className="h-4 w-4 text-blue-400" />
        <h1 className="text-sm font-bold tracking-[0.15em] text-blue-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
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
              <div
                key={a.id}
                className="w-full flex items-start gap-2 px-3 py-2 hover:bg-secondary/20"
              >
                <div
                  role="button"
                  tabIndex={0}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                  onClick={() => {
                    setSelected(a);
                    setNote("");
                    setOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(a);
                      setNote("");
                      setOpen(true);
                    }
                  }}
                >
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {new Date(a.requestedAt).toLocaleString()} ·{" "}
                    <ProfileLink username={a.requestedBy} className="text-muted-foreground hover:text-foreground">
                      {a.requestedBy}
                    </ProfileLink>{" "}
                    · {a.status.toUpperCase()}
                  </div>
                  <div className="text-xs font-mono">
                    {a.entityType === "promotion_packet" ? (
                      <span className="text-amber-300/90">
                        PROMOTION PACKET — {promotionPayloadSummary(a.payloadJson) ?? "—"}
                      </span>
                    ) : a.entityType === "loa_request" ? (
                      <span className="text-cyan-300/90">
                        LOA REQUEST — {loaPayloadSummary(a.payloadJson) ?? `${a.action} #${a.entityId}`}
                      </span>
                    ) : a.entityType === "loa_early_return" ? (
                      <span className="text-teal-300/90">
                        LOA EARLY RETURN — {loaEarlyReturnPayloadSummary(a.payloadJson) ?? `${a.action} #${a.entityId}`}
                      </span>
                    ) : (
                      <>
                        {a.action} {a.entityType} #{a.entityId}
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="shrink-0 p-2 rounded text-muted-foreground hover:text-red-400 hover:bg-red-950/20"
                  title="Delete approval record"
                  disabled={deleteApproval.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete approval #${a.id} from the log? This does not undo completed actions.`)) {
                      deleteApproval.mutate(a.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
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
              <div className="text-xs font-mono space-y-1">
                <div>
                  {selected.action} {selected.entityType} #{selected.entityId}
                </div>
                {selected.entityType === "promotion_packet" && (
                  <div className="text-[10px] text-amber-200/90 whitespace-pre-wrap border border-amber-900/40 rounded p-2 bg-amber-950/20">
                    {promotionPayloadSummary(selected.payloadJson) ?? selected.payloadJson}
                  </div>
                )}
                {selected.entityType === "loa_request" && (
                  <div className="text-[10px] text-cyan-200/90 whitespace-pre-wrap border border-cyan-900/40 rounded p-2 bg-cyan-950/20">
                    {loaPayloadSummary(selected.payloadJson) ?? selected.payloadJson}
                  </div>
                )}
                {selected.entityType === "loa_early_return" && (
                  <div className="text-[10px] text-teal-200/90 whitespace-pre-wrap border border-teal-900/40 rounded p-2 bg-teal-950/20">
                    {loaEarlyReturnPayloadSummary(selected.payloadJson) ?? selected.payloadJson}
                  </div>
                )}
                {selected.requestedNote?.trim() ? (
                  <div className="text-[10px] text-muted-foreground">Request note: {selected.requestedNote}</div>
                ) : null}
              </div>
              <Textarea className="text-xs font-mono min-h-[6rem]" placeholder="Decision note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            {selected && (
              <Button
                variant="destructive"
                size="sm"
                className="mr-auto"
                onClick={() => {
                  if (confirm(`Delete approval #${selected.id}? This does not undo completed actions.`)) {
                    deleteApproval.mutate(selected.id);
                  }
                }}
                disabled={deleteApproval.isPending}
              >
                Delete record
              </Button>
            )}
            {selected && selected.status === "pending" && (
              <>
                <Button variant="destructive" size="sm" onClick={() => reject.mutate(selected.id)} disabled={reject.isPending}>Reject</Button>
                <Button size="sm" className="bg-blue-800 hover:bg-blue-700" onClick={() => approve.mutate(selected.id)} disabled={approve.isPending}>Approve</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

