import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useMemo, useState } from "react";
import { SubPageNav } from "@/components/SubPageNav";
import { personnelSubNavForAccess } from "@/lib/appNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Approval, LoaRequest } from "@shared/schema";
import { CalendarRange, Palmtree, Undo2, LogIn } from "lucide-react";
import { ProfileLink } from "@/components/ProfileLink";
import { cn } from "@/lib/utils";

function fmtDate(s: string) {
  if (!s) return "—";
  try {
    const d = new Date(s + (s.length <= 10 ? "T12:00:00" : ""));
    return d.toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return s;
  }
}

function parseLoaEarlyReturnPayload(json: string): { returnDate?: string; reason?: string } {
  try {
    const p = JSON.parse(json || "{}");
    return {
      returnDate: typeof p.returnDate === "string" ? p.returnDate : undefined,
      reason: typeof p.reason === "string" ? p.reason : undefined,
    };
  } catch {
    return {};
  }
}

export default function LeaveOfAbsencePage() {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isStaff = user?.accessLevel === "admin" || user?.accessLevel === "owner";

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const [earlyReturnDate, setEarlyReturnDate] = useState("");
  const [earlyReturnReason, setEarlyReturnReason] = useState("");

  const { data: rows = [] } = useQuery<LoaRequest[]>({
    queryKey: ["/api/loa/mine"],
    queryFn: () => apiRequest("GET", "/api/loa/mine"),
    enabled: !!user,
  });

  const { data: returnRows = [] } = useQuery<Approval[]>({
    queryKey: ["/api/loa/my-return-requests"],
    queryFn: () => apiRequest("GET", "/api/loa/my-return-requests"),
    enabled: !!user,
  });

  const { data: pendingEarly } = useQuery<Approval | null>({
    queryKey: ["/api/loa/pending-early-return"],
    queryFn: () => apiRequest("GET", "/api/loa/pending-early-return"),
    enabled: !!user,
  });

  const { data: approvedAdminList = [] } = useQuery<LoaRequest[]>({
    queryKey: ["/api/loa/approved-for-admin"],
    queryFn: () => apiRequest("GET", "/api/loa/approved-for-admin"),
    enabled: !!user && isStaff,
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

  const earlyReturnMut = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/loa/early-return", {
        returnDate: earlyReturnDate,
        reason: earlyReturnReason.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/loa/pending-early-return"] });
      qc.invalidateQueries({ queryKey: ["/api/loa/my-return-requests"] });
      qc.invalidateQueries({ queryKey: ["/api/approvals"] });
      toast({ title: "Return request submitted", description: "Pending admin approval." });
      setEarlyReturnDate("");
      setEarlyReturnReason("");
      refreshUser();
    },
    onError: (err: Error) =>
      toast({ title: "Request failed", description: err.message, variant: "destructive" }),
  });

  const retractMut = useMutation({
    mutationFn: (loaId: number) => apiRequest("POST", `/api/loa/${loaId}/retract`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/loa/mine"] });
      qc.invalidateQueries({ queryKey: ["/api/loa/approved-for-admin"] });
      qc.invalidateQueries({ queryKey: ["/api/perstat"] });
      toast({ title: "Leave approval retracted" });
      refreshUser();
    },
    onError: (err: Error) =>
      toast({ title: "Retract failed", description: err.message, variant: "destructive" }),
  });

  const activeLoa =
    user?.loaStart && user?.loaEnd
      ? { start: user.loaStart, end: user.loaEnd, approver: user.loaApprover || "" }
      : null;

  const canRequestEarly =
    !!activeLoa &&
    !pendingEarly &&
    !rows.some((r) => r.subjectUsername === user?.username && r.status === "pending");

  const todayStr = new Date().toISOString().slice(0, 10);

  const pendingEarlyPayload = pendingEarly ? parseLoaEarlyReturnPayload(pendingEarly.payloadJson) : null;

  const historyMerged = useMemo(() => {
    type Entry =
      | { kind: "loa"; sortAt: string; loa: LoaRequest }
      | { kind: "return"; sortAt: string; approval: Approval };
    const loaEntries: Entry[] = rows.map((loa) => ({ kind: "loa", sortAt: loa.createdAt, loa }));
    const retEntries: Entry[] = returnRows.map((approval) => ({
      kind: "return",
      sortAt: approval.requestedAt,
      approval,
    }));
    return [...loaEntries, ...retEntries].sort((a, b) => (a.sortAt < b.sortAt ? 1 : a.sortAt > b.sortAt ? -1 : 0));
  }, [rows, returnRows]);

  return (
    <div className="p-3 md:p-4 tac-page max-w-3xl">
      <SubPageNav items={personnelSubNavForAccess(user?.accessLevel)} />
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

      {pendingEarly ? (
        <div className="rounded-md border border-amber-900/50 bg-amber-950/20 px-3 py-2 mb-4 text-[11px] text-amber-200/90">
          <div className="font-bold tracking-wider">RETURN FROM LEAVE — PENDING APPROVAL</div>
          <div className="text-[10px] mt-1 text-muted-foreground space-y-0.5">
            {pendingEarlyPayload?.returnDate ? (
              <div>
                Requested return: <span className="text-amber-100/95">{fmtDate(pendingEarlyPayload.returnDate)}</span>
              </div>
            ) : null}
            <div>
              Submitted {new Date(pendingEarly.requestedAt).toLocaleString()} — an admin will approve or reject in Approvals.
            </div>
          </div>
        </div>
      ) : null}

      {activeLoa && canRequestEarly ? (
        <div className="rounded-md border border-border bg-card p-4 mb-6 space-y-3">
          <div className="text-[10px] text-muted-foreground tracking-wider uppercase flex items-center gap-2">
            <LogIn className="h-3.5 w-3.5" /> Request return from leave
          </div>
          <p className="text-[10px] text-muted-foreground">
            Ask to come off leave effective on the date you choose (from today through your scheduled end{" "}
            {fmtDate(activeLoa.end)}). Shortening your window is approved as an early return; choosing your last scheduled day
            confirms return on that date. Admins approve in the Approvals queue.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] tracking-wider">Return on duty (date)</Label>
              <Input
                className="text-xs"
                type="date"
                min={todayStr}
                max={activeLoa.end}
                value={earlyReturnDate}
                onChange={(e) => setEarlyReturnDate(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[10px] tracking-wider">Reason (optional)</Label>
              <Textarea
                className="text-xs min-h-[56px]"
                placeholder="e.g. Mission complete, recalled, family emergency resolved…"
                value={earlyReturnReason}
                onChange={(e) => setEarlyReturnReason(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              className="text-xs"
              disabled={earlyReturnMut.isPending || !earlyReturnDate}
              onClick={() => earlyReturnMut.mutate()}
            >
              Submit return request
            </Button>
          </div>
        </div>
      ) : null}

      {isStaff && approvedAdminList.length > 0 ? (
        <div className="rounded-md border border-orange-900/40 bg-orange-950/15 p-4 mb-6 space-y-2">
          <div className="text-[10px] font-bold tracking-wider text-orange-200/90 uppercase flex items-center gap-2">
            <Undo2 className="h-3.5 w-3.5" /> Approved leave (admin)
          </div>
          <p className="text-[10px] text-muted-foreground">
            Retract revokes the approval, clears the member&apos;s LOA window (when it matches this request), returns PERSTAT
            to active if they were on leave, and restores linked roster lines to present.
          </p>
          <div className="space-y-2">
            {approvedAdminList.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 text-[11px] border border-border/60 rounded px-2 py-1.5 bg-card/50"
              >
                <div className="min-w-0">
                  <ProfileLink username={r.subjectUsername} className="font-mono font-semibold hover:text-orange-200">
                    {r.subjectUsername}
                  </ProfileLink>
                  <span className="text-muted-foreground">
                    {" "}
                    · {fmtDate(r.startDate)} → {fmtDate(r.endDate)} · LOA #{r.id}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="text-[10px] h-7"
                  disabled={retractMut.isPending}
                  onClick={() => {
                    if (
                      confirm(
                        `Retract approved leave for ${r.subjectUsername} (${fmtDate(r.startDate)}–${fmtDate(r.endDate)})?`,
                      )
                    ) {
                      retractMut.mutate(r.id);
                    }
                  }}
                >
                  Retract approval
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

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
        <div className="text-[10px] text-muted-foreground tracking-wider uppercase mb-2">Your LOA &amp; return requests</div>
        <div className="rounded-md border border-border divide-y divide-border">
          {historyMerged.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">No leave or return requests yet.</div>
          ) : (
            historyMerged.map((entry) => {
              if (entry.kind === "loa") {
                const r = entry.loa;
                return (
                  <div key={`loa-${r.id}`} className="px-3 py-2 text-[11px] space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[9px] text-muted-foreground tracking-wider uppercase">Leave request</span>
                      <span
                        className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide",
                          r.status === "approved"
                            ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/50"
                            : r.status === "pending"
                              ? "bg-amber-950/60 text-amber-300 border border-amber-800/50"
                              : r.status === "retracted"
                                ? "bg-orange-950/60 text-orange-300 border border-orange-800/50"
                                : "bg-slate-800 text-slate-400 border border-slate-700",
                        )}
                      >
                        {r.status}
                      </span>
                    </div>
                    <div className="font-mono">
                      {fmtDate(r.startDate)} → {fmtDate(r.endDate)}
                    </div>
                    {r.reason?.trim() ? <div className="text-muted-foreground">{r.reason}</div> : null}
                  </div>
                );
              }
              const ap = entry.approval;
              const payload = parseLoaEarlyReturnPayload(ap.payloadJson);
              return (
                <div key={`ret-${ap.id}`} className="px-3 py-2 text-[11px] space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[9px] text-muted-foreground tracking-wider uppercase">Return from leave</span>
                    <span
                      className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide",
                        ap.status === "approved"
                          ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/50"
                          : ap.status === "pending"
                            ? "bg-amber-950/60 text-amber-300 border border-amber-800/50"
                            : ap.status === "rejected"
                              ? "bg-rose-950/60 text-rose-300 border border-rose-800/50"
                              : "bg-slate-800 text-slate-400 border border-slate-700",
                      )}
                    >
                      {ap.status}
                    </span>
                  </div>
                  <div>
                    Return on duty: <span className="font-mono">{fmtDate(payload.returnDate || "")}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Requested {new Date(ap.requestedAt).toLocaleString()}
                    {ap.status === "approved" && ap.approvedAt ? (
                      <>
                        {" "}
                        · Approved {new Date(ap.approvedAt).toLocaleString()}
                        {ap.approvedBy ? (
                          <>
                            {" "}
                            by{" "}
                            <ProfileLink
                              username={ap.approvedBy}
                              className="font-mono text-cyan-600/90 dark:text-cyan-400/90 hover:underline"
                            >
                              {ap.approvedBy}
                            </ProfileLink>
                          </>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                  {payload.reason?.trim() ? <div className="text-muted-foreground">{payload.reason}</div> : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
