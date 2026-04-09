import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { SubPageNav } from "@/components/SubPageNav";
import { PERSONNEL_SUB } from "@/lib/appNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { LoaRequest } from "@shared/schema";
import { CalendarRange, Palmtree } from "lucide-react";
import { ProfileLink } from "@/components/ProfileLink";

function fmtDate(s: string) {
  if (!s) return "—";
  try {
    const d = new Date(s + (s.length <= 10 ? "T12:00:00" : ""));
    return d.toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return s;
  }
}

export default function LeaveOfAbsencePage() {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const { data: rows = [] } = useQuery<LoaRequest[]>({
    queryKey: ["/api/loa/mine"],
    queryFn: () => apiRequest("GET", "/api/loa/mine"),
    enabled: !!user,
  });

  const submit = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/loa/request", {
        startDate,
        endDate,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/loa/mine"] });
      qc.invalidateQueries({ queryKey: ["/api/approvals"] });
      toast({ title: "LOA submitted", description: "Pending admin approval." });
      setReason("");
      refreshUser();
    },
    onError: (err: Error) =>
      toast({ title: "Request failed", description: err.message, variant: "destructive" }),
  });

  const activeLoa =
    user?.loaStart && user?.loaEnd
      ? { start: user.loaStart, end: user.loaEnd, approver: user.loaApprover || "" }
      : null;

  return (
    <div className="p-3 md:p-4 tac-page max-w-3xl">
      <SubPageNav items={PERSONNEL_SUB} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h1
            className="text-sm font-bold tracking-[0.15em] flex items-center gap-2"
            style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
          >
            <Palmtree className="h-4 w-4 text-cyan-400/90" />
            LEAVE OF ABSENCE (LOA)
          </h1>
          <p className="text-[10px] text-muted-foreground tracking-wider mt-1 max-w-xl">
            Submit dates for leave. When an admin approves, your PERSTAT shows ON LEAVE, your account records the approver and
            date range, and any Personnel Roster line linked to your username updates to Leave automatically.
          </p>
        </div>
      </div>

      {activeLoa && (
        <div className="rounded-md border border-cyan-900/50 bg-cyan-950/20 px-3 py-2 mb-4 text-[11px] text-cyan-200/90">
          <div className="font-bold tracking-wider flex items-center gap-2">
            <CalendarRange className="h-3.5 w-3.5" /> APPROVED LOA (ACTIVE)
          </div>
          <div className="mt-1 text-[10px] space-y-0.5">
            <div>
              {fmtDate(activeLoa.start)} → {fmtDate(activeLoa.end)}
            </div>
            {activeLoa.approver ? (
              <div>
                Approver:{" "}
                <ProfileLink username={activeLoa.approver} className="font-mono text-cyan-300 hover:text-cyan-200">
                  {activeLoa.approver}
                </ProfileLink>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="rounded-md border border-border bg-card p-4 mb-6 space-y-3">
        <div className="text-[10px] text-muted-foreground tracking-wider uppercase">New request</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] tracking-wider">Start date</Label>
            <Input className="text-xs" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] tracking-wider">End date (inclusive)</Label>
            <Input className="text-xs" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] tracking-wider">Reason / remarks</Label>
          <Textarea
            className="text-xs min-h-[72px]"
            placeholder="Purpose of leave, contact info, etc."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            className="text-xs bg-cyan-950/50 border border-cyan-900/60 text-cyan-100"
            disabled={submit.isPending || !startDate || !endDate}
            onClick={() => submit.mutate()}
          >
            Submit for approval
          </Button>
        </div>
      </div>

      <div>
        <div className="text-[10px] text-muted-foreground tracking-wider uppercase mb-2">Your LOA history</div>
        <div className="rounded-md border border-border divide-y divide-border">
          {rows.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">No requests yet.</div>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="px-3 py-2 text-[11px] space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono">
                    {fmtDate(r.startDate)} → {fmtDate(r.endDate)}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide ${
                      r.status === "approved"
                        ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/50"
                        : r.status === "pending"
                          ? "bg-amber-950/60 text-amber-300 border border-amber-800/50"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                {r.reason?.trim() ? <div className="text-muted-foreground">{r.reason}</div> : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
