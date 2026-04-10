import { Switch, Route, Router, Link, useLocation, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuth, type AuthUser } from "./lib/auth";
import { canAccessAppRoute } from "./lib/tacticalNav";
import { WSProvider } from "./lib/ws";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "./pages/Dashboard";
import Operations from "./pages/Operations";
import Intel from "./pages/Intel";
import Communications from "./pages/Communications";
import Assets from "./pages/Assets";
import Units from "./pages/Units";
import UserManagement from "./pages/UserManagement";
import AccessCodes from "./pages/AccessCodes";
import Messaging from "./pages/Messaging";
import CommoCardPage from "./pages/CommoCard";
import IsofacPage from "./pages/Isofac";
import ChangePassword from "./pages/ChangePassword";
import PersonnelRosterPage from "./pages/PersonnelRoster";
import AdminHub from "./pages/AdminHub";
import AfterActionPage from "./pages/AfterAction";
import OpTaskBoard from "./pages/OpTaskBoard";
import AwardsPage from "./pages/Awards";
import TrainingPage from "./pages/Training";
import TrainingQualificationsPage from "./pages/TrainingQualifications";
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
import UserProfilePage from "./pages/UserProfile";
import PersonnelHub from "./pages/PersonnelHub";
import PromotionPacketsPage from "./pages/PromotionPackets";
import LeaveOfAbsencePage from "./pages/LeaveOfAbsence";
import OrgChartPage from "./pages/OrgChart";
import TacticalHub from "./pages/TacticalHub";
import { BroadcastOverlay } from "./components/BroadcastOverlay";
import { MetropolisLogo } from "@/components/MetropolisLogo";
import { ClassificationBanner, ClassificationBannerSpacer } from "@/components/ClassificationBanner";
import { ProfileLink } from "@/components/ProfileLink";
import Login from "./pages/Login";
import NotFound from "./pages/not-found";
import TacticalRolesPage from "./pages/TacticalRolesPage";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./lib/queryClient";
import { useState, type ComponentType } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LucideIcon } from "lucide-react";
import { ROUTE_TITLE_ENTRIES, titleForPath } from "@/lib/appNav";
import {
  LayoutDashboard, ShieldAlert, Radio, Signal,
  Crosshair, Users, LogOut, ShieldCheck,
  KeyRound, Crown, MessageSquare, BookOpen,
  Settings, Menu, X, ChevronRight, UserCheck, FileText,
  Kanban, Star, GraduationCap, FolderOpen, MapPin, Zap, Map, CalendarDays, Link2, ScrollText,
  ClipboardList, ClipboardCheck, Medal, Palmtree, Network
} from "lucide-react";

type NavLeaf = { path: string; label: string; icon: LucideIcon; short: string };
type NavBlock =
  | ({ type: "single" } & NavLeaf)
  | { type: "group"; title: string; items: NavLeaf[] };

function flattenNav(blocks: NavBlock[]): NavLeaf[] {
  const out: NavLeaf[] = [];
  for (const b of blocks) {
    if (b.type === "single") out.push({ path: b.path, label: b.label, icon: b.icon, short: b.short });
    else out.push(...b.items);
  }
  return out;
}

function filterNavBlocks(blocks: NavBlock[], user: AuthUser | null): NavBlock[] {
  if (!user) return [];
  const out: NavBlock[] = [];
  for (const b of blocks) {
    if (b.type === "single") {
      if (canAccessAppRoute(user, b.path)) out.push(b);
    } else {
      const items = b.items.filter((it) => canAccessAppRoute(user, it.path));
      if (items.length) out.push({ type: "group", title: b.title, items });
    }
  }
  return out;
}

function gateRoute(path: string, C: ComponentType) {
  return function GatedRoute() {
    const { user } = useAuth();
    if (!user) return null;
    if (!canAccessAppRoute(user, path)) {
      return (
        <div className="flex flex-1 items-center justify-center p-8 min-h-[40vh]">
          <div className="text-center space-y-2 max-w-sm">
            <div className="text-xs text-muted-foreground tracking-[0.2em]">ACCESS RESTRICTED</div>
            <div className="text-[10px] text-muted-foreground/80">
              Your tactical permission roles do not include this area. Contact an administrator.
            </div>
          </div>
        </div>
      );
    }
    return <C />;
  };
}

/** Grouped sidebar: sections fold related tools under one heading */
const NAV_BLOCKS: NavBlock[] = [
  { type: "single", path: "/", label: "DASHBOARD", icon: LayoutDashboard, short: "Home" },
  { type: "single", path: "/calendar", label: "CALENDAR", icon: CalendarDays, short: "Cal" },
  {
    type: "group",
    title: "OPERATIONS",
    items: [
      { path: "/operations", label: "OPERATIONS", icon: Crosshair, short: "Ops" },
      { path: "/operations/tasks", label: "TASK BOARD", icon: Kanban, short: "Tasks" },
      { path: "/operations/aar", label: "AFTER ACTION", icon: FileText, short: "AAR" },
    ],
  },
  {
    type: "group",
    title: "INTELLIGENCE",
    items: [
      { path: "/intel", label: "INTEL REPORTS", icon: ShieldAlert, short: "Intel" },
      { path: "/intel/links", label: "LINK ANALYSIS", icon: Link2, short: "Links" },
      { path: "/intel/vault", label: "FILE VAULT", icon: FolderOpen, short: "Vault" },
      { path: "/intel/isofac", label: "ISOFAC", icon: BookOpen, short: "ISOFAC" },
    ],
  },
  {
    type: "group",
    title: "COMMS",
    items: [
      { path: "/comms", label: "COMMS LOG", icon: Radio, short: "Comms" },
      { path: "/comms/commo-card", label: "COMMO CARD", icon: Signal, short: "Card" },
      { path: "/comms/messages", label: "MESSAGES", icon: MessageSquare, short: "Msgs" },
    ],
  },
  {
    type: "group",
    title: "PERSONNEL",
    items: [
      { path: "/personnel", label: "OVERVIEW", icon: Users, short: "Home" },
      { path: "/personnel/org-chart", label: "ORG CHART", icon: Network, short: "Org" },
      { path: "/personnel/roster", label: "ROSTER", icon: ClipboardList, short: "Roster" },
      { path: "/personnel/units", label: "UNITS", icon: Users, short: "Units" },
      { path: "/personnel/promotions", label: "PROMOTIONS", icon: Medal, short: "Promo" },
      { path: "/personnel/loa", label: "LOA", icon: Palmtree, short: "LOA" },
    ],
  },
  {
    type: "group",
    title: "TACTICAL",
    items: [
      { path: "/tactical", label: "OVERVIEW", icon: Map, short: "Home" },
      { path: "/tactical/map", label: "TAC MAP", icon: Map, short: "Map" },
      { path: "/tactical/grid", label: "GRID TOOL", icon: MapPin, short: "Grid" },
    ],
  },
  {
    type: "group",
    title: "TRAINING",
    items: [
      { path: "/training", label: "SIGN IN SHEET", icon: GraduationCap, short: "Sign-in" },
      { path: "/training/qualifications", label: "TRAINING RECORDS", icon: ClipboardCheck, short: "Records" },
      { path: "/training/awards", label: "AWARDS", icon: Star, short: "Awards" },
    ],
  },
  {
    type: "group",
    title: "ADMIN",
    items: [
      { path: "/admin", label: "OVERVIEW", icon: LayoutDashboard, short: "Home" },
      { path: "/admin/approvals", label: "APPROVALS", icon: ShieldCheck, short: "Appr" },
      { path: "/admin/activity", label: "ACTIVITY LOG", icon: ScrollText, short: "Audit" },
      { path: "/admin/users", label: "USER MGMT", icon: Users, short: "Users" },
      { path: "/admin/roles", label: "PERM ROLES", icon: UserCheck, short: "Roles" },
      { path: "/admin/access-codes", label: "ACCESS CODES", icon: KeyRound, short: "Codes" },
      { path: "/admin/broadcasts", label: "BROADCASTS", icon: Zap, short: "Flash" },
    ],
  },
];

// Mobile bottom tab — primary destinations + "More" opens full nav (Discord-style rail)
const MOBILE_TAB_ITEMS = [
  { path: "/", label: "Home", icon: LayoutDashboard },
  { path: "/comms/messages", label: "Msgs", icon: MessageSquare },
  { path: "/operations", label: "Ops", icon: Crosshair },
  { path: "/comms", label: "Comms", icon: Radio },
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
      <div className="px-4 py-3 border-b border-border">
        <MetropolisLogo size="md" className="max-w-[min(100%,11rem)]" showText />
        <div className="text-[10px] text-muted-foreground tracking-widest mt-2">TACTICAL NODE v1.0</div>
      </div>

      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[10px] text-muted-foreground tracking-wider">NET: SECURE ▪ AES-256</span>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {filterNavBlocks(NAV_BLOCKS, user).map((block) => {
          const row = (path: string, label: string, Icon: LucideIcon) => {
            const active =
              path === "/"
                ? location === "/"
                : location === path || (path !== "/" && location.startsWith(`${path}/`));
            const isMsg = path === "/comms/messages";
            return (
              <Link
                key={path}
                href={path}
                className={`flex items-center justify-between px-3 py-2 rounded text-xs tracking-[0.08em] transition-all duration-150 cursor-pointer ${
                  active ? "bg-blue-950/60 text-blue-400 border border-blue-900/60" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                } ${block.type === "group" ? "pl-5" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon size={13} className={active ? "text-blue-400 shrink-0" : "shrink-0"} />
                  <span className="truncate">{label}</span>
                </div>
                {isMsg && totalUnread > 0 && !active && (
                  <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 rounded-full shrink-0">{totalUnread > 99 ? "99+" : totalUnread}</span>
                )}
              </Link>
            );
          };
          if (block.type === "single") {
            return row(block.path, block.label, block.icon);
          }
          return (
            <div key={block.title} className="pt-1 first:pt-0">
              <div className="px-3 py-1 text-[8px] tracking-[0.18em] text-muted-foreground/90 font-bold">{block.title}</div>
              <div className="space-y-0.5">{block.items.map((item) => row(item.path, item.label, item.icon))}</div>
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-border space-y-2">
        <div className="flex items-center gap-2 px-1">
          <div className={`w-5 h-5 rounded border flex items-center justify-center ${
            user?.accessLevel === "owner" ? "bg-orange-900/50 border-orange-800/50" :
            user?.accessLevel === "admin" ? "bg-yellow-900/50 border-yellow-800/50" : "bg-blue-900/50 border-blue-800/50"
          }`}>
            {user?.accessLevel === "owner" ? <Crown size={11} className="text-orange-400" /> :
             user?.accessLevel === "admin" ? <ShieldCheck size={11} className="text-yellow-400" /> :
             <Users size={11} className="text-blue-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-foreground truncate font-mono tracking-wider">
              {(user as any)?.rank && <span className="text-yellow-400 mr-1">{(user as any).rank}</span>}
              <ProfileLink username={user?.username} className="text-foreground hover:text-blue-400 font-bold">
                {user?.username}
              </ProfileLink>
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
            location === "/settings" ? "text-blue-400 bg-blue-950/30" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
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
  const pageTitle = titleForPath(location, ROUTE_TITLE_ENTRIES);

  return (
    <div
      className={cn(
        "items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0 safe-top",
        mobileShell ? "flex" : "hidden",
      )}
    >
        <div className="flex items-center gap-3 min-w-0">
        <MetropolisLogo size="sm" className="shrink-0 max-w-[7rem]" showText textLayout="inline" />
        <div className="min-w-0">
          <div className="text-[9px] text-muted-foreground tracking-widest truncate">{pageTitle}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {totalUnread > 0 && location !== "/comms/messages" && (
          <Link href="/comms/messages" className="relative">
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

  const allNav: NavLeaf[] = [
    ...flattenNav(filterNavBlocks(NAV_BLOCKS, user)),
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
        <div className="flex items-center justify-between px-4 py-4 border-b border-border gap-3">
          <MetropolisLogo size="sm" className="shrink-0 opacity-90 max-w-[5.5rem]" showText />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-blue-400 tracking-widest">NAVIGATION</div>
            <div className="text-[9px] text-muted-foreground tracking-wider mt-0.5">
              <ProfileLink
                username={user?.username}
                className={`font-bold inline ${user?.accessLevel === "owner" ? "text-orange-400 hover:text-orange-300" : user?.accessLevel === "admin" ? "text-yellow-400 hover:text-yellow-300" : "text-blue-400 hover:text-blue-300"}`}
              >
                {user?.username}
              </ProfileLink>
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
            const active = path === "/" ? location === "/" : location === path;
            return (
              <Link key={path} href={path} onClick={handleNav}
                className={`flex items-center justify-between px-4 py-3.5 border-b border-border/40 transition-colors ${
                  active ? "bg-blue-950/40 text-blue-400" : "text-foreground/80 hover:bg-secondary"
                }`}>
                <div className="flex items-center gap-3">
                  <Icon size={16} className={active ? "text-blue-400" : "text-muted-foreground"} />
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

function mobileTabActive(tabPath: string, location: string): boolean {
  if (tabPath === "/") return location === "/";
  if (tabPath === "/comms/messages") return location === "/comms/messages" || location.startsWith("/comms/messages/");
  if (tabPath === "/comms") return location === "/comms" || location.startsWith("/comms/commo");
  return location === tabPath || location.startsWith(`${tabPath}/`);
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
      {MOBILE_TAB_ITEMS.filter((item) => user && canAccessAppRoute(user, item.path)).map(({ path, label, icon: Icon }) => {
        const active = mobileTabActive(path, location);
        const showBadge = path === "/comms/messages" && totalUnread > 0 && !active;
        return (
          <Link key={path} href={path}
            className={`relative flex-1 flex flex-col items-center gap-0.5 py-2.5 px-0.5 min-h-[52px] min-w-0 justify-center transition-colors ${active ? "text-blue-400" : "text-muted-foreground"}`}>
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
        "flex flex-col max-w-[100vw] overflow-x-hidden bg-background scanlines",
        mobileShell ? "min-h-dvh" : "min-h-dvh md:min-h-screen",
      )}
    >
      <ClassificationBanner />
      <ClassificationBannerSpacer />

      <div className="flex flex-1 min-h-0 min-w-0">
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
      </div>

      {/* Mobile bottom tab bar (fixed; sibling of main shell row) */}
      <BottomTabBar mobileShell={mobileShell} onOpenMore={() => setDrawerOpen(true)} />
    </div>
  );
}

function ProfileIndexRedirect() {
  const { user } = useAuth();
  if (!user?.username) return <Redirect to="/" />;
  return <Redirect to={`/profile/${encodeURIComponent(user.username)}`} />;
}

// ── Routes ────────────────────────────────────────────────────────────────────
function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center scanlines">
        <div className="text-center space-y-4 flex flex-col items-center px-4">
          <MetropolisLogo size="md" className="opacity-90" showText />
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
        <Route path="/" component={gateRoute("/", Dashboard)} />
        <Route path="/calendar" component={gateRoute("/calendar", CalendarPage)} />

        <Route path="/support/medical" component={gateRoute("/support/medical", MedicalCasualtyPage)} />
        <Route path="/support" component={gateRoute("/support", SupportRequestsPage)} />

        <Route path="/operations/tasks" component={gateRoute("/operations/tasks", OpTaskBoard)} />
        <Route path="/operations/aar" component={gateRoute("/operations/aar", AfterActionPage)} />
        <Route path="/operations" component={gateRoute("/operations", Operations)} />

        <Route path="/intel/links" component={gateRoute("/intel/links", LinkAnalysisPage)} />
        <Route path="/intel/vault" component={gateRoute("/intel/vault", FileVault)} />
        <Route path="/intel/isofac" component={gateRoute("/intel/isofac", IsofacPage)} />
        <Route path="/intel" component={gateRoute("/intel", Intel)} />

        <Route path="/comms/commo-card" component={gateRoute("/comms/commo-card", CommoCardPage)} />
        <Route path="/comms/messages" component={gateRoute("/comms/messages", Messaging)} />
        <Route path="/comms" component={gateRoute("/comms", Communications)} />

        <Route path="/personnel/org-chart" component={gateRoute("/personnel/org-chart", OrgChartPage)} />
        <Route path="/personnel/roster" component={gateRoute("/personnel/roster", PersonnelRosterPage)} />
        <Route path="/personnel/units" component={gateRoute("/personnel/units", Units)} />
        <Route path="/personnel/promotions" component={gateRoute("/personnel/promotions", PromotionPacketsPage)} />
        <Route path="/personnel/loa" component={gateRoute("/personnel/loa", LeaveOfAbsencePage)} />
        <Route path="/personnel" component={gateRoute("/personnel", PersonnelHub)} />

        <Route path="/tactical/map" component={gateRoute("/tactical/map", TacticalTerrainMap)} />
        <Route path="/tactical/grid" component={gateRoute("/tactical/grid", GridTool)} />
        <Route path="/tactical" component={gateRoute("/tactical", TacticalHub)} />

        <Route path="/training/awards" component={gateRoute("/training/awards", AwardsPage)} />
        <Route path="/training/qualifications" component={gateRoute("/training/qualifications", TrainingQualificationsPage)} />
        <Route path="/training" component={gateRoute("/training", TrainingPage)} />

        <Route path="/assets" component={gateRoute("/assets", Assets)} />
        <Route path="/settings" component={gateRoute("/settings", ChangePassword)} />

        <Route path="/admin/approvals" component={gateRoute("/admin/approvals", ApprovalsPage)} />
        <Route path="/admin/activity" component={gateRoute("/admin/activity", ActivityLogPage)} />
        <Route path="/admin/users" component={gateRoute("/admin/users", UserManagement)} />
        <Route path="/admin/roles" component={gateRoute("/admin/roles", TacticalRolesPage)} />
        <Route path="/admin/access-codes" component={gateRoute("/admin/access-codes", AccessCodes)} />
        <Route path="/admin/broadcasts" component={gateRoute("/admin/broadcasts", BroadcastsPage)} />
        <Route path="/admin" component={gateRoute("/admin", AdminHub)} />
        <Route path="/profile" component={ProfileIndexRedirect} />
        <Route path="/profile/:username" component={UserProfilePage} />

        <Route path="/medical"><Redirect to="/support/medical" /></Route>
        <Route path="/task-board"><Redirect to="/operations/tasks" /></Route>
        <Route path="/aar"><Redirect to="/operations/aar" /></Route>
        <Route path="/links"><Redirect to="/intel/links" /></Route>
        <Route path="/file-vault"><Redirect to="/intel/vault" /></Route>
        <Route path="/commo-card"><Redirect to="/comms/commo-card" /></Route>
        <Route path="/perstat"><Redirect to="/personnel" /></Route>
        <Route path="/personnel/perstat"><Redirect to="/personnel" /></Route>
        <Route path="/personnel-roster"><Redirect to="/personnel/roster" /></Route>
        <Route path="/messages"><Redirect to="/comms/messages" /></Route>
        <Route path="/isofac"><Redirect to="/intel/isofac" /></Route>
        <Route path="/approvals"><Redirect to="/admin/approvals" /></Route>
        <Route path="/activity"><Redirect to="/admin/activity" /></Route>
        <Route path="/users/roles"><Redirect to="/admin/roles" /></Route>
        <Route path="/users"><Redirect to="/admin/users" /></Route>
        <Route path="/access-codes"><Redirect to="/admin/access-codes" /></Route>
        <Route path="/broadcasts"><Redirect to="/admin/broadcasts" /></Route>
        <Route path="/units"><Redirect to="/personnel/units" /></Route>
        <Route path="/terrain"><Redirect to="/tactical/map" /></Route>
        <Route path="/grid-tool"><Redirect to="/tactical/grid" /></Route>
        <Route path="/awards"><Redirect to="/training/awards" /></Route>

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
