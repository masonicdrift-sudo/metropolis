import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Shield, KeyRound } from "lucide-react";
import Register from "./Register";
import { MetropolisLogo } from "@/components/MetropolisLogo";
import { ClassificationBanner, ClassificationBannerSpacer } from "@/components/ClassificationBanner";

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  if (showRegister) return <Register onBack={() => setShowRegister(false)} />;

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
    <div className="min-h-dvh bg-background flex flex-col scanlines overflow-x-hidden">
      <ClassificationBanner />
      <ClassificationBannerSpacer />
      <div className="flex-1 flex items-center justify-center overflow-y-auto overflow-x-hidden px-4 py-8 safe-bottom min-h-0">
      {/* Grid background */}
      <div className="fixed inset-0 map-grid-bg opacity-40 pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm min-w-0">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <MetropolisLogo size="lg" className="mx-auto" />
          </div>
          <div className="text-[10px] text-muted-foreground tracking-[0.3em] mt-1">TACTICAL NODE // SECURE ACCESS</div>
        </div>

        {/* Login card */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-5 pb-3 border-b border-border">
            <Lock size={12} className="text-blue-400" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-blue-400">AUTHENTICATION REQUIRED</span>
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
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700 tracking-wider uppercase"
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
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !username || !password}
              data-testid="button-login"
              className="w-full bg-blue-800 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-blue-100 text-xs font-bold tracking-[0.2em] py-2.5 rounded transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
              {loading ? "AUTHENTICATING..." : "AUTHENTICATE"}
            </button>
          </form>

          <div className="mt-4 pt-3 border-t border-border">
            <button onClick={() => setShowRegister(true)}
              className="w-full flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground hover:text-yellow-400 tracking-wider transition-colors py-1">
              <KeyRound size={10} /> HAVE AN ACCESS CODE? REGISTER HERE
            </button>
            <div className="text-center text-[9px] text-muted-foreground/40 tracking-wider mt-2">
              UNAUTHORIZED ACCESS PROHIBITED // AES-256
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-center gap-3 mt-4 text-[9px] text-muted-foreground tracking-wider">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />NET: SECURE</span>
          <span>▪</span>
          <span>NODE: ALPHA</span>
          <span>▪</span>
          <span>ENC: AES-256</span>
        </div>
      </div>
      </div>
    </div>
  );
}
