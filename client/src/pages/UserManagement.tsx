import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Plus, Trash2, Users, ShieldCheck, User, Crown, Edit } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ARMY_RANKS, TACTICAL_ROLE_PRESETS } from "@shared/schema";
import type { Unit } from "@shared/schema";
import { US_ARMY_MOS_OPTIONS, US_ARMY_MOS_BY_CODE } from "@shared/usArmyMos";

interface AppUser {
  id: number;
  username: string;
  accessLevel: string;
  role: string; // tactical role
  rank: string;
  assignedUnit: string;
  milIdNumber: string;
  mos: string;
  createdAt: string;
  lastLogin: string;
}

const MOS_SORTED = [...US_ARMY_MOS_OPTIONS].sort((a, b) =>
  a.code.localeCompare(b.code, undefined, { numeric: true }),
);

// ── Rank tier colors ────────────────────────────────────────────────────────
const TIER_COLOR: Record<string, string> = {
  enlisted: "text-blue-400",
  NCO:      "text-yellow-400",
  WO:       "text-blue-400",
  officer:  "text-orange-400",
  MOS:      "text-purple-400",
};
function rankColor(abbr: string) {
  const r = ARMY_RANKS.find(r => r.abbr === abbr);
  return r ? TIER_COLOR[r.tier] || "text-muted-foreground" : "text-muted-foreground";
}

// ── Create User form ─────────────────────────────────────────────────────────
function CreateUserForm({ onClose, units, callerAccess }: { onClose: () => void; units: Unit[]; callerAccess: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirm: "",
    accessLevel: "user",
    role: "",
    rolePreset: "",
    rank: "",
    assignedUnit: "",
    milIdNumber: "",
    mos: "00",
  });

  const create = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/users", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "User created" }); onClose(); },
    onError: (err: any) => toast({ title: err?.message || "Failed to create user", variant: "destructive" }),
  });

  const submit = () => {
    if (!form.username.trim() || !form.password) { toast({ title: "Fill all required fields", variant: "destructive" }); return; }
    if (form.password !== form.confirm) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
    if (form.password.length < 6) { toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return; }
    create.mutate({
      username: form.username.trim(),
      password: form.password,
      accessLevel: form.accessLevel,
      role: (form.rolePreset && form.rolePreset !== "OTHER" ? form.rolePreset : form.role).trim(),
      rank: form.rank,
      assignedUnit: form.assignedUnit,
      milIdNumber: form.milIdNumber.trim(),
      mos: form.mos,
    });
  };

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">USERNAME</label>
        <input type="text" value={form.username} onChange={e => set("username")(e.target.value)}
          placeholder="Enter callsign..." className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700 uppercase tracking-wider" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">RANK</label>
          <select value={form.rank} onChange={e => set("rank")(e.target.value)}
            className="w-full bg-secondary border border-border rounded px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700">
            <option value="">— No Rank —</option>
            {["enlisted","NCO","WO","officer","MOS"].map(tier => (
              <optgroup key={tier} label={`── ${tier.toUpperCase()} ──`}>
                {ARMY_RANKS.filter(r => r.tier === tier).map(r => (
                  <option key={r.abbr} value={r.abbr}>{r.abbr} — {r.full}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">ASSIGNED UNIT</label>
          <select value={form.assignedUnit} onChange={e => set("assignedUnit")(e.target.value)}
            className="w-full bg-secondary border border-border rounded px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700">
            <option value="">— Unassigned —</option>
            {units.map(u => <option key={u.id} value={u.callsign}>{u.callsign}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">TACTICAL ROLE (OPTIONAL)</label>
          <select
            value={form.rolePreset}
            onChange={(e) => set("rolePreset")(e.target.value)}
            className="w-full bg-secondary border border-border rounded px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700 font-bold tracking-wider touch-manipulation min-h-[44px]"
          >
            <option value="">— Select —</option>
            {TACTICAL_ROLE_PRESETS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          {(form.rolePreset === "OTHER" || (!form.rolePreset && !!form.role)) && (
            <input
              type="text"
              value={form.role}
              onChange={(e) => set("role")(e.target.value)}
              placeholder="Custom role…"
              className="w-full mt-2 bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700 uppercase tracking-wider touch-manipulation min-h-[44px]"
            />
          )}
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">ACCESS LEVEL</label>
          <select
            value={form.accessLevel}
            onChange={(e) => set("accessLevel")(e.target.value)}
            className={`w-full bg-secondary border border-border rounded px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700 ${
              form.accessLevel === "owner" ? "text-orange-400" : form.accessLevel === "admin" ? "text-yellow-400" : "text-blue-400"
            } touch-manipulation min-h-[44px]`}
          >
            <option value="user">USER — Standard access</option>
            {(callerAccess === "admin" || callerAccess === "owner") && (
              <option value="admin">ADMIN — Can manage users and content</option>
            )}
            {callerAccess === "owner" && (
              <option value="owner">OWNER — Full system control</option>
            )}
          </select>
          {form.accessLevel === "owner" && (
            <div className="text-[9px] text-orange-400/70 mt-1 tracking-wider">⚠ Granting Owner access gives full system control.</div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">MIL ID #</label>
          <input
            type="text"
            value={form.milIdNumber}
            onChange={(e) => set("milIdNumber")(e.target.value)}
            placeholder="EDIPI / DoD ID"
            className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700"
          />
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">MOS</label>
          <select
            value={form.mos}
            onChange={(e) => set("mos")(e.target.value)}
            className="w-full bg-secondary border border-border rounded px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700"
          >
            {MOS_SORTED.map((o) => (
              <option key={o.code} value={o.code}>
                {o.code} — {o.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* Access level + tactical role are set above */}
      <div>
        <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">PASSWORD</label>
        <input type="password" value={form.password} onChange={e => set("password")(e.target.value)}
          placeholder="••••••••" className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700" />
      </div>
      <div>
        <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">CONFIRM PASSWORD</label>
        <input type="password" value={form.confirm} onChange={e => set("confirm")(e.target.value)}
          placeholder="••••••••" className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700" />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" size="sm" onClick={onClose} className="text-xs">CANCEL</Button>
        <Button size="sm" onClick={submit} disabled={create.isPending} className="text-xs bg-blue-800 hover:bg-blue-700">CREATE USER</Button>
      </div>
    </div>
  );
}

// ── Edit User form (Owner only) ───────────────────────────────────────────────
function EditUserForm({ user: target, onClose, units }: { user: AppUser; onClose: () => void; units: Unit[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    username: target.username,
    accessLevel: target.accessLevel,
    role: target.role || "",
    rolePreset: target.role || "",
    rank: target.rank || "",
    assignedUnit: target.assignedUnit || "",
    milIdNumber: target.milIdNumber || "",
    mos: target.mos || "00",
    password: "",
    confirm: "",
  });

  const update = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/users/${target.id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "User updated" }); onClose(); },
    onError: (err: any) => toast({ title: err?.message || "Update failed", variant: "destructive" }),
  });

  const submit = () => {
    const payload: any = {};
    if (form.username !== target.username) payload.username = form.username.trim();
    if (form.accessLevel !== target.accessLevel) payload.accessLevel = form.accessLevel;
    const nextRole = (form.rolePreset && form.rolePreset !== "OTHER" ? form.rolePreset : form.role).trim();
    if (nextRole !== (target.role || "")) payload.role = nextRole;
    if (form.rank !== (target.rank || "")) payload.rank = form.rank;
    if (form.assignedUnit !== (target.assignedUnit || "")) payload.assignedUnit = form.assignedUnit;
    if (form.milIdNumber !== (target.milIdNumber || "")) payload.milIdNumber = form.milIdNumber;
    if (form.mos !== (target.mos || "00")) payload.mos = form.mos;
    if (form.password) {
      if (form.password !== form.confirm) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
      payload.password = form.password;
    }
    if (Object.keys(payload).length === 0) { toast({ title: "No changes made" }); return; }
    update.mutate(payload);
  };

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">USERNAME</label>
        <input type="text" value={form.username} onChange={e => set("username")(e.target.value)}
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700 uppercase tracking-wider" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">ACCESS LEVEL</label>
          <select
            value={form.accessLevel}
            onChange={(e) => set("accessLevel")(e.target.value)}
            className={`w-full bg-secondary border border-border rounded px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700 font-bold tracking-wider ${
              form.accessLevel === "owner" ? "text-orange-400" : form.accessLevel === "admin" ? "text-yellow-400" : "text-blue-400"
            } touch-manipulation min-h-[44px]`}
          >
            <option value="user">USER</option>
            <option value="admin">ADMIN</option>
            <option value="owner">OWNER</option>
          </select>
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">TACTICAL ROLE (OPTIONAL)</label>
          <select
            value={form.rolePreset}
            onChange={(e) => set("rolePreset")(e.target.value)}
            className="w-full bg-secondary border border-border rounded px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700 font-bold tracking-wider touch-manipulation min-h-[44px]"
          >
            <option value="">— Select —</option>
            {TACTICAL_ROLE_PRESETS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          {(form.rolePreset === "OTHER" || (!form.rolePreset && !!form.role)) && (
            <input
              type="text"
              value={form.role}
              onChange={(e) => set("role")(e.target.value)}
              placeholder="Custom role…"
              className="w-full mt-2 bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700 uppercase tracking-wider touch-manipulation min-h-[44px]"
            />
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">RANK</label>
          <select value={form.rank} onChange={e => set("rank")(e.target.value)}
            className="w-full bg-secondary border border-border rounded px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700">
            <option value="">— No Rank —</option>
            {["enlisted","NCO","WO","officer","MOS"].map(tier => (
              <optgroup key={tier} label={`── ${tier.toUpperCase()} ──`}>
                {ARMY_RANKS.filter(r => r.tier === tier).map(r => (
                  <option key={r.abbr} value={r.abbr}>{r.abbr} — {r.full}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">ASSIGNED UNIT</label>
          <select value={form.assignedUnit} onChange={e => set("assignedUnit")(e.target.value)}
            className="w-full bg-secondary border border-border rounded px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700">
            <option value="">— Unassigned —</option>
            {units.map(u => <option key={u.id} value={u.callsign}>{u.callsign}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">MIL ID #</label>
          <input
            type="text"
            value={form.milIdNumber}
            onChange={(e) => set("milIdNumber")(e.target.value)}
            className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700"
          />
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">MOS</label>
          <select
            value={form.mos}
            onChange={(e) => set("mos")(e.target.value)}
            className="w-full bg-secondary border border-border rounded px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700"
          >
            {MOS_SORTED.map((o) => (
              <option key={o.code} value={o.code}>
                {o.code} — {o.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* Access level + tactical role are set above */}
      <div className="border-t border-border pt-3">
        <div className="text-[9px] text-muted-foreground tracking-wider mb-2">RESET PASSWORD (leave blank to keep)</div>
        <div className="space-y-2">
          <input type="password" value={form.password} onChange={e => set("password")(e.target.value)}
            placeholder="New password..." className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700" />
          <input type="password" value={form.confirm} onChange={e => set("confirm")(e.target.value)}
            placeholder="Confirm..." className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-blue-700" />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" size="sm" onClick={onClose} className="text-xs">CANCEL</Button>
        <Button size="sm" onClick={submit} disabled={update.isPending} className="text-xs bg-blue-800 hover:bg-blue-700">SAVE CHANGES</Button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function UserManagement() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [unitFilter, setUnitFilter] = useState("ALL");

  const { data: users = [] } = useQuery<AppUser[]>({ queryKey: ["/api/users"], queryFn: () => apiRequest("GET", "/api/users") });
  const { data: units = [] } = useQuery<Unit[]>({ queryKey: ["/api/units"], queryFn: () => apiRequest("GET", "/api/units") });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "User removed" }); },
    onError: (err: any) => toast({ title: err?.message || "Cannot delete", variant: "destructive" }),
  });

  const formatDate = (iso: string) => {
    if (!iso) return "NEVER";
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).toUpperCase();
  };

  // Group by unit
  const unitCallsigns = Array.from(new Set(users.map(u => u.assignedUnit || ""))).filter(Boolean);
  const allFilters = ["ALL", "UNASSIGNED", ...unitCallsigns];

  const filtered = users.filter(u => {
    if (unitFilter === "ALL") return true;
    if (unitFilter === "UNASSIGNED") return !u.assignedUnit;
    return u.assignedUnit === unitFilter;
  });

  return (
    <div className="p-3 md:p-4 tac-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>USER MANAGEMENT</h1>
          <div className="text-[10px] text-muted-foreground tracking-wider">
            {users.filter(u => u.accessLevel === "owner").length} OWNER ▪ {users.filter(u => u.accessLevel === "admin").length} ADMIN ▪ {users.filter(u => u.accessLevel === "user").length} USERS
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-800 hover:bg-blue-700 text-xs tracking-wider gap-1">
              <Plus size={12} /> CREATE USER
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="text-sm tracking-widest">CREATE NEW USER</DialogTitle></DialogHeader>
            <CreateUserForm onClose={() => setOpen(false)} units={units} callerAccess={me?.accessLevel || "user"} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Unit filter tabs */}
      <div className="tac-filter-row mb-3">
        {allFilters.map(f => (
          <button key={f} onClick={() => setUnitFilter(f)}
            className={`px-3 py-1 rounded text-[10px] tracking-wider uppercase transition-all ${unitFilter === f ? "bg-blue-900/60 text-blue-400 border border-blue-800/60" : "text-muted-foreground bg-secondary hover:text-foreground"}`}>
            {f} {f !== "ALL" && `(${users.filter(u => f === "UNASSIGNED" ? !u.assignedUnit : u.assignedUnit === f).length})`}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        {[
          { label: "TOTAL USERS", val: users.length, color: "text-blue-400" },
          { label: "WITH RANK", val: users.filter(u => u.rank).length, color: "text-yellow-400" },
          { label: "ASSIGNED", val: users.filter(u => u.assignedUnit).length, color: "text-blue-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded px-3 py-2">
            <div className="text-[9px] text-muted-foreground tracking-wider">{s.label}</div>
            <div className={`kpi-value text-xl ${s.color}`}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="bg-card border border-border rounded overflow-x-auto">
        <table className="w-full text-xs mobile-card-table">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground tracking-[0.12em]">
              <th className="text-left px-4 py-2">USERNAME</th>
              <th className="text-left px-4 py-2">MIL ID</th>
              <th className="text-left px-4 py-2">MOS</th>
              <th className="text-left px-4 py-2">RANK</th>
              <th className="text-left px-4 py-2">UNIT</th>
              <th className="text-left px-4 py-2">TACTICAL ROLE</th>
              <th className="text-left px-4 py-2">ACCESS</th>
              <th className="text-left px-4 py-2">LAST LOGIN</th>
              <th className="text-left px-4 py-2">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(u => (
              <tr key={u.id} className={`hover:bg-secondary/20 transition-colors ${u.username === me?.username ? "bg-blue-950/10" : ""}`}>
                <td className="px-4 py-3" data-label="USERNAME">
                  <div className="flex items-center gap-2">
                    {u.accessLevel === "owner" ? <Crown size={12} className="text-orange-400 shrink-0" />
                      : u.accessLevel === "admin" ? <ShieldCheck size={12} className="text-yellow-400 shrink-0" />
                      : <User size={12} className="text-blue-400 shrink-0" />}
                    <span className="font-mono font-bold tracking-wider">{u.username}</span>
                    {u.username === me?.username && <span className="text-[9px] text-blue-500">(YOU)</span>}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-[10px] text-cyan-400/90" data-label="MIL ID">
                  {u.milIdNumber?.trim() ? u.milIdNumber : <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className="px-4 py-3 max-w-[min(200px,40vw)]" data-label="MOS">
                  {u.mos && u.mos !== "00" ? (
                    <div>
                      <span className="font-mono font-bold text-xs text-purple-400/90">{u.mos}</span>
                      <div className="text-[9px] text-muted-foreground leading-snug line-clamp-2">
                        {US_ARMY_MOS_BY_CODE.get(u.mos) || ""}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/40 text-[10px]">—</span>
                  )}
                </td>
                <td className="px-4 py-3" data-label="RANK">
                  {u.rank ? (
                    <div>
                      <span className={`font-mono font-bold text-xs tracking-wider ${rankColor(u.rank)}`}>{u.rank}</span>
                      <div className="text-[9px] text-muted-foreground">{ARMY_RANKS.find(r => r.abbr === u.rank)?.full}</div>
                    </div>
                  ) : <span className="text-muted-foreground/40 text-[10px]">—</span>}
                </td>
                <td className="px-4 py-3" data-label="UNIT">
                  {u.assignedUnit
                    ? <span className="text-[10px] font-mono font-bold text-blue-400 tracking-wider">{u.assignedUnit}</span>
                    : <span className="text-muted-foreground/40 text-[10px]">UNASSIGNED</span>}
                </td>
                <td className="px-4 py-3" data-label="TACTICAL ROLE">
                  {u.role?.trim()
                    ? <span className="text-[10px] font-mono font-bold text-cyan-300/90 tracking-wider">{u.role}</span>
                    : <span className="text-muted-foreground/40 text-[10px]">—</span>}
                </td>
                <td className="px-4 py-3" data-label="ACCESS">
                  <span className={`text-[9px] px-2 py-0.5 rounded font-bold tracking-wider uppercase ${
                    u.accessLevel === "owner" ? "bg-orange-900/30 text-orange-400 border border-orange-800/40" :
                    u.accessLevel === "admin" ? "badge-standby" : "badge-active"
                  }`}>{u.accessLevel === "owner" ? "OWNER" : u.accessLevel === "admin" ? "ADMIN" : "USER"}</span>
                </td>
                <td className="px-4 py-3 text-[10px] text-muted-foreground font-mono" data-label="LAST LOGIN">{formatDate(u.lastLogin || "")}</td>
                <td className="px-4 py-3" data-label="ACTIONS">
                  <div className="flex items-center gap-1">
                    {me?.accessLevel === "owner" && (
                      <button onClick={() => setEditUser(u)} className="p-1 text-muted-foreground hover:text-blue-400 transition-colors" title="Edit">
                        <Edit size={11} />
                      </button>
                    )}
                    {u.username !== me?.username && u.accessLevel !== "owner" && (
                      <button onClick={() => del.mutate(u.id)} className="p-1 text-muted-foreground hover:text-red-400 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    )}
                    {u.accessLevel === "owner" && u.username !== me?.username && (
                      <span className="text-[9px] text-orange-400/50 tracking-wider">PROTECTED</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">NO USERS IN THIS UNIT</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit dialog */}
      {editUser && (
        <Dialog open={!!editUser} onOpenChange={v => !v && setEditUser(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm tracking-widest flex items-center gap-2">
                EDIT — <span className="font-mono text-blue-400">{editUser.username}</span>
              </DialogTitle>
            </DialogHeader>
            <EditUserForm user={editUser} onClose={() => setEditUser(null)} units={units} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
