import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Plus, Trash2, Users, ShieldCheck, User, Crown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface AppUser {
  id: number;
  username: string;
  role: string;
  createdAt: string;
  lastLogin: string;
}

function CreateUserForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState("user");

  const create = useMutation({
    mutationFn: (data: { username: string; password: string; role: string }) =>
      apiRequest("POST", "/api/users", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User created" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to create user", variant: "destructive" });
    },
  });

  const submit = () => {
    if (!username.trim() || !password) { toast({ title: "Fill all fields", variant: "destructive" }); return; }
    if (password !== confirm) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
    if (password.length < 6) { toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return; }
    create.mutate({ username: username.trim(), password, role });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">USERNAME</label>
        <input type="text" value={username} onChange={e => setUsername(e.target.value)}
          placeholder="Enter username..." data-testid="input-new-username"
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-green-700 focus:border-green-700 uppercase tracking-wider" />
      </div>
      <div>
        <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">ROLE</label>
        <div className="flex gap-2">
          {["user", "admin"].map(r => (
            <button key={r} onClick={() => setRole(r)}
              className={`flex-1 py-2 rounded text-[10px] font-bold tracking-widest uppercase transition-all border ${role === r ? "bg-green-900 text-green-400 border-green-700" : "bg-secondary text-muted-foreground border-border hover:text-foreground"}`}>
              {r === "admin" ? "ADMIN" : "OPERATOR"}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">PASSWORD</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="••••••••" data-testid="input-new-password"
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-green-700" />
      </div>
      <div>
        <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">CONFIRM PASSWORD</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
          placeholder="••••••••" data-testid="input-confirm-password"
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-green-700" />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" size="sm" onClick={onClose} className="text-xs">CANCEL</Button>
        <Button size="sm" onClick={submit} disabled={create.isPending}
          className="text-xs bg-green-800 hover:bg-green-700" data-testid="button-create-user">
          CREATE USER
        </Button>
      </div>
    </div>
  );
}

function EditUserForm({ user: target, onClose }: { user: AppUser; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ username: target.username, role: target.role, password: "", confirm: "" });

  const update = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/users/${target.id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "User updated" }); onClose(); },
    onError: (err: any) => toast({ title: err?.message || "Update failed", variant: "destructive" }),
  });

  const submit = () => {
    const payload: any = {};
    if (form.username !== target.username) payload.username = form.username.trim();
    if (form.role !== target.role) payload.role = form.role;
    if (form.password) {
      if (form.password !== form.confirm) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
      if (form.password.length < 6) { toast({ title: "Password must be 6+ characters", variant: "destructive" }); return; }
      payload.password = form.password;
    }
    if (Object.keys(payload).length === 0) { toast({ title: "No changes made" }); return; }
    update.mutate(payload);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">USERNAME</label>
        <input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-green-700 uppercase tracking-wider" />
      </div>
      <div>
        <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">ROLE</label>
        <div className="flex gap-2">
          {["user", "admin", "owner"].map(r => (
            <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
              className={`flex-1 py-1.5 rounded text-[10px] font-bold tracking-widest uppercase border transition-all ${
                form.role === r
                  ? r === "owner" ? "bg-orange-900/50 text-orange-400 border-orange-700" :
                    r === "admin" ? "bg-yellow-900/50 text-yellow-400 border-yellow-700" :
                    "bg-green-900/50 text-green-400 border-green-700"
                  : "bg-secondary text-muted-foreground border-border hover:text-foreground"
              }`}>{r === "owner" ? "OWNER" : r === "admin" ? "ADMIN" : "OPERATOR"}</button>
          ))}
        </div>
      </div>
      <div className="border-t border-border pt-3">
        <div className="text-[9px] text-muted-foreground tracking-wider mb-2">RESET PASSWORD (leave blank to keep current)</div>
        <div className="space-y-2">
          <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder="New password..." className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-green-700" />
          <input type="password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
            placeholder="Confirm password..." className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-green-700" />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" size="sm" onClick={onClose} className="text-xs">CANCEL</Button>
        <Button size="sm" onClick={submit} disabled={update.isPending} className="text-xs bg-green-800 hover:bg-green-700">SAVE CHANGES</Button>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users"),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "User removed" }); },
    onError: (err: any) => toast({ title: err?.message || "Cannot delete", variant: "destructive" }),
  });

  const formatDate = (iso: string) => {
    if (!iso) return "NEVER";
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).toUpperCase();
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            USER MANAGEMENT
          </h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">
            {users.filter(u => u.role === "admin").length} ADMIN ▪ {users.filter(u => u.role === "user").length} OPERATORS ▪ {users.length} TOTAL
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-green-800 hover:bg-green-700 text-xs tracking-wider gap-1" data-testid="button-new-user">
              <Plus size={12} /> CREATE USER
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="text-sm tracking-widest">CREATE NEW USER</DialogTitle></DialogHeader>
            <CreateUserForm onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-card border border-border rounded px-3 py-2">
          <div className="text-[9px] text-muted-foreground tracking-wider">TOTAL USERS</div>
          <div className="kpi-value text-xl">{users.length}</div>
        </div>
        <div className="bg-card border border-border rounded px-3 py-2">
          <div className="text-[9px] text-muted-foreground tracking-wider">ADMINS</div>
          <div className="kpi-value text-xl text-yellow-400">{users.filter(u => u.role === "admin").length}</div>
        </div>
        <div className="bg-card border border-border rounded px-3 py-2">
          <div className="text-[9px] text-muted-foreground tracking-wider">OPERATORS</div>
          <div className="kpi-value text-xl text-green-400">{users.filter(u => u.role === "user").length}</div>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-card border border-border rounded">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground tracking-[0.12em]">
              <th className="text-left px-4 py-2">USERNAME</th>
              <th className="text-left px-4 py-2">ROLE</th>
              <th className="text-left px-4 py-2">CREATED</th>
              <th className="text-left px-4 py-2">LAST LOGIN</th>
              <th className="text-left px-4 py-2">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map(u => (
              <tr key={u.id} className={`hover:bg-secondary/20 transition-colors ${u.username === me?.username ? "bg-green-950/10" : ""}`} data-testid={`user-row-${u.id}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {u.role === "owner"
                      ? <Crown size={12} className="text-orange-400 shrink-0" />
                      : u.role === "admin"
                      ? <ShieldCheck size={12} className="text-yellow-400 shrink-0" />
                      : <User size={12} className="text-green-400 shrink-0" />}
                    <span className="font-mono font-bold tracking-wider">{u.username}</span>
                    {u.username === me?.username && <span className="text-[9px] text-green-500 tracking-wider">(YOU)</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[9px] px-2 py-0.5 rounded font-bold tracking-wider uppercase ${
                    u.role === "owner" ? "bg-orange-900/30 text-orange-400 border border-orange-800/40" :
                    u.role === "admin" ? "badge-standby" : "badge-active"
                  }`}>{u.role === "owner" ? "OWNER" : u.role === "admin" ? "ADMIN" : "OPERATOR"}</span>
                </td>
                <td className="px-4 py-3 text-[10px] text-muted-foreground font-mono">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3 text-[10px] text-muted-foreground font-mono">{formatDate(u.lastLogin || "")}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {/* Owner can edit any user */}
                    {me?.role === "owner" && (
                      <button onClick={() => setEditUser(u)}
                        className="p-1 text-muted-foreground hover:text-green-400 transition-colors" title="Edit user" data-testid={`edit-user-${u.id}`}>
                        <Crown size={11} className="opacity-0 w-0" />
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    )}
                    {/* Can't delete yourself or anyone with equal/higher role */}
                    {u.username !== me?.username && u.role !== "owner" && (
                      <button onClick={() => del.mutate(u.id)}
                        className="p-1 text-muted-foreground hover:text-red-400 transition-colors" data-testid={`delete-user-${u.id}`}>
                        <Trash2 size={12} />
                      </button>
                    )}
                    {u.role === "owner" && u.username !== me?.username && (
                      <span className="text-[9px] text-orange-400/50 tracking-wider">PROTECTED</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">NO USERS</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit user dialog — Owner only */}
      {editUser && (
        <Dialog open={!!editUser} onOpenChange={v => !v && setEditUser(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm tracking-widest flex items-center gap-2">
                EDIT USER — <span className="font-mono text-green-400">{editUser.username}</span>
              </DialogTitle>
            </DialogHeader>
            <EditUserForm user={editUser} onClose={() => setEditUser(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
