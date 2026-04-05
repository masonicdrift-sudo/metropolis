import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuth } from "./lib/auth";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "./pages/Dashboard";
import Operations from "./pages/Operations";
import Intel from "./pages/Intel";
import Communications from "./pages/Communications";
import Assets from "./pages/Assets";
import Threats from "./pages/Threats";
import Units from "./pages/Units";
import UserManagement from "./pages/UserManagement";
import AccessCodes from "./pages/AccessCodes";
import Messaging from "./pages/Messaging";
import CommoCardPage from "./pages/CommoCard";
import Login from "./pages/Login";
import NotFound from "./pages/not-found";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./lib/queryClient";
import {
  LayoutDashboard, Radio, Target, ShieldAlert,
  Crosshair, Package, Users, Zap, LogOut, ShieldCheck, KeyRound, Crown, MessageSquare, Signal
} from "lucide-react";

const NAV = [
  { path: "/", label: "DASHBOARD", icon: LayoutDashboard },
  { path: "/operations", label: "OPERATIONS", icon: Crosshair },
  { path: "/intel", label: "INTELLIGENCE", icon: ShieldAlert },
  { path: "/comms", label: "COMMS", icon: Radio },
  { path: "/commo-card", label: "COMMO CARD", icon: Signal },
  { path: "/assets", label: "ASSETS", icon: Package },
  { path: "/threats", label: "THREAT BOARD", icon: Target },
  { path: "/units", label: "UNITS", icon: Users },
];

function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  // Unread message badge
  const { data: unread } = useQuery<{ dms: number; general: number }>({
    queryKey: ["/api/messages/unread"],
    queryFn: () => apiRequest("GET", "/api/messages/unread"),
    refetchInterval: 15000,
    enabled: !!user,
  });
  const totalUnread = (unread?.dms || 0) + (unread?.general || 0);

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

        {/* Messaging — for all users */}
        {(() => {
          const path = "/messages";
          const active = location === path || location.startsWith(path);
          return (
            <Link href={path} className={`flex items-center justify-between px-3 py-2 rounded text-xs tracking-[0.08em] transition-all duration-150 cursor-pointer ${
              active ? "bg-green-950/60 text-green-400 border border-green-900/60" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`} data-testid="nav-messages">
              <div className="flex items-center gap-3">
                <MessageSquare size={13} className={active ? "text-green-400" : ""} />
                MESSAGES
              </div>
              {totalUnread > 0 && !active && (
                <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 rounded-full min-w-[16px] text-center">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </Link>
          );
        })()}

        {/* Admin+: User Management */}
        {(user?.role === "admin" || user?.role === "owner") && (
          <Link href="/users" className={`flex items-center gap-3 px-3 py-2 rounded text-xs tracking-[0.08em] transition-all duration-150 cursor-pointer ${
            location === "/users"
              ? "bg-yellow-950/60 text-yellow-400 border border-yellow-900/60"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`} data-testid="nav-users">
            <ShieldCheck size={13} className={location === "/users" ? "text-yellow-400" : ""} />
            USER MGMT
          </Link>
        )}

        {/* Owner-only: Access Codes */}
        {user?.role === "owner" && (
          <Link href="/access-codes" className={`flex items-center gap-3 px-3 py-2 rounded text-xs tracking-[0.08em] transition-all duration-150 cursor-pointer ${
            location === "/access-codes"
              ? "bg-orange-950/60 text-orange-400 border border-orange-900/60"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`} data-testid="nav-access-codes">
            <KeyRound size={13} className={location === "/access-codes" ? "text-orange-400" : ""} />
            ACCESS CODES
          </Link>
        )}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-3 border-t border-border space-y-2">
        <div className="flex items-center gap-2 px-1">
          <div className={`w-5 h-5 rounded border flex items-center justify-center ${
            user?.role === "owner" ? "bg-orange-900/50 border-orange-800/50" :
            user?.role === "admin" ? "bg-yellow-900/50 border-yellow-800/50" :
            "bg-green-900/50 border-green-800/50"
          }`}>
            {user?.role === "owner"
              ? <Crown size={11} className="text-orange-400" />
              : user?.role === "admin"
              ? <ShieldCheck size={11} className="text-yellow-400" />
              : <Users size={11} className="text-green-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-foreground truncate font-mono tracking-wider">{user?.username}</div>
            <div className={`text-[9px] tracking-wider uppercase ${
              user?.role === "owner" ? "text-orange-400" :
              user?.role === "admin" ? "text-yellow-400" : "text-muted-foreground"
            }`}>{user?.role === "owner" ? "OWNER" : user?.role === "admin" ? "ADMINISTRATOR" : "OPERATOR"}</div>
          </div>
        </div>
        <button onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-[10px] text-muted-foreground hover:text-red-400 hover:bg-red-950/20 transition-all tracking-wider"
          data-testid="button-logout">
          <LogOut size={11} />LOGOUT
        </button>
        <div className="text-[9px] text-muted-foreground/50 tracking-wider px-1">TOC // SECTOR ALPHA</div>
      </div>
    </aside>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background scanlines">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto flex flex-col">
        {children}
      </main>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center scanlines">
        <div className="text-center space-y-2">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-[10px] text-muted-foreground tracking-widest">INITIALIZING NODE...</div>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/operations" component={Operations} />
        <Route path="/intel" component={Intel} />
        <Route path="/comms" component={Communications} />
        <Route path="/assets" component={Assets} />
        <Route path="/threats" component={Threats} />
        <Route path="/units" component={Units} />
        <Route path="/messages" component={Messaging} />
        <Route path="/commo-card" component={CommoCardPage} />
        <Route path="/users" component={(user.role === "admin" || user.role === "owner") ? UserManagement : () => <div className="p-8 text-center text-xs text-muted-foreground">ACCESS DENIED</div>} />
        <Route path="/access-codes" component={user.role === "owner" ? AccessCodes : () => <div className="p-8 text-center text-xs text-muted-foreground">OWNER ACCESS ONLY</div>} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router hook={useHashLocation}>
          <AppRoutes />
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
