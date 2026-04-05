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
import IsofacPage from "./pages/Isofac";
import ChangePassword from "./pages/ChangePassword";
import Login from "./pages/Login";
import NotFound from "./pages/not-found";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./lib/queryClient";
import { useState } from "react";
import {
  LayoutDashboard, Radio, Target, ShieldAlert,
  Crosshair, Package, Users, LogOut, ShieldCheck,
  KeyRound, Crown, MessageSquare, Signal, BookOpen,
  Settings, Menu, X, ChevronRight
} from "lucide-react";

// All nav items
const NAV = [
  { path: "/",            label: "DASHBOARD",    icon: LayoutDashboard, short: "Home" },
  { path: "/operations",  label: "OPERATIONS",   icon: Crosshair,       short: "Ops" },
  { path: "/intel",       label: "INTELLIGENCE", icon: ShieldAlert,     short: "Intel" },
  { path: "/comms",       label: "COMMS",        icon: Radio,           short: "Comms" },
  { path: "/commo-card",  label: "COMMO CARD",   icon: Signal,          short: "Radio" },
  { path: "/isofac",      label: "ISOFAC",       icon: BookOpen,        short: "ISOFAC" },
  { path: "/assets",      label: "ASSETS",       icon: Package,         short: "Assets" },
  { path: "/threats",     label: "THREAT BOARD", icon: Target,          short: "Threats" },
  { path: "/units",       label: "UNITS",        icon: Users,           short: "Units" },
  { path: "/messages",    label: "MESSAGES",     icon: MessageSquare,   short: "Msgs" },
];

// Mobile bottom tab — show 5 most important + "More" drawer
const BOTTOM_TABS = [
  { path: "/",           label: "Home",    icon: LayoutDashboard },
  { path: "/operations", label: "Ops",     icon: Crosshair },
  { path: "/messages",   label: "Msgs",    icon: MessageSquare },
  { path: "/comms",      label: "Comms",   icon: Radio },
  { path: "/isofac",     label: "ISOFAC",  icon: BookOpen },
];

// ── Desktop Sidebar ───────────────────────────────────────────────────────────
function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: unread } = useQuery<{ dms: number; general: number }>({
    queryKey: ["/api/messages/unread"],
    queryFn: () => apiRequest("GET", "/api/messages/unread"),
    refetchInterval: 15000,
    enabled: !!user,
  });
  const totalUnread = (unread?.dms || 0) + (unread?.general || 0);

  return (
    <aside className="hidden md:flex flex-col w-[200px] min-h-screen border-r border-border bg-card shrink-0">
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
          <div className="text-[10px] text-muted-foreground tracking-widest">EDGE NODE v3.0</div>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-muted-foreground tracking-wider">NET: SECURE ▪ AES-256</span>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ path, label, icon: Icon, short }) => {
          const active = location === path || (path !== "/" && location.startsWith(path));
          const isMsg = path === "/messages";
          return (
            <Link key={path} href={path} className={`flex items-center justify-between px-3 py-2 rounded text-xs tracking-[0.08em] transition-all duration-150 cursor-pointer ${
              active ? "bg-green-950/60 text-green-400 border border-green-900/60" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}>
              <div className="flex items-center gap-3">
                <Icon size={13} className={active ? "text-green-400" : ""} />
                {label}
              </div>
              {isMsg && totalUnread > 0 && !active && (
                <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 rounded-full">{totalUnread > 99 ? "99+" : totalUnread}</span>
              )}
            </Link>
          );
        })}

        {(user?.role === "admin" || user?.role === "owner") && (
          <Link href="/users" className={`flex items-center gap-3 px-3 py-2 rounded text-xs tracking-[0.08em] transition-all cursor-pointer ${
            location === "/users" ? "bg-yellow-950/60 text-yellow-400 border border-yellow-900/60" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}>
            <ShieldCheck size={13} /> USER MGMT
          </Link>
        )}
        {user?.role === "owner" && (
          <Link href="/access-codes" className={`flex items-center gap-3 px-3 py-2 rounded text-xs tracking-[0.08em] transition-all cursor-pointer ${
            location === "/access-codes" ? "bg-orange-950/60 text-orange-400 border border-orange-900/60" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}>
            <KeyRound size={13} /> ACCESS CODES
          </Link>
        )}
      </nav>

      <div className="px-3 py-3 border-t border-border space-y-2">
        <div className="flex items-center gap-2 px-1">
          <div className={`w-5 h-5 rounded border flex items-center justify-center ${
            user?.role === "owner" ? "bg-orange-900/50 border-orange-800/50" :
            user?.role === "admin" ? "bg-yellow-900/50 border-yellow-800/50" : "bg-green-900/50 border-green-800/50"
          }`}>
            {user?.role === "owner" ? <Crown size={11} className="text-orange-400" /> :
             user?.role === "admin" ? <ShieldCheck size={11} className="text-yellow-400" /> :
             <Users size={11} className="text-green-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-foreground truncate font-mono tracking-wider">
              {(user as any)?.rank && <span className="text-yellow-400 mr-1">{(user as any).rank}</span>}{user?.username}
            </div>
            <div className={`text-[9px] tracking-wider flex items-center gap-1 ${
              user?.role === "owner" ? "text-orange-400" : user?.role === "admin" ? "text-yellow-400" : "text-muted-foreground"
            }`}>
              <span className="uppercase">{user?.role === "owner" ? "OWNER" : user?.role === "admin" ? "ADMIN" : "OPR"}</span>
              {(user as any)?.assignedUnit && <span className="text-muted-foreground/50 text-[8px]">▪ {(user as any).assignedUnit}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <Link href="/settings" className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded text-[10px] transition-all tracking-wider ${
            location === "/settings" ? "text-green-400 bg-green-950/30" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}><Settings size={11} />SETTINGS</Link>
          <button onClick={logout} className="flex items-center gap-2 px-3 py-1.5 rounded text-[10px] text-muted-foreground hover:text-red-400 hover:bg-red-950/20 transition-all" data-testid="button-logout">
            <LogOut size={11} />
          </button>
        </div>
        <div className="text-[9px] text-muted-foreground/50 tracking-wider px-1">TOC // SECTOR ALPHA</div>
      </div>
    </aside>
  );
}

// ── Mobile Top Bar ────────────────────────────────────────────────────────────
function MobileTopBar({ onMenuOpen }: { onMenuOpen: () => void }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data: unread } = useQuery<{ dms: number; general: number }>({
    queryKey: ["/api/messages/unread"],
    queryFn: () => apiRequest("GET", "/api/messages/unread"),
    refetchInterval: 15000,
    enabled: !!user,
  });
  const totalUnread = (unread?.dms || 0) + (unread?.general || 0);
  const current = [...NAV, { path: "/users", label: "USER MGMT" }, { path: "/access-codes", label: "ACCESS CODES" }, { path: "/settings", label: "SETTINGS" }]
    .find(n => n.path === location || (n.path !== "/" && location.startsWith(n.path)));

  return (
    <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0 safe-top">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 32 32" width="22" height="22">
          <rect width="32" height="32" fill="hsl(150 8% 6%)" rx="4" />
          <polygon points="16,3 29,27 3,27" fill="none" stroke="hsl(142 50% 50%)" strokeWidth="2.5" />
          <circle cx="16" cy="16" r="2.5" fill="hsl(142 50% 60%)" />
        </svg>
        <div>
          <div className="text-xs font-bold text-green-400 tracking-widest" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>TACEDGE</div>
          <div className="text-[9px] text-muted-foreground tracking-widest">{current?.label || "DASHBOARD"}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {totalUnread > 0 && location !== "/messages" && (
          <Link href="/messages" className="relative">
            <MessageSquare size={18} className="text-muted-foreground" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-[9px] text-white flex items-center justify-center font-bold">{totalUnread > 9 ? "9+" : totalUnread}</span>
          </Link>
        )}
        <button onClick={onMenuOpen} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <Menu size={20} />
        </button>
      </div>
    </div>
  );
}

// ── Mobile Drawer (full nav) ──────────────────────────────────────────────────
function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  if (!open) return null;

  const allNav = [
    ...NAV,
    ...(user?.role === "admin" || user?.role === "owner" ? [{ path: "/users", label: "USER MGMT", icon: ShieldCheck, short: "Users" }] : []),
    ...(user?.role === "owner" ? [{ path: "/access-codes", label: "ACCESS CODES", icon: KeyRound, short: "Codes" }] : []),
    { path: "/settings", label: "SETTINGS", icon: Settings, short: "Settings" },
  ];

  const handleNav = () => onClose();

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-72 bg-card border-l border-border flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <div>
            <div className="text-xs font-bold text-green-400 tracking-widest">NAVIGATION</div>
            <div className="text-[9px] text-muted-foreground tracking-wider mt-0.5">
              <span className={`font-bold ${user?.role === "owner" ? "text-orange-400" : user?.role === "admin" ? "text-yellow-400" : "text-green-400"}`}>{user?.username}</span>
              {" "}▪ {user?.role?.toUpperCase()}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded text-muted-foreground hover:text-foreground hover:bg-secondary">
            <X size={18} />
          </button>
        </div>

        {/* Nav list */}
        <nav className="flex-1 overflow-y-auto py-2">
          {allNav.map(({ path, label, icon: Icon }) => {
            const active = location === path || (path !== "/" && location.startsWith(path));
            return (
              <Link key={path} href={path} onClick={handleNav}
                className={`flex items-center justify-between px-4 py-3.5 border-b border-border/40 transition-colors ${
                  active ? "bg-green-950/40 text-green-400" : "text-foreground/80 hover:bg-secondary"
                }`}>
                <div className="flex items-center gap-3">
                  <Icon size={16} className={active ? "text-green-400" : "text-muted-foreground"} />
                  <span className="text-sm tracking-wider">{label}</span>
                </div>
                <ChevronRight size={14} className="text-muted-foreground/40" />
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-4 py-4 border-t border-border">
          <button onClick={() => { logout(); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded border border-red-900/40 text-red-400 hover:bg-red-950/20 transition-colors">
            <LogOut size={15} />
            <span className="text-sm tracking-wider">LOGOUT</span>
          </button>
        </div>
      </div>
    </>
  );
}

// ── Mobile Bottom Tab Bar ─────────────────────────────────────────────────────
function BottomTabBar() {
  const [location] = useLocation();
  const { user } = useQuery<{ dms: number; general: number }>({
    queryKey: ["/api/messages/unread"],
    queryFn: () => apiRequest("GET", "/api/messages/unread"),
    refetchInterval: 15000,
  }) as any;

  // Suppress ts errors — just use data inline
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border flex safe-bottom">
      {BOTTOM_TABS.map(({ path, label, icon: Icon }) => {
        const active = location === path || (path !== "/" && location.startsWith(path));
        return (
          <Link key={path} href={path}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 transition-colors ${active ? "text-green-400" : "text-muted-foreground"}`}>
            <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
            <span className="text-[9px] tracking-wider">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
function Layout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background scanlines">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile drawer */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Main content area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <MobileTopBar onMenuOpen={() => setDrawerOpen(true)} />

        {/* Page content — add bottom padding on mobile for tab bar */}
        <main className="flex-1 min-w-0 overflow-y-auto flex flex-col pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <BottomTabBar />
    </div>
  );
}

// ── Routes ────────────────────────────────────────────────────────────────────
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
        <Route path="/isofac" component={IsofacPage} />
        <Route path="/settings" component={ChangePassword} />
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
