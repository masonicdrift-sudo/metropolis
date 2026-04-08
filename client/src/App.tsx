import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuth } from "./lib/auth";
import { WSProvider } from "./lib/ws";
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
import PerstatPage from "./pages/Perstat";
import AfterActionPage from "./pages/AfterAction";
import OpTaskBoard from "./pages/OpTaskBoard";
import AwardsPage from "./pages/Awards";
import TrainingPage from "./pages/Training";
import FileVault from "./pages/FileVault";
import GridTool from "./pages/GridTool";
import TacticalTerrainMap from "./pages/TacticalTerrainMap";
import CalendarPage from "./pages/Calendar";
import BroadcastsPage from "./pages/Broadcasts";
import ActivityLogPage from "./pages/ActivityLog";
import LinkAnalysisPage from "./pages/LinkAnalysis";
import SupportRequestsPage from "./pages/SupportRequests";
import MedicalCasualtyPage from "./pages/MedicalCasualty";
import ApprovalsPage from "./pages/Approvals";
import { BroadcastOverlay } from "./components/BroadcastOverlay";
import Login from "./pages/Login";
import NotFound from "./pages/not-found";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./lib/queryClient";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  LayoutDashboard, Radio, Target, ShieldAlert,
  Crosshair, Package, Users, LogOut, ShieldCheck,
  KeyRound, Crown, MessageSquare, Signal, BookOpen,
  Settings, Menu, X, ChevronRight, UserCheck, FileText,
  Kanban, Star, GraduationCap, FolderOpen, MapPin, Zap, Map, CalendarDays, Link2, LifeBuoy, ScrollText
} from "lucide-react";

// All nav items
const NAV = [
  { path: "/",            label: "DASHBOARD",    icon: LayoutDashboard, short: "Home" },
  { path: "/calendar",    label: "CALENDAR",     icon: CalendarDays,    short: "Cal" },
  { path: "/support",     label: "SUPPORT",      icon: LifeBuoy,        short: "Support" },
  { path: "/medical",     label: "MEDICAL",      icon: ShieldCheck,     short: "Med" },
  { path: "/operations",  label: "OPERATIONS",   icon: Crosshair,       short: "Ops" },
  { path: "/intel",       label: "INTELLIGENCE", icon: ShieldAlert,     short: "Intel" },
  { path: "/comms",       label: "COMMS",        icon: Radio,           short: "Comms" },
  { path: "/commo-card",  label: "COMMO CARD",   icon: Signal,          short: "Radio" },
  { path: "/isofac",      label: "ISOFAC",       icon: BookOpen,        short: "ISOFAC" },
  { path: "/approvals",   label: "APPROVALS",    icon: ShieldCheck,     short: "Appr" },
  { path: "/links",       label: "LINK ANALYSIS", icon: Link2,          short: "Links" },
  { path: "/file-vault",  label: "FILE VAULT",   icon: FolderOpen,      short: "Vault" },
  { path: "/assets",      label: "ASSETS",       icon: Package,         short: "Assets" },
  { path: "/threats",     label: "THREAT BOARD", icon: Target,          short: "Threats" },
  { path: "/units",       label: "UNITS",        icon: Users,           short: "Units" },
  { path: "/perstat",     label: "PERSTAT",      icon: UserCheck,       short: "PERSTAT" },
  { path: "/messages",    label: "MESSAGES",     icon: MessageSquare,   short: "Msgs" },
  { path: "/aar",         label: "AFTER ACTION", icon: FileText,        short: "AAR" },
  { path: "/task-board",  label: "TASK BOARD",   icon: Kanban,          short: "Tasks" },
  { path: "/awards",      label: "AWARDS",       icon: Star,            short: "Awards" },
  { path: "/training",    label: "TRAINING",     icon: GraduationCap,   short: "Train" },
  { path: "/grid-tool",   label: "GRID TOOL",    icon: MapPin,          short: "Grid" },
  { path: "/terrain",     label: "TAC MAP",      icon: Map,             short: "Map" },
  { path: "/activity",    label: "ACTIVITY LOG", icon: ScrollText,      short: "Audit" },
];

// Mobile bottom tab — primary destinations + "More" opens full nav (Discord-style rail)
const MOBILE_TAB_ITEMS = [
  { path: "/",           label: "Home",  icon: LayoutDashboard },
  { path: "/messages",   label: "Msgs",  icon: MessageSquare },
  { path: "/operations", label: "Ops",   icon: Crosshair },
  { path: "/comms",      label: "Comms", icon: Radio },
] as const;

// ── Desktop Sidebar ───────────────────────────────────────────────────────────
function Sidebar({ mobileShell }: { mobileShell: boolean }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: unread } = useQuery<{ dms: number; general: number }>({
    queryKey: ["/api/messages/unread"],
    queryFn: () => apiRequest("GET", "/api/messages/unread"),
    
    enabled: !!user,
  });
  const totalUnread = (unread?.dms || 0) + (unread?.general || 0);

  return (
    <aside
      className={cn(
        "flex-col w-[200px] min-h-screen border-r border-border bg-card shrink-0",
        mobileShell ? "hidden" : "flex",
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <svg viewBox="0 0 32 32" width="28" height="28" aria-label="METROPOLIS logo">
          <rect width="32" height="32" fill="hsl(226 35% 6%)" rx="4" />
          <polygon points="16,3 29,27 3,27" fill="none" stroke="hsl(217 91% 60%)" strokeWidth="2" />
          <line x1="16" y1="3" x2="16" y2="27" stroke="hsl(217 91% 60%)" strokeWidth="1" strokeDasharray="2,3" />
          <circle cx="16" cy="16" r="2" fill="hsl(217 91% 70%)" />
        </svg>
        <div>
          <div className="text-xs font-bold tracking-[0.15em] text-blue-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>METROPOLIS</div>
          <div className="text-[10px] text-muted-foreground tracking-widest">TACTICAL NODE v1.0</div>
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

        {(user?.accessLevel === "admin" || user?.accessLevel === "owner") && (
          <Link href="/users" className={`flex items-center gap-3 px-3 py-2 rounded text-xs tracking-[0.08em] transition-all cursor-pointer ${
            location === "/users" ? "bg-yellow-950/60 text-yellow-400 border border-yellow-900/60" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}>
            <ShieldCheck size={13} /> USER MGMT
          </Link>
        )}
        {user?.accessLevel === "owner" && (
          <Link href="/access-codes" className={`flex items-center gap-3 px-3 py-2 rounded text-xs tracking-[0.08em] transition-all cursor-pointer ${
            location === "/access-codes" ? "bg-orange-950/60 text-orange-400 border border-orange-900/60" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}>
            <KeyRound size={13} /> ACCESS CODES
          </Link>
        )}
        {(user?.accessLevel === "admin" || user?.accessLevel === "owner") && (
          <Link href="/broadcasts" className={`flex items-center gap-3 px-3 py-2 rounded text-xs tracking-[0.08em] transition-all cursor-pointer ${
            location === "/broadcasts" ? "bg-red-950/60 text-red-400 border border-red-900/60" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}>
            <Zap size={13} /> BROADCASTS
          </Link>
        )}
      </nav>

      <div className="px-3 py-3 border-t border-border space-y-2">
        <div className="flex items-center gap-2 px-1">
          <div className={`w-5 h-5 rounded border flex items-center justify-center ${
            user?.accessLevel === "owner" ? "bg-orange-900/50 border-orange-800/50" :
            user?.accessLevel === "admin" ? "bg-yellow-900/50 border-yellow-800/50" : "bg-green-900/50 border-green-800/50"
          }`}>
            {user?.accessLevel === "owner" ? <Crown size={11} className="text-orange-400" /> :
             user?.accessLevel === "admin" ? <ShieldCheck size={11} className="text-yellow-400" /> :
             <Users size={11} className="text-green-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-foreground truncate font-mono tracking-wider">
              {(user as any)?.rank && <span className="text-yellow-400 mr-1">{(user as any).rank}</span>}{user?.username}
            </div>
            <div className={`text-[9px] tracking-wider flex items-center gap-1 ${
              user?.accessLevel === "owner" ? "text-orange-400" : user?.accessLevel === "admin" ? "text-yellow-400" : "text-muted-foreground"
            }`}>
              <span className="uppercase">{user?.accessLevel === "owner" ? "OWNER" : user?.accessLevel === "admin" ? "ADMIN" : "OPR"}</span>
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
function MobileTopBar({ onMenuOpen, mobileShell }: { onMenuOpen: () => void; mobileShell: boolean }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data: unread } = useQuery<{ dms: number; general: number }>({
    queryKey: ["/api/messages/unread"],
    queryFn: () => apiRequest("GET", "/api/messages/unread"),
    
    enabled: !!user,
  });
  const totalUnread = (unread?.dms || 0) + (unread?.general || 0);
  const current = [...NAV, { path: "/users", label: "USER MGMT" }, { path: "/access-codes", label: "ACCESS CODES" }, { path: "/settings", label: "SETTINGS" }]
    .find(n => n.path === location || (n.path !== "/" && location.startsWith(n.path)));

  return (
    <div
      className={cn(
        "items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0 safe-top",
        mobileShell ? "flex" : "hidden",
      )}
    >
        <div className="flex items-center gap-3">
        <svg viewBox="0 0 32 32" width="22" height="22">
          <rect width="32" height="32" fill="hsl(226 35% 6%)" rx="4" />
          <polygon points="16,3 29,27 3,27" fill="none" stroke="hsl(217 91% 60%)" strokeWidth="2.5" />
          <circle cx="16" cy="16" r="2.5" fill="hsl(217 91% 70%)" />
        </svg>
        <div>
          <div className="text-xs font-bold text-blue-400 tracking-widest" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>METROPOLIS</div>
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
    ...(user?.accessLevel === "admin" || user?.accessLevel === "owner" ? [{ path: "/users", label: "USER MGMT", icon: ShieldCheck, short: "Users" }] : []),
    ...(user?.accessLevel === "owner" ? [{ path: "/access-codes", label: "ACCESS CODES", icon: KeyRound, short: "Codes" }] : []),
    ...((user?.accessLevel === "admin" || user?.accessLevel === "owner") ? [{ path: "/broadcasts", label: "BROADCASTS", icon: Zap, short: "Flash" }] : []),
    { path: "/settings", label: "SETTINGS", icon: Settings, short: "Settings" },
  ];

  const handleNav = () => onClose();

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-[min(100vw,18rem)] sm:w-72 max-w-full bg-card border-l border-border flex flex-col shadow-2xl safe-top">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <div>
            <div className="text-xs font-bold text-green-400 tracking-widest">NAVIGATION</div>
            <div className="text-[9px] text-muted-foreground tracking-wider mt-0.5">
              <span className={`font-bold ${user?.accessLevel === "owner" ? "text-orange-400" : user?.accessLevel === "admin" ? "text-yellow-400" : "text-blue-400"}`}>{user?.username}</span>
              {" "}▪ {user?.accessLevel?.toUpperCase()}
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
function BottomTabBar({ onOpenMore, mobileShell }: { onOpenMore: () => void; mobileShell: boolean }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data: unread } = useQuery<{ dms: number; general: number }>({
    queryKey: ["/api/messages/unread"],
    queryFn: () => apiRequest("GET", "/api/messages/unread"),
    enabled: !!user,
  });
  const totalUnread = (unread?.dms || 0) + (unread?.general || 0);

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-sm border-t border-border safe-bottom touch-manipulation max-w-[100vw]",
        mobileShell ? "flex" : "hidden",
      )}
    >
      {MOBILE_TAB_ITEMS.map(({ path, label, icon: Icon }) => {
        const active = location === path || (path !== "/" && location.startsWith(path));
        const showBadge = path === "/messages" && totalUnread > 0 && !active;
        return (
          <Link key={path} href={path}
            className={`relative flex-1 flex flex-col items-center gap-0.5 py-2.5 px-0.5 min-h-[52px] min-w-0 justify-center transition-colors ${active ? "text-green-400" : "text-muted-foreground"}`}>
            <Icon size={20} strokeWidth={active ? 2.5 : 1.5} className="shrink-0" />
            <span className="text-[8px] sm:text-[9px] tracking-wider truncate max-w-full">{label}</span>
            {showBadge && (
              <span className="absolute top-1 right-1/4 translate-x-1 min-w-[16px] h-4 px-1 bg-red-600 rounded-full text-[8px] text-white font-bold flex items-center justify-center">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onOpenMore}
        className="flex-1 flex flex-col items-center gap-0.5 py-2.5 px-0.5 min-h-[52px] min-w-0 justify-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Open full menu"
      >
        <Menu size={20} strokeWidth={1.5} className="shrink-0" />
        <span className="text-[8px] sm:text-[9px] tracking-wider">MORE</span>
      </button>
    </nav>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
function Layout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mobileShell = useIsMobile();

  return (
    <div
      className={cn(
        "flex max-w-[100vw] overflow-x-hidden bg-background scanlines",
        mobileShell ? "min-h-dvh" : "min-h-dvh md:min-h-screen",
      )}
    >
      {/* Desktop sidebar */}
      <Sidebar mobileShell={mobileShell} />

      {/* Mobile drawer */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Main content area */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col max-w-full">
        {/* Mobile top bar */}
        <MobileTopBar mobileShell={mobileShell} onMenuOpen={() => setDrawerOpen(true)} />

        {/* Page content — bottom padding = tab bar + home indicator */}
        <main
          className={cn(
            "flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col",
            mobileShell ? "pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))]" : "pb-0",
          )}
        >
          <div className="tac-page flex-1 flex flex-col min-h-0 min-w-0">{children}</div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <BottomTabBar mobileShell={mobileShell} onOpenMore={() => setDrawerOpen(true)} />
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
      <BroadcastOverlay />
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
        <Route path="/perstat" component={PerstatPage} />
        <Route path="/aar" component={AfterActionPage} />
        <Route path="/task-board" component={OpTaskBoard} />
        <Route path="/awards" component={AwardsPage} />
        <Route path="/training" component={TrainingPage} />
        <Route path="/file-vault" component={FileVault} />
        <Route path="/grid-tool" component={GridTool} />
        <Route path="/terrain" component={TacticalTerrainMap} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/support" component={SupportRequestsPage} />
        <Route path="/medical" component={MedicalCasualtyPage} />
        <Route path="/approvals" component={ApprovalsPage} />
        <Route path="/links" component={LinkAnalysisPage} />
        <Route path="/activity" component={ActivityLogPage} />
        <Route path="/broadcasts" component={(user.accessLevel === "admin" || user.accessLevel === "owner") ? BroadcastsPage : () => <div className="p-8 text-center text-xs text-muted-foreground">ADMIN ACCESS ONLY</div>} />
        <Route path="/users" component={(user.accessLevel === "admin" || user.accessLevel === "owner") ? UserManagement : () => <div className="p-8 text-center text-xs text-muted-foreground">ACCESS DENIED</div>} />
        <Route path="/access-codes" component={user.accessLevel === "owner" ? AccessCodes : () => <div className="p-8 text-center text-xs text-muted-foreground">OWNER ACCESS ONLY</div>} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WSProvider>
          <Router hook={useHashLocation}>
            <AppRoutes />
          </Router>
          <Toaster />
        </WSProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
