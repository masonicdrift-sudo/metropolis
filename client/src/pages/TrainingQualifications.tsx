import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { QualificationDefinition, UserQualification } from "@shared/schema";
import { Plus, Trash2, Pencil, ClipboardCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { SubPageNav } from "@/components/SubPageNav";
import { TRAINING_SUB } from "@/lib/appNav";
import { ProfileLink } from "@/components/ProfileLink";

type RecordRow = UserQualification & {
  qualificationName: string;
  qualificationDescription: string;
};

export default function TrainingQualificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canAdmin = user?.accessLevel === "admin" || user?.accessLevel === "owner";

  const { data: definitions = [] } = useQuery<QualificationDefinition[]>({
    queryKey: ["/api/qualifications/definitions"],
    queryFn: () => apiRequest("GET", "/api/qualifications/definitions"),
  });

  const { data: records = [] } = useQuery<RecordRow[]>({
    queryKey: ["/api/qualifications/records"],
    queryFn: () => apiRequest("GET", "/api/qualifications/records"),
    enabled: canAdmin,
  });

  const { data: users = [] } = useQuery<{ username: string }[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users"),
    enabled: canAdmin,
  });

  const [defDialog, setDefDialog] = useState<null | { mode: "add" } | { mode: "edit"; row: QualificationDefinition }>(
    null,
  );
  const [assignOpen, setAssignOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formSort, setFormSort] = useState("0");
  const [assignUser, setAssignUser] = useState("");
  const [assignQualId, setAssignQualId] = useState("");
  const [assignDate, setAssignDate] = useState("");
  const [assignNotes, setAssignNotes] = useState("");

  const sortedDefs = useMemo(
    () => [...definitions].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [definitions],
  );

  const createDef = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("POST", "/api/qualifications/definitions", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/qualifications/definitions"] });
      qc.invalidateQueries({ queryKey: ["/api/qualifications/records"] });
      qc.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Qualification added" });
      setDefDialog(null);
    },
    onError: (e: Error) => toast({ title: e.message || "Save failed", variant: "destructive" }),
  });

  const patchDef = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/qualifications/definitions/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/qualifications/definitions"] });
      qc.invalidateQueries({ queryKey: ["/api/qualifications/records"] });
      qc.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Updated" });
      setDefDialog(null);
    },
    onError: (e: Error) => toast({ title: e.message || "Save failed", variant: "destructive" }),
  });

  const delDef = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/qualifications/definitions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/qualifications/definitions"] });
      qc.invalidateQueries({ queryKey: ["/api/qualifications/records"] });
      qc.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Removed" });
    },
  });

  const createRecord = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("POST", "/api/qualifications/records", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/qualifications/records"] });
      qc.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Recorded" });
      setAssignOpen(false);
      setAssignUser("");
      setAssignQualId("");
      setAssignDate("");
      setAssignNotes("");
    },
    onError: (e: Error) => toast({ title: e.message || "Save failed", variant: "destructive" }),
  });

  const delRecord = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/qualifications/records/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/qualifications/records"] });
      qc.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Removed" });
    },
  });

  const openAddDef = () => {
    setFormName("");
    setFormDesc("");
    setFormSort("0");
    setDefDialog({ mode: "add" });
  };

  const openEditDef = (row: QualificationDefinition) => {
    setFormName(row.name);
    setFormDesc(row.description || "");
    setFormSort(String(row.sortOrder ?? 0));
    setDefDialog({ mode: "edit", row });
  };

  const submitDef = () => {
    const name = formName.trim();
    if (!name) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const sortOrder = Number(formSort) || 0;
    if (defDialog?.mode === "add") {
      createDef.mutate({ name, description: formDesc.trim(), sortOrder });
    } else if (defDialog?.mode === "edit") {
      patchDef.mutate({
        id: defDialog.row.id,
        body: { name, description: formDesc.trim(), sortOrder },
      });
    }
  };

  const submitAssign = () => {
    if (!assignUser || !assignQualId) {
      toast({ title: "User and qualification required", variant: "destructive" });
      return;
    }
    createRecord.mutate({
      username: assignUser,
      qualificationId: Number(assignQualId),
      obtainedAt: assignDate.trim(),
      notes: assignNotes.trim(),
    });
  };

  return (
    <div className="p-3 md:p-4 tac-page space-y-3">
      <SubPageNav items={TRAINING_SUB} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            className="text-sm font-bold tracking-[0.15em] flex items-center gap-2"
            style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
          >
            <ClipboardCheck className="h-4 w-4 text-emerald-400" /> TRAINING RECORDS
          </h1>
          <p className="text-[10px] text-muted-foreground tracking-wider mt-1 max-w-xl">
            Define qualifications here; admins assign them to operators. Obtained qualifications appear on each operator&apos;s
            profile.
          </p>
        </div>
        {canAdmin ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" className="text-[10px] h-8" onClick={openAddDef}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add qualification
            </Button>
            <Button
              size="sm"
              className="text-[10px] h-8 bg-emerald-900/80 hover:bg-emerald-800"
              onClick={() => setAssignOpen(true)}
              disabled={sortedDefs.length === 0}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Record on profile
            </Button>
          </div>
        ) : null}
      </div>

      <div className="rounded-md border border-border bg-card/40 overflow-hidden">
        <div className="text-[10px] font-bold tracking-widest text-muted-foreground px-3 py-2 border-b border-border bg-secondary/20">
          Qualification types
        </div>
        {sortedDefs.length === 0 ? (
          <div className="p-6 text-xs text-muted-foreground text-center">
            {canAdmin
              ? "No qualifications yet — add types (e.g. CLS, range card, drivers) then record them on operators."
              : "No qualifications have been defined yet."}
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {sortedDefs.map((d) => (
              <div key={d.id} className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-foreground">{d.name}</div>
                  {d.description ? (
                    <div className="text-[10px] text-muted-foreground mt-0.5 whitespace-pre-wrap">{d.description}</div>
                  ) : null}
                  <div className="text-[9px] text-muted-foreground/70 mt-1">Sort: {d.sortOrder}</div>
                </div>
                {canAdmin ? (
                  <div className="flex gap-1 shrink-0">
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEditDef(d)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-red-400 hover:text-red-300"
                      onClick={() => {
                        if (confirm(`Delete “${d.name}” and all assignments?`)) delDef.mutate(d.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {canAdmin ? (
        <div className="rounded-md border border-border bg-card/40 overflow-hidden">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground px-3 py-2 border-b border-border bg-secondary/20">
            Recorded on profiles ({records.length})
          </div>
          {records.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">No assignments yet.</div>
          ) : (
            <div className="max-h-[min(60vh,480px)] overflow-y-auto divide-y divide-border/60">
              {records.map((r) => (
                <div key={r.id} className="px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2 text-[10px]">
                  <div className="min-w-0 flex-1">
                    <ProfileLink username={r.username} className="font-mono font-semibold text-blue-300 hover:text-blue-200">
                      {r.username}
                    </ProfileLink>
                    <span className="text-muted-foreground mx-1">·</span>
                    <span className="font-medium">{r.qualificationName}</span>
                    {r.obtainedAt ? (
                      <span className="text-muted-foreground ml-2">
                        Obtained: {new Date(r.obtainedAt.length <= 10 ? `${r.obtainedAt}T12:00:00` : r.obtainedAt).toLocaleDateString()}
                      </span>
                    ) : null}
                    <div className="text-muted-foreground mt-0.5">
                      Recorded by{" "}
                      <ProfileLink username={r.recordedBy} className="font-mono">
                        {r.recordedBy}
                      </ProfileLink>
                      {r.notes ? ` · ${r.notes}` : ""}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-red-400 shrink-0"
                    onClick={() => {
                      if (confirm("Remove this qualification from the operator’s profile?")) delRecord.mutate(r.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <Dialog open={defDialog !== null} onOpenChange={(o) => !o && setDefDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-widest">
              {defDialog?.mode === "add" ? "Add qualification" : "Edit qualification"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div>
              <Label className="text-[10px]">Name</Label>
              <Input className="text-xs h-9" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px]">Description (optional)</Label>
              <Textarea className="text-xs min-h-[72px]" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px]">Sort order (lower first)</Label>
              <Input
                className="text-xs h-9 max-w-[8rem]"
                value={formSort}
                onChange={(e) => setFormSort(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDefDialog(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitDef} disabled={createDef.isPending || patchDef.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-widest">Record qualification</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div>
              <Label className="text-[10px]">Operator</Label>
              <Select value={assignUser} onValueChange={setAssignUser}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.username} value={u.username}>
                      {u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Qualification</Label>
              <Select value={assignQualId} onValueChange={setAssignQualId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {sortedDefs.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Date obtained (optional)</Label>
              <Input className="text-xs h-9" type="date" value={assignDate} onChange={(e) => setAssignDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px]">Notes (optional)</Label>
              <Input className="text-xs h-9" value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitAssign} disabled={createRecord.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
