import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, KeyRound, Shield, ArrowLeft } from "lucide-react";

export default function Register({ onBack }: { onBack: () => void }) {
  const { login } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ username: "", password: "", confirm: "", accessCode: "" });
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password || !form.accessCode) {
      toast({ title: "All fields are required", variant: "destructive" }); return;
    }
    if (form.password !== form.confirm) {
      toast({ title: "Passwords do not match", variant: "destructive" }); return;
    }
    if (form.password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/register", {
        username: form.username.trim(),
        password: form.password,
        accessCode: form.accessCode.trim().toUpperCase(),
      });
      // Registration auto-logs in — re-fetch session via login flow
      window.location.reload();
    } catch (err: any) {
      toast({ title: err?.message || "Registration failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center scanlines overflow-y-auto overflow-x-hidden px-4 py-8 safe-bottom">
      <div className="fixed inset-0 map-grid-bg opacity-40 pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm min-w-0">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <svg viewBox="0 0 64 64" width="56" height="56" aria-label="METROPOLIS logo">
              <rect width="64" height="64" fill="hsl(226 35% 6%)" rx="8" />
              <polygon points="32,6 58,54 6,54" fill="none" stroke="hsl(217 91% 60%)" strokeWidth="3" />
              <line x1="32" y1="6" x2="32" y2="54" stroke="hsl(217 91% 60%)" strokeWidth="1.5" strokeDasharray="3,4" />
              <circle cx="32" cy="32" r="4" fill="hsl(217 91% 70%)" />
              <circle cx="32" cy="32" r="8" fill="none" stroke="hsl(217 91% 50%)" strokeWidth="1" strokeDasharray="2,3" />
            </svg>
          </div>
          <h1 className="text-lg font-bold tracking-[0.2em] text-blue-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>METROPOLIS</h1>
          <div className="text-[10px] text-muted-foreground tracking-[0.3em] mt-1">NEW OPERATOR REGISTRATION</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-5 pb-3 border-b border-border">
            <KeyRound size={12} className="text-yellow-400" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-yellow-400">ACCESS CODE REQUIRED</span>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">ACCESS CODE</label>
              <input type="text" value={form.accessCode} onChange={set("accessCode")}
                placeholder="XXXX-XXXX-XXXX" maxLength={14}
                data-testid="input-access-code"
                className="w-full bg-secondary border border-yellow-900/50 rounded px-3 py-2 text-xs font-mono text-yellow-300 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-yellow-700 focus:border-yellow-700 tracking-[0.2em] uppercase" />
              <div className="text-[9px] text-muted-foreground/50 mt-1">Obtain a code from an Owner or Administrator</div>
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">USERNAME</label>
              <input type="text" value={form.username} onChange={set("username")}
                placeholder="Choose a callsign..." data-testid="input-reg-username"
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700 uppercase tracking-wider" />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">PASSWORD</label>
              <input type="password" value={form.password} onChange={set("password")}
                placeholder="••••••••" data-testid="input-reg-password"
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-blue-700" />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">CONFIRM PASSWORD</label>
              <input type="password" value={form.confirm} onChange={set("confirm")}
                placeholder="••••••••" data-testid="input-reg-confirm"
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-blue-700" />
            </div>
            <button type="submit" disabled={loading}
              data-testid="button-register"
              className="w-full bg-blue-800 hover:bg-blue-700 disabled:opacity-40 text-blue-100 text-xs font-bold tracking-[0.2em] py-2.5 rounded transition-colors flex items-center justify-center gap-2 mt-1">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
              {loading ? "REGISTERING..." : "CREATE ACCOUNT"}
            </button>
          </form>

          <button onClick={onBack}
            className="w-full mt-3 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground tracking-wider transition-colors">
            <ArrowLeft size={10} /> BACK TO LOGIN
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 mt-4 text-[9px] text-muted-foreground tracking-wider">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />NET: SECURE</span>
          <span>▪</span>
          <span>INVITE-ONLY ACCESS</span>
        </div>
      </div>
    </div>
  );
}
