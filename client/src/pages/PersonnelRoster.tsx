import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { PersonnelRosterEntry } from "@shared/schema";
import { useMemo, useState, type ComponentProps } from "react";
import { ClipboardList, Pencil, Plus, Trash2, ChevronUp, ChevronDown, UserCircle2 } from "lucide-react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SubPageNav } from "@/components/SubPageNav";
import { personnelSubNavForAccess } from "@/lib/appNav";

const STATUS_OPTIONS = [
  { value: "present", label: "Present" },
  { value: "TDY", label: "TDY" },
  { value: "leave", label: "Leave" },
  { value: "absent", label: "Absent" },
  { value: "other", label: "Other" },
] as const;

function emptyForm(): Record<string, string> {
  return {
    lineNo: "",
    lastName: "",
    firstName: "",
    rank: "",
    mos: "",
    billet: "",
    unit: "",
    teamAssignment: "",
    cellTags: "",
    linkedUsername: "",
    status: "present",
    notes: "",
  };
}

function entryToForm(e: PersonnelRosterEntry): Record<string, string> {
  return {
    lineNo: e.lineNo,
    lastName: e.lastName,
    firstName: e.firstName,
    rank: e.rank,
    mos: e.mos,
    billet: e.billet,
    unit: e.unit,
    teamAssignment: e.teamAssignment,
    cellTags: e.cellTags ?? "",
    linkedUsername: e.linkedUsername,
    status: e.status,
    notes: e.notes,
  };
}

function RosterForm({
  form,
  setForm,
  onSubmit,
  submitting,
  submitLabel,
}: {
  form: Record<string, string>;
  setForm: (f: Record<string, string>) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
}) {
  const field = (key: keyof ReturnType<typeof emptyForm>, label: string, props?: ComponentProps<typeof Input>) => (
    <div className="space-y-1">
      <Label className="text-[10px] tracking-wider">{label}</Label>
      <Input
        className="text-xs"
        value={form[key]}
        onChange={(ev) => setForm({ ...form, [key]: ev.target.value })}
        {...props}
      />
    </div>
  );

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-2">
        {field("lineNo", "# / LINE")}
        {field("rank", "RANK")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {field("lastName", "LAST NAME")}
        {field("firstName", "FIRST NAME")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {field("mos", "MOS / AFSC")}
        {field("billet", "BILLET / DUTY")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {field("unit", "UNIT / TEAM")}
        {field("teamAssignment", "TEAM ASSIGNMENT (WRITE-IN)")}
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] tracking-wider">CELL TAGS</Label>
        <Input
          className="text-xs"
          value={form.cellTags}
          onChange={(ev) => setForm({ ...form, cellTags: ev.target.value })}
          placeholder="Cell / sub-unit tags"
        />
        <p className="text-[9px] text-muted-foreground">Comma-separated is ok (e.g. A1, BLUE).</p>
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] tracking-wider">LINK TO PROFILE (USERNAME)</Label>
        <Input
          className="text-xs font-mono"
          value={form.linkedUsername}
          onChange={(ev) => setForm({ ...form, linkedUsername: ev.target.value })}
          placeholder="Operator username — optional"
        />
        <p className="text-[9px] text-muted-foreground">Must match an existing account. Opens that operator&apos;s profile from the roster.</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] tracking-wider">STATUS</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-[10px] tracking-wider">NOTES</Label>
        <Textarea
          className="text-xs min-h-[72px]"
          value={form.notes}
          onChange={(ev) => setForm({ ...form, notes: ev.target.value })}
          placeholder="Equipment, location, remarks…"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" size="sm" className="text-xs" onClick={onSubmit} disabled={submitting}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

export default function PersonnelRosterPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isStaff = user?.accessLevel === "admin" || user?.accessLevel === "owner";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PersonnelRosterEntry | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<PersonnelRosterEntry | null>(null);

  const { data: entries = [], isLoading } = useQuery<PersonnelRosterEntry[]>({
    queryKey: ["/api/personnel-roster"],
    queryFn: () => apiRequest("GET", "/api/personnel-roster"),
  });

  const sorted = useMemo(
    () => [...entries].sort((a, b) => (a.sortOrder - b.sortOrder) || (a.id - b.id)),
    [entries],
  );

  const canEdit = (e: PersonnelRosterEntry) => isStaff || e.createdBy === user?.username;

  const createMut = useMutation({
    mutationFn: (body: Record<string, string>) =>
      apiRequest("POST", "/api/personnel-roster", {
        lineNo: body.lineNo,
        lastName: body.lastName,
        firstName: body.firstName,
        rank: body.rank,
        mos: body.mos,
        billet: body.billet,
        unit: body.unit,
        teamAssignment: body.teamAssignment,
        cellTags: body.cellTags,
        linkedUsername: body.linkedUsername,
        status: body.status,
        notes: body.notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/personnel-roster"] });
      toast({ title: "Line added" });
      setDialogOpen(false);
      setForm(emptyForm());
    },
    onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, string> }) =>
      apiRequest("PATCH", `/api/personnel-roster/${id}`, {
        lineNo: body.lineNo,
        lastName: body.lastName,
        firstName: body.firstName,
        rank: body.rank,
        mos: body.mos,
        billet: body.billet,
        unit: body.unit,
        teamAssignment: body.teamAssignment,
        cellTags: body.cellTags,
        linkedUsername: body.linkedUsername,
        status: body.status,
        notes: body.notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/personnel-roster"] });
      toast({ title: "Line updated" });
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/personnel-roster/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/personnel-roster"] });
      toast({ title: "Line removed" });
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const moveMut = useMutation({
    mutationFn: async ({ a, b }: { a: PersonnelRosterEntry; b: PersonnelRosterEntry }) => {
      const ao = a.sortOrder;
      const bo = b.sortOrder;
      const temp = Math.floor(Date.now() % 1_000_000) + 1_000_000;
      await apiRequest("PATCH", `/api/personnel-roster/${a.id}`, { sortOrder: temp });
      await apiRequest("PATCH", `/api/personnel-roster/${b.id}`, { sortOrder: ao });
      await apiRequest("PATCH", `/api/personnel-roster/${a.id}`, { sortOrder: bo });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/personnel-roster"] });
    },
    onError: (err: Error) => toast({ title: "Reorder failed", description: err.message, variant: "destructive" }),
  });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (e: PersonnelRosterEntry) => {
    if (!canEdit(e)) return;
    setEditing(e);
    setForm(entryToForm(e));
    setDialogOpen(true);
  };

  const submit = () => {
    if (editing) {
      updateMut.mutate({ id: editing.id, body: form });
    } else {
      createMut.mutate(form);
    }
  };

  const move = (id: number, dir: "up" | "down") => {
    const idx = sorted.findIndex((e) => e.id === id);
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= sorted.length) return;
    moveMut.mutate({ a: sorted[idx], b: sorted[j] });
  };

  return (
    <div className="p-3 md:p-4 tac-page">
      <SubPageNav items={personnelSubNavForAccess(user?.accessLevel)} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h1
            className="text-sm font-bold tracking-[0.15em] flex items-center gap-2"
            style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
          >
            <ClipboardList className="h-4 w-4 opacity-80" />
            PERSONNEL ROSTER
          </h1>
          <p className="text-[10px] text-muted-foreground tracking-wider mt-1 max-w-xl">
            Line roster for names, billets, and team assignment. Optionally link a line to an operator username to open their profile.
            Separate from PERSTAT. You can edit lines you added; admins can edit any line.
          </p>
        </div>
        <Button size="sm" className="text-xs tracking-wider gap-1 shrink-0" onClick={openAdd}>
          <Plus size={14} /> ADD LINE
        </Button>
      </div>

      {isLoading && (
        <div className="text-xs text-muted-foreground py-8 text-center">Loading roster…</div>
      )}

      {!isLoading && sorted.length === 0 && (
        <div className="bg-card border border-border rounded-md px-4 py-10 text-center text-muted-foreground text-xs">
          No roster lines yet. Use <span className="text-foreground font-semibold">ADD LINE</span> to create entries.
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block border border-border rounded-md overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/30 text-[10px] tracking-wider text-muted-foreground">
                <th className="text-left p-2 font-medium w-10">#</th>
                <th className="text-left p-2 font-medium">Name</th>
                <th className="text-left p-2 font-medium">Rank</th>
                <th className="text-left p-2 font-medium">MOS</th>
                <th className="text-left p-2 font-medium">Billet</th>
                <th className="text-left p-2 font-medium">Unit</th>
                <th className="text-left p-2 font-medium">Team asgmt</th>
                <th className="text-left p-2 font-medium">Cell tags</th>
                <th className="text-left p-2 font-medium">Linked</th>
                <th className="text-left p-2 font-medium">Status</th>
                <th className="text-left p-2 font-medium w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, i) => (
                <tr key={e.id} className="border-b border-border/60 hover:bg-secondary/10">
                  <td className="p-2 font-mono text-muted-foreground">{e.lineNo || "—"}</td>
                  <td className="p-2">
                    <span className="font-medium">{[e.lastName, e.firstName].filter(Boolean).join(", ") || "—"}</span>
                    {e.notes ? (
                      <span className="block text-[10px] text-muted-foreground truncate max-w-[200px]" title={e.notes}>
                        {e.notes}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-2">{e.rank || "—"}</td>
                  <td className="p-2 font-mono">{e.mos || "—"}</td>
                  <td className="p-2">{e.billet || "—"}</td>
                  <td className="p-2">{e.unit || "—"}</td>
                  <td className="p-2">{e.teamAssignment || "—"}</td>
                  <td className="p-2 max-w-[140px]">
                    {e.cellTags?.trim() ? (
                      <span className="text-[10px] font-mono text-cyan-200/90 tracking-tight line-clamp-2" title={e.cellTags}>
                        {e.cellTags}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2">
                    {e.linkedUsername ? (
                      <Link
                        href={`/profile/${encodeURIComponent(e.linkedUsername)}`}
                        className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-mono text-[10px]"
                      >
                        <UserCircle2 className="h-3 w-3 shrink-0" />
                        {e.linkedUsername}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] tracking-wide",
                        e.status === "present" && "bg-blue-950/50 text-blue-300",
                        e.status === "TDY" && "bg-amber-950/50 text-amber-300",
                        (e.status === "leave" || e.status === "absent") && "bg-slate-800 text-slate-300",
                        e.status === "other" && "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-0.5 flex-wrap">
                      {isStaff && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={i === 0 || moveMut.isPending}
                            onClick={() => move(e.id, "up")}
                            title="Move up"
                          >
                            <ChevronUp size={14} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={i === sorted.length - 1 || moveMut.isPending}
                            onClick={() => move(e.id, "down")}
                            title="Move down"
                          >
                            <ChevronDown size={14} />
                          </Button>
                        </>
                      )}
                      {canEdit(e) && (
                        <>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}>
                            <Pencil size={14} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(e)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {sorted.map((e, i) => (
          <div
            key={e.id}
            className="rounded-md border border-border bg-card p-3 space-y-2"
          >
            <div className="flex justify-between gap-2">
              <div>
                <div className="text-[10px] text-muted-foreground tracking-wider">LINE {e.lineNo || `#${e.id}`}</div>
                <div className="text-sm font-semibold">
                  {[e.lastName, e.firstName].filter(Boolean).join(", ") || "—"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {[e.rank, e.mos, e.billet].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <span
                className={cn(
                  "self-start rounded px-2 py-0.5 text-[10px]",
                  e.status === "present" && "bg-blue-950/50 text-blue-300",
                  e.status === "TDY" && "bg-amber-950/50 text-amber-300",
                )}
              >
                {e.status}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <div>Unit: {e.unit || "—"}</div>
              <div>Team assignment: {e.teamAssignment || "—"}</div>
              <div>Cell tags: {e.cellTags?.trim() || "—"}</div>
              {e.linkedUsername ? (
                <div>
                  Profile:{" "}
                  <Link
                    href={`/profile/${encodeURIComponent(e.linkedUsername)}`}
                    className="text-blue-400 font-mono"
                  >
                    {e.linkedUsername}
                  </Link>
                </div>
              ) : null}
              {e.notes ? <div className="text-foreground/90 pt-1">{e.notes}</div> : null}
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              {isStaff && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-[10px] h-7"
                    disabled={i === 0 || moveMut.isPending}
                    onClick={() => move(e.id, "up")}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-[10px] h-7"
                    disabled={i === sorted.length - 1 || moveMut.isPending}
                    onClick={() => move(e.id, "down")}
                  >
                    Down
                  </Button>
                </>
              )}
              {canEdit(e) && (
                <>
                  <Button type="button" variant="secondary" size="sm" className="text-[10px] h-7" onClick={() => openEdit(e)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-[10px] h-7 text-destructive"
                    onClick={() => setDeleteTarget(e)}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-widest">
              {editing ? "EDIT ROSTER LINE" : "ADD ROSTER LINE"}
            </DialogTitle>
          </DialogHeader>
          <RosterForm
            form={form}
            setForm={setForm}
            onSubmit={submit}
            submitting={createMut.isPending || updateMut.isPending}
            submitLabel={editing ? "SAVE" : "ADD LINE"}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove roster line?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the line from the roster. Other users will see the update immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
