import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "./pages/Dashboard";
import Operations from "./pages/Operations";
import Intel from "./pages/Intel";
import Communications from "./pages/Communications";
import Assets from "./pages/Assets";
import Threats from "./pages/Threats";
import Units from "./pages/Units";
import NotFound from "./pages/not-found";
import {
  LayoutDashboard, Radio, Target, ShieldAlert,
  Crosshair, Package, Users, Zap
} from "lucide-react";

const NAV = [
  { path: "/", label: "DASHBOARD", icon: LayoutDashboard },
  { path: "/operations", label: "OPERATIONS", icon: Crosshair },
  { path: "/intel", label: "INTELLIGENCE", icon: ShieldAlert },
  { path: "/comms", label: "COMMS", icon: Radio },
  { path: "/assets", label: "ASSETS", icon: Package },
  { path: "/threats", label: "THREAT BOARD", icon: Target },
  { path: "/units", label: "UNITS", icon: Users },
];

function Sidebar() {
  const [location] = useLocation();
  return (
    <aside className="flex flex-col w-[200px] min-h-screen border-r border-border bg-card shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <svg viewBox="0 0 32 32" width="28" height="28" aria-label="TACEDGE logo">
          <rect width="32" height="32" fill="hsl(150 8% 6%)" rx="4" />
          <polygon points="16,3 29,27 3,27" fill="none" stroke="hsl(142 50% 50%)" strokeWidth="2" />
          <line x1="16" y1="3" x2="16" y2="27" stroke="hsl(142 50% 50%)" strokeWidth="1" strokeDasharray="2,3" />
          <circle cx="16" cy="16" r="2" fill="hsl(142 50% 60%)" />
        </svg>
        <div>
          <div className="text-xs font-bold tracking-[0.15em] text-green-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>TACEDGE</div>
          <div className="text-[10px] text-muted-foreground tracking-widest">EDGE NODE v2.4</div>
        </div>
      </div>

      {/* Network status */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-muted-foreground tracking-wider">NET: SECURE ▪ AES-256</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ path, label, icon: Icon }) => {
          const active = location === path || (path !== "/" && location.startsWith(path));
          return (
            <Link key={path} href={path} className={`flex items-center gap-3 px-3 py-2 rounded text-xs tracking-[0.08em] transition-all duration-150 cursor-pointer ${
                active
                  ? "bg-green-950/60 text-green-400 border border-green-900/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`} data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}>
                <Icon size={13} className={active ? "text-green-400" : ""} />
                {label}
              </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <div className="text-[10px] text-muted-foreground space-y-1">
          <div className="flex items-center gap-1"><Zap size={9} className="text-yellow-500" /><span>POWER: NOMINAL</span></div>
          <div className="text-[9px] tracking-wider opacity-60">TOC // SECTOR ALPHA</div>
        </div>
      </div>
    </aside>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background scanlines">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/operations" component={Operations} />
            <Route path="/intel" component={Intel} />
            <Route path="/comms" component={Communications} />
            <Route path="/assets" component={Assets} />
            <Route path="/threats" component={Threats} />
            <Route path="/units" component={Units} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
