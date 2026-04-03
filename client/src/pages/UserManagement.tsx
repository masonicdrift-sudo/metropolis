import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Plus, Trash2, Users, ShieldCheck, User } from "lucide-react";
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

export default function UserManagement() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

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
                    {u.role === "admin"
                      ? <ShieldCheck size={12} className="text-yellow-400 shrink-0" />
                      : <User size={12} className="text-green-400 shrink-0" />}
                    <span className="font-mono font-bold tracking-wider">{u.username}</span>
                    {u.username === me?.username && <span className="text-[9px] text-green-500 tracking-wider">(YOU)</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[9px] px-2 py-0.5 rounded font-bold tracking-wider uppercase ${
                    u.role === "admin" ? "badge-standby" : "badge-active"
                  }`}>{u.role === "admin" ? "ADMIN" : "OPERATOR"}</span>
                </td>
                <td className="px-4 py-3 text-[10px] text-muted-foreground font-mono">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3 text-[10px] text-muted-foreground font-mono">{formatDate(u.lastLogin || "")}</td>
                <td className="px-4 py-3">
                  {u.username !== me?.username && (
                    <button onClick={() => del.mutate(u.id)}
                      className="p-1 text-muted-foreground hover:text-red-400 transition-colors" data-testid={`delete-user-${u.id}`}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">NO USERS</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
