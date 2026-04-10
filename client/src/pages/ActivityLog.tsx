import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ActivityLog } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollText, Search } from "lucide-react";
import { SubPageNav } from "@/components/SubPageNav";
import { ADMIN_SUB } from "@/lib/appNav";

function safeJsonPreview(s: string): string {
  if (!s) return "";
  try {
    const j = JSON.parse(s);
    return JSON.stringify(j, null, 2);
  } catch {
    return s;
  }
}

export default function ActivityLogPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const mobile = useIsMobile();

  const isStaff = user?.accessLevel === "admin" || user?.accessLevel === "owner";
  const canSeeIp = user?.accessLevel === "owner";
  const [filters, setFilters] = useState({
    actorUsername: "",
    entityType: "",
    action: "",
    limit: "200",
  });
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ActivityLog | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.actorUsername.trim()) p.set("actorUsername", filters.actorUsername.trim());
    if (filters.entityType.trim()) p.set("entityType", filters.entityType.trim());
    if (filters.action.trim()) p.set("action", filters.action.trim());
    const lim = Number(filters.limit);
    if (Number.isFinite(lim) && lim > 0) p.set("limit", String(Math.min(500, lim)));
    return p.toString();
  }, [filters]);

  const { data: rows = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity", query],
    queryFn: () => apiRequest("GET", `/api/activity${query ? `?${query}` : ""}`),
    enabled: !!user && isStaff,
  });

  if (!isStaff) {
    return (
      <div className="p-4 tac-page">
        <div className="text-sm font-bold tracking-wider text-muted-foreground">ACTIVITY LOG</div>
        <div className="text-xs text-muted-foreground mt-2">
          Admin/owner access only.
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 tac-page flex flex-col min-h-0 gap-3">
      <SubPageNav items={ADMIN_SUB} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-blue-400" />
            <h1 className="text-sm font-bold tracking-[0.15em] text-blue-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              ACTIVITY LOG
            </h1>
          </div>
          <div className="text-[10px] text-muted-foreground tracking-wider mt-0.5">
            Audit trail of actions across the node (filters are server-side).
          </div>
        </div>
      </div>

      <div className={cn("bg-card border border-border rounded p-3", mobile && "p-3")}>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
          <div>
            <Label className="text-[9px] tracking-wider text-muted-foreground">ACTOR</Label>
            <Input className="h-8 text-xs font-mono" value={filters.actorUsername} onChange={(e) => setFilters((f) => ({ ...f, actorUsername: e.target.value }))} placeholder="ZR1" />
          </div>
          <div>
            <Label className="text-[9px] tracking-wider text-muted-foreground">ENTITY TYPE</Label>
            <Input className="h-8 text-xs font-mono" value={filters.entityType} onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))} placeholder="isofac / intel / operations…" />
          </div>
          <div>
            <Label className="text-[9px] tracking-wider text-muted-foreground">ACTION</Label>
            <Input className="h-8 text-xs font-mono" value={filters.action} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))} placeholder="CREATE / UPDATE / DELETE" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-[9px] tracking-wider text-muted-foreground">LIMIT</Label>
              <Input className="h-8 text-xs font-mono" inputMode="numeric" value={filters.limit} onChange={(e) => setFilters((f) => ({ ...f, limit: e.target.value }))} />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 mt-[14px] text-[10px] tracking-wider"
              onClick={() => toast({ title: "Filters applied", description: "Results refresh automatically." })}
            >
              <Search className="h-3.5 w-3.5 mr-1" /> APPLY
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded overflow-hidden flex-1 min-h-0">
        <div className="px-3 py-2 border-b border-border text-[10px] tracking-widest text-muted-foreground flex items-center justify-between">
          <span>{isLoading ? "LOADING…" : `${rows.length} EVENTS`}</span>
          <span className="text-[9px] text-muted-foreground/70">Newest first</span>
        </div>
        <div className="divide-y divide-border overflow-y-auto min-h-0 max-h-[calc(100dvh-14rem)] md:max-h-[calc(100vh-220px)]">
          {rows.length === 0 && !isLoading && (
            <div className="py-10 text-center text-xs text-muted-foreground">NO ACTIVITY</div>
          )}
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-secondary/20 transition-colors"
              onClick={() => {
                setSelected(r);
                setOpen(true);
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-mono text-muted-foreground">{new Date(r.ts).toLocaleString()}</span>
                <span className="text-[9px] font-bold text-blue-400">{r.actorUsername}</span>
                <span className="text-[9px] bg-secondary px-1.5 rounded text-muted-foreground">{r.action}</span>
                <span className="text-[9px] text-muted-foreground">{r.entityType}{r.entityId ? `#${r.entityId}` : ""}</span>
                <span className="text-[9px] text-muted-foreground/70 ml-auto">{canSeeIp && r.ip ? `IP ${r.ip}` : ""}</span>
              </div>
              {r.summary && (
                <div className="text-[11px] font-mono text-foreground/90 mt-1 line-clamp-2">{r.summary}</div>
              )}
            </button>
          ))}
        </div>
      </div>

      <Dialog open={open && !!selected} onOpenChange={(o) => { setOpen(o); if (!o) setSelected(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-wider">ACTIVITY DETAIL</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="grid gap-3">
              <div className="text-[10px] font-mono text-muted-foreground">
                {selected.ts} · {selected.actorUsername} ({selected.actorRole}) · {selected.action} · {selected.entityType}{selected.entityId ? `#${selected.entityId}` : ""}
              </div>
              {selected.summary && (
                <div className="text-xs font-mono whitespace-pre-wrap">{selected.summary}</div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-border rounded p-2 bg-secondary/10">
                  <div className="text-[9px] tracking-wider text-muted-foreground mb-1">BEFORE</div>
                  <pre className="text-[10px] font-mono whitespace-pre-wrap max-h-[40dvh] overflow-y-auto">{safeJsonPreview(selected.beforeJson)}</pre>
                </div>
                <div className="border border-border rounded p-2 bg-secondary/10">
                  <div className="text-[9px] tracking-wider text-muted-foreground mb-1">AFTER</div>
                  <pre className="text-[10px] font-mono whitespace-pre-wrap max-h-[40dvh] overflow-y-auto">{safeJsonPreview(selected.afterJson)}</pre>
                </div>
              </div>
              <div className="text-[9px] text-muted-foreground">
                UA: {selected.userAgent || "(none)"}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setOpen(false); setSelected(null); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

