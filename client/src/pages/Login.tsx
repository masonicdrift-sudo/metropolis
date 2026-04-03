import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Shield } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      toast({ title: "ACCESS DENIED", description: err?.message || "Invalid credentials", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center scanlines">
      {/* Grid background */}
      <div className="absolute inset-0 map-grid-bg opacity-40 pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <svg viewBox="0 0 64 64" width="56" height="56" aria-label="TACEDGE logo">
              <rect width="64" height="64" fill="hsl(150 8% 6%)" rx="8" />
              <polygon points="32,6 58,54 6,54" fill="none" stroke="hsl(142 50% 50%)" strokeWidth="3" />
              <line x1="32" y1="6" x2="32" y2="54" stroke="hsl(142 50% 50%)" strokeWidth="1.5" strokeDasharray="3,4" />
              <circle cx="32" cy="32" r="4" fill="hsl(142 50% 60%)" />
              <circle cx="32" cy="32" r="8" fill="none" stroke="hsl(142 50% 40%)" strokeWidth="1" strokeDasharray="2,3" />
            </svg>
          </div>
          <h1 className="text-lg font-bold tracking-[0.2em] text-green-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            TACEDGE
          </h1>
          <div className="text-[10px] text-muted-foreground tracking-[0.3em] mt-1">TACTICAL EDGE NODE // SECURE ACCESS</div>
        </div>

        {/* Login card */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-5 pb-3 border-b border-border">
            <Lock size={12} className="text-green-400" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-green-400">AUTHENTICATION REQUIRED</span>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">USERNAME</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter callsign..."
                autoComplete="username"
                data-testid="input-username"
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-green-700 focus:border-green-700 tracking-wider uppercase"
              />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground tracking-[0.15em] block mb-1.5">PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                data-testid="input-password"
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-green-700 focus:border-green-700"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !username || !password}
              data-testid="button-login"
              className="w-full bg-green-800 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-green-100 text-xs font-bold tracking-[0.2em] py-2.5 rounded transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
              {loading ? "AUTHENTICATING..." : "AUTHENTICATE"}
            </button>
          </form>

          <div className="mt-4 pt-3 border-t border-border text-center">
            <div className="text-[9px] text-muted-foreground/50 tracking-wider">
              UNAUTHORIZED ACCESS PROHIBITED // AES-256
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-center gap-3 mt-4 text-[9px] text-muted-foreground tracking-wider">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />NET: SECURE</span>
          <span>▪</span>
          <span>NODE: ALPHA</span>
          <span>▪</span>
          <span>ENC: AES-256</span>
        </div>
      </div>
    </div>
  );
}
