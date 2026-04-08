import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Check, Eye, EyeOff, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileLink } from "@/components/ProfileLink";

export default function ChangePassword() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [newUsername, setNewUsername] = useState("");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [usernameDone, setUsernameDone] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [done, setDone] = useState(false);

  const change = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/change-password", {
      currentPassword: form.current,
      newPassword: form.next,
    }),
    onSuccess: () => {
      toast({ title: "Password changed successfully" });
      setForm({ current: "", next: "", confirm: "" });
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    },
    onError: (err: any) => toast({ title: err?.message || "Failed to change password", variant: "destructive" }),
  });

  const changeUsername = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/auth/change-username", {
        newUsername: newUsername.trim(),
        currentPassword: usernamePassword,
      }),
    onSuccess: async () => {
      toast({ title: "Username updated" });
      setNewUsername("");
      setUsernamePassword("");
      setUsernameDone(true);
      setTimeout(() => setUsernameDone(false), 4000);
      await refreshUser();
    },
    onError: (err: any) => toast({ title: err?.message || "Could not change username", variant: "destructive" }),
  });

  const strength = (p: string) => {
    if (!p) return { score: 0, label: "", color: "" };
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    const labels = ["", "WEAK", "FAIR", "GOOD", "STRONG"];
    const colors = ["", "text-red-400", "text-orange-400", "text-yellow-400", "text-blue-400"];
    return { score: s, label: labels[s] || "WEAK", color: colors[s] || "text-red-400" };
  };

  const pw = strength(form.next);
  const mismatch = form.confirm && form.next !== form.confirm;
  const canSubmit = form.current && form.next.length >= 6 && form.next === form.confirm;
  const trimmedNew = newUsername.trim();
  const canChangeUsername =
    trimmedNew.length >= 2 &&
    trimmedNew !== user?.username &&
    !!usernamePassword &&
    !changeUsername.isPending;

  const PasswordInput = ({ value, onChange, show, toggle, placeholder }: {
    value: string; onChange: (v: string) => void;
    show: boolean; toggle: () => void; placeholder: string;
  }) => (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-blue-600 pr-9"
      />
      <button type="button" onClick={toggle}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff size={12} /> : <Eye size={12} />}
      </button>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-md w-full mx-auto tac-page">
      <div className="mb-6">
        <h1 className="text-sm font-bold tracking-[0.15em]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          SETTINGS
        </h1>
        <div className="text-[10px] text-muted-foreground tracking-wider">
          Signed in as{" "}
          <ProfileLink username={user?.username} className="text-blue-400 font-mono hover:text-blue-300">
            {user?.username}
          </ProfileLink>
        </div>
      </div>

      {/* Username */}
      <div className="bg-card border border-border rounded p-5 space-y-4 mb-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <User size={12} className="text-blue-400" />
          <span className="text-[10px] font-bold tracking-[0.2em] text-blue-400">DISPLAY NAME</span>
        </div>
        <p className="text-[9px] text-muted-foreground/80 leading-relaxed">
          Your username is used across messages, training records, and accountability. Changing it updates your history everywhere on this node.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">NEW USERNAME</label>
            <input
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              placeholder={user?.username || "username"}
              className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-blue-600"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">CURRENT PASSWORD (confirm it&apos;s you)</label>
            <input
              type="password"
              value={usernamePassword}
              onChange={e => setUsernamePassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-blue-600"
              autoComplete="current-password"
            />
          </div>
        </div>
        <Button
          type="button"
          onClick={() => changeUsername.mutate()}
          disabled={!canChangeUsername}
          className={`w-full text-xs tracking-wider gap-1.5 ${usernameDone ? "bg-blue-700" : "bg-blue-800 hover:bg-blue-700"}`}>
          {usernameDone ? <><Check size={12} /> USERNAME UPDATED</> : changeUsername.isPending ? "UPDATING..." : "SAVE USERNAME"}
        </Button>
      </div>

      <div className="bg-card border border-border rounded p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <KeyRound size={12} className="text-blue-400" />
          <span className="text-[10px] font-bold tracking-[0.2em] text-blue-400">PASSWORD</span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">CURRENT PASSWORD</label>
            <PasswordInput value={form.current} onChange={v => setForm(f => ({ ...f, current: v }))}
              show={showCurrent} toggle={() => setShowCurrent(s => !s)} placeholder="Enter current password" />
          </div>

          <div>
            <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">NEW PASSWORD</label>
            <PasswordInput value={form.next} onChange={v => setForm(f => ({ ...f, next: v }))}
              show={showNew} toggle={() => setShowNew(s => !s)} placeholder="Enter new password (min 6 chars)" />
            {form.next && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex gap-0.5 flex-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
                      i <= pw.score
                        ? i === 1 ? "bg-red-500" : i === 2 ? "bg-orange-500" : i === 3 ? "bg-yellow-500" : "bg-blue-500"
                        : "bg-secondary"
                    }`} />
                  ))}
                </div>
                <span className={`text-[9px] font-bold tracking-wider ${pw.color}`}>{pw.label}</span>
              </div>
            )}
            {form.next && (
              <div className="mt-1 space-y-0.5">
                {[
                  { label: "8+ characters", ok: form.next.length >= 8 },
                  { label: "Uppercase letter", ok: /[A-Z]/.test(form.next) },
                  { label: "Number", ok: /[0-9]/.test(form.next) },
                  { label: "Special character", ok: /[^A-Za-z0-9]/.test(form.next) },
                ].map(r => (
                  <div key={r.label} className={`flex items-center gap-1.5 text-[9px] ${r.ok ? "text-blue-400" : "text-muted-foreground/50"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${r.ok ? "bg-blue-500" : "bg-muted-foreground/30"}`} />
                    {r.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">CONFIRM NEW PASSWORD</label>
            <div className="relative">
              <input type="password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="Repeat new password"
                className={`w-full bg-secondary border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 ${
                  mismatch ? "border-red-800 focus:ring-red-700" : "border-border focus:ring-blue-600"
                }`} />
            </div>
            {mismatch && <div className="text-[9px] text-red-400 mt-1 tracking-wider">Passwords do not match</div>}
          </div>
        </div>

        <Button
          onClick={() => change.mutate()}
          disabled={!canSubmit || change.isPending}
          className={`w-full text-xs tracking-wider gap-1.5 ${done ? "bg-blue-700" : "bg-blue-800 hover:bg-blue-700"}`}>
          {done ? <><Check size={12} /> CHANGED</> : change.isPending ? "UPDATING..." : <><KeyRound size={12} /> UPDATE PASSWORD</>}
        </Button>

        <div className="text-[9px] text-muted-foreground/50 text-center tracking-wider pt-1">
          You will remain logged in after changing your password.
        </div>
      </div>

      {/* Security tips */}
      <div className="mt-4 bg-card border border-border rounded p-3">
        <div className="text-[9px] font-bold tracking-wider text-muted-foreground mb-2">OPSEC — PASSWORD GUIDANCE</div>
        <div className="space-y-1 text-[9px] text-muted-foreground/60 leading-relaxed">
          <div>▪ Use a minimum of 12 characters for stronger security</div>
          <div>▪ Never share your password with other operators</div>
          <div>▪ Do not reuse passwords across platforms</div>
          <div>▪ Use a mix of upper/lower, numbers, and symbols</div>
          <div>▪ Change password if you suspect compromise</div>
        </div>
      </div>
    </div>
  );
}
