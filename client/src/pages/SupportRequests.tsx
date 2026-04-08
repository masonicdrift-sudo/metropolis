import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { SupportRequest } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LifeBuoy, Plus, Trash2 } from "lucide-react";

const CATEGORIES = ["general", "intel", "log", "comms", "fires", "admin", "it", "other"];
const PRIORITIES = ["routine", "priority", "immediate", "flash"];
const STATUSES = ["open", "triaging", "in_progress", "closed"];

export default function SupportRequestsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const mobile = useIsMobile();

  const { data: rows = [], isLoading } = useQuery<SupportRequest[]>({
    queryKey: ["/api/support-requests"],
    queryFn: () => apiRequest("GET", "/api/support-requests"),
    enabled: !!user,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SupportRequest | null>(null);
  const [form, setForm] = useState({
    title: "",
    category: "general",
    priority: "routine",
    status: "open",
    assignedTo: "",
    dueAt: "",
    details: "",
  });

  const canEdit = (r: SupportRequest) =>
    !!user && (r.createdBy === user.username || r.assignedTo === user.username || user.accessLevel === "admin" || user.accessLevel === "owner");

  const createMut = useMutation({
    mutationFn: (body: Omit<typeof form, never>) => apiRequest("POST", "/api/support-requests", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/support-requests"] });
      toast({ title: "Support request created" });
      closeDialog();
    },
    onError: () => toast({ title: "Create failed", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: (body: { id: number; patch: Partial<typeof form> }) =>
      apiRequest("PATCH", `/api/support-requests/${body.id}`, body.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/support-requests"] });
      toast({ title: "Support request updated" });
      closeDialog();
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/support-requests/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/support-requests"] });
      toast({ title: "Support request deleted" });
      closeDialog();
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setForm({
      title: "",
      category: "general",
      priority: "routine",
      status: "open",
      assignedTo: "",
      dueAt: "",
      details: "",
    });
  };

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (r: SupportRequest) => {
    setEditing(r);
    setForm({
      title: r.title,
      category: r.category || "general",
      priority: r.priority || "routine",
      status: r.status || "open",
      assignedTo: r.assignedTo || "",
      dueAt: r.dueAt || "",
      details: r.details || "",
    });
    setOpen(true);
  };

  const submit = () => {
    if (!form.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, patch: { ...form, title: form.title.trim(), details: form.details.trim() } });
    } else {
      createMut.mutate({ ...form, title: form.title.trim(), details: form.details.trim() });
    }
  };

  const grouped = useMemo(() => {
    const m = new Map<string, SupportRequest[]>();
    for (const s of rows) {
      const list = m.get(s.status) ?? [];
      list.push(s);
      m.set(s.status, list);
    }
    return STATUSES.map((st) => ({ st, rows: m.get(st) ?? [] }));
  }, [rows]);

  return (
    <div className="p-3 md:p-4 tac-page flex flex-col min-h-0 gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-green-400" />
            <h1 className="text-sm font-bold tracking-[0.15em] text-green-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              SUPPORT REQUESTS
            </h1>
          </div>
          <div className="text-[10px] text-muted-foreground tracking-wider mt-0.5">
            Reachback-style requests with assignment and status.
          </div>
        </div>
        <Button size="sm" className="h-8 text-[10px] tracking-wider bg-green-800 hover:bg-green-700" onClick={openNew}>
          <Plus className="h-3.5 w-3.5 mr-1" /> NEW REQUEST
        </Button>
      </div>

      <div className={cn("grid gap-3", mobile ? "grid-cols-1" : "grid-cols-4")}>
        {grouped.map(({ st, rows }) => (
          <div key={st} className="bg-card border border-border rounded min-h-0 flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-[10px] tracking-widest text-muted-foreground flex items-center justify-between">
              <span>{st.replace(/_/g, " ").toUpperCase()}</span>
              <span className="text-[9px] text-muted-foreground/70">{rows.length}</span>
            </div>
            <div className="divide-y divide-border overflow-y-auto min-h-0 max-h-[min(32dvh,360px)] md:max-h-[calc(100vh-260px)]">
              {rows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-secondary/20 transition-colors"
                  onClick={() => openEdit(r)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] bg-secondary px-1.5 rounded text-muted-foreground">{r.priority.toUpperCase()}</span>
                    <span className="text-[10px] font-bold text-foreground/90 truncate">{r.title}</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-1 flex flex-wrap gap-2">
                    <span>CAT: {r.category}</span>
                    {r.assignedTo ? <span>ASSN: {r.assignedTo}</span> : <span>ASSN: —</span>}
                    <span className="ml-auto">BY: {r.createdBy}</span>
                  </div>
                </button>
              ))}
              {rows.length === 0 && !isLoading && (
                <div className="py-6 text-center text-xs text-muted-foreground">NONE</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-wider">
              {editing ? "EDIT SUPPORT REQUEST" : "NEW SUPPORT REQUEST"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="space-y-1">
              <Label className="text-[10px]">TITLE</Label>
              <Input className="h-9 text-xs font-mono" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">CATEGORY</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">PRIORITY</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">STATUS</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ").toUpperCase()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">ASSIGNED TO (OPTIONAL)</Label>
                <Input className="h-9 text-xs font-mono" value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))} placeholder="Overlord" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">DUE AT (OPTIONAL, ISO)</Label>
                <Input className="h-9 text-xs font-mono" value={form.dueAt} onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))} placeholder="2026-04-08T18:00:00Z" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">DETAILS</Label>
              <Textarea className="text-xs font-mono min-h-[7rem]" value={form.details} onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))} />
            </div>
            {editing && (
              <div className="text-[9px] text-muted-foreground">
                Created by {editing.createdBy} · Updated {new Date(editing.updatedAt).toLocaleString()}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
            <Button variant="outline" size="sm" onClick={closeDialog}>Cancel</Button>
            {editing && user && (editing.createdBy === user.username || user.accessLevel === "admin" || user.accessLevel === "owner") && (
              <Button variant="destructive" size="sm" onClick={() => deleteMut.mutate(editing.id)} disabled={deleteMut.isPending}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            )}
            <Button
              size="sm"
              className="bg-green-800 hover:bg-green-700"
              onClick={submit}
              disabled={(editing !== null && !canEdit(editing)) || createMut.isPending || updateMut.isPending}
            >
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

