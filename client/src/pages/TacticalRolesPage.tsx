import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { TACTICAL_PERMISSION_DEFS } from "@shared/tacticalPermissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type TacticalRoleRow = {
  id: number;
  name: string;
  color: string;
  permissions: string[];
  sortOrder: number;
  createdAt: string;
};

function groupLabel(group: string) {
  return group;
}

export default function TacticalRolesPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<TacticalRoleRow | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: roles = [], isLoading } = useQuery<TacticalRoleRow[]>({
    queryKey: ["/api/tactical-roles"],
    queryFn: () => apiRequest("GET", "/api/tactical-roles"),
    enabled: me?.accessLevel === "admin" || me?.accessLevel === "owner",
  });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tactical-roles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tactical-roles"] });
      toast({ title: "Role deleted" });
    },
    onError: (err: Error) => toast({ title: err?.message || "Cannot delete", variant: "destructive" }),
  });

  if (me?.accessLevel !== "admin" && me?.accessLevel !== "owner") {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground tracking-wider">ADMIN ACCESS ONLY</div>
    );
  }

  return (
    <div className="p-3 md:p-4 tac-page max-w-4xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            TACTICAL PERMISSION ROLES
          </h1>
          <p className="text-[10px] text-muted-foreground tracking-wider mt-1 max-w-lg">
            Create roles and assign which areas of the node each role can see. Users can have multiple roles; capabilities merge (Discord-style).
            The <span className="text-cyan-400/90">Base node access</span> role cannot be deleted.
          </p>
        </div>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-800 hover:bg-blue-700 text-xs tracking-wider gap-1">
              <Plus size={12} /> NEW ROLE
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm tracking-widest">CREATE ROLE</DialogTitle>
            </DialogHeader>
            <RoleForm
              onClose={() => setCreating(false)}
              onSaved={() => {
                setCreating(false);
                qc.invalidateQueries({ queryKey: ["/api/tactical-roles"] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <div className="text-[10px] text-muted-foreground tracking-wider">LOADING…</div>}

      <div className="space-y-3">
        {roles.map((r) => (
          <div
            key={r.id}
            className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-start gap-3"
          >
            <div
              className="w-3 h-3 rounded-full shrink-0 mt-1"
              style={{ backgroundColor: r.color || "#5865F2" }}
            />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold tracking-wider">{r.name}</span>
                {r.name === "Base node access" && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/50 text-cyan-400 border border-cyan-900/40">
                    DEFAULT
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.permissions.includes("*") ? (
                  <span className="text-[9px] px-2 py-0.5 rounded bg-secondary text-foreground border border-border">
                    ALL AREAS (*)
                  </span>
                ) : (
                  r.permissions.map((p) => (
                    <span
                      key={p}
                      className="text-[9px] px-2 py-0.5 rounded bg-secondary/80 text-muted-foreground border border-border/60 font-mono"
                    >
                      {p}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setEditing(r)}
                className="p-2 text-muted-foreground hover:text-blue-400 transition-colors"
                title="Edit"
              >
                <Pencil size={14} />
              </button>
              {r.name !== "Base node access" && (
                <button
                  type="button"
                  onClick={() => del.mutate(r.id)}
                  className="p-2 text-muted-foreground hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm tracking-widest">EDIT ROLE — {editing.name}</DialogTitle>
            </DialogHeader>
            <RoleForm
              initial={editing}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                qc.invalidateQueries({ queryKey: ["/api/tactical-roles"] });
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function RoleForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: TacticalRoleRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#5865F2");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [star, setStar] = useState(initial?.permissions?.includes("*") ?? false);
  const [sel, setSel] = useState<Set<string>>(() => new Set(initial?.permissions?.filter((p) => p !== "*") ?? []));

  const save = useMutation({
    mutationFn: async () => {
      const perms = star ? ["*"] : Array.from(sel);
      if (!star && perms.length === 0) throw new Error("Select at least one area, or enable Full access (*)");
      if (initial) {
        return apiRequest("PATCH", `/api/tactical-roles/${initial.id}`, {
          name: name.trim(),
          color,
          permissions: perms,
          sortOrder: Number(sortOrder) || 0,
        });
      }
      return apiRequest("POST", "/api/tactical-roles", {
        name: name.trim(),
        color,
        permissions: perms,
        sortOrder: Number(sortOrder) || 0,
      });
    },
    onSuccess: () => {
      toast({ title: initial ? "Role updated" : "Role created" });
      onSaved();
    },
    onError: (err: Error) => toast({ title: err?.message || "Save failed", variant: "destructive" }),
  });

  const toggle = (key: string) => {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const groups = Array.from(new Set(TACTICAL_PERMISSION_DEFS.map((d) => d.group)));

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1">NAME</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono"
          placeholder="e.g. Intel cell"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1">COLOR</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full h-9 rounded border border-border bg-secondary cursor-pointer"
          />
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1">SORT</label>
          <input
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono"
            type="number"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={star} onChange={(e) => setStar(e.target.checked)} />
        <span className="text-xs tracking-wider">Full access — all areas (*)</span>
      </label>
      {!star && (
        <div className="border border-border rounded-md p-3 space-y-3 max-h-[40vh] overflow-y-auto">
          {groups.map((group) => {
            const defs = TACTICAL_PERMISSION_DEFS.filter((d) => d.group === group);
            return (
            <div key={group}>
              <div className="text-[9px] text-muted-foreground tracking-widest mb-2">{groupLabel(group)}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {defs.map((d) => (
                  <label key={d.key} className="flex items-start gap-2 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={sel.has(d.key)}
                      onChange={() => toggle(d.key)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-mono text-[10px] text-cyan-500/90">{d.key}</span>
                      <span className="text-muted-foreground"> — {d.label}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      )}
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>
          CANCEL
        </Button>
        <Button
          size="sm"
          className={cn("text-xs bg-blue-800 hover:bg-blue-700")}
          disabled={save.isPending || !name.trim()}
          onClick={() => save.mutate()}
        >
          {initial ? "SAVE" : "CREATE"}
        </Button>
      </div>
    </div>
  );
}
