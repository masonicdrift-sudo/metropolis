/** Items for horizontal sub-tabs on section pages (paths match wouter + hash router). */
export type SubNavItem = { href: string; label: string; short?: string };

export const OPS_SUB: SubNavItem[] = [
  { href: "/operations", label: "OPERATIONS", short: "Ops" },
  { href: "/operations/tasks", label: "TASK BOARD", short: "Tasks" },
  { href: "/operations/aar", label: "AFTER ACTION", short: "AAR" },
];

export const INTEL_SUB: SubNavItem[] = [
  { href: "/intel", label: "INTEL REPORTS", short: "Intel" },
  { href: "/intel/links", label: "LINK ANALYSIS", short: "Links" },
  { href: "/intel/vault", label: "FILE VAULT", short: "Vault" },
];

export const COMMS_SUB: SubNavItem[] = [
  { href: "/comms", label: "COMMS LOG", short: "Log" },
  { href: "/comms/commo-card", label: "COMMO CARD", short: "Card" },
];

export const PERSONNEL_SUB: SubNavItem[] = [
  { href: "/personnel", label: "OVERVIEW", short: "Home" },
  { href: "/personnel/perstat", label: "PERSTAT", short: "PERSTAT" },
  { href: "/personnel/roster", label: "ROSTER", short: "Roster" },
  { href: "/personnel/units", label: "UNITS", short: "Units" },
];

export const TACTICAL_SUB: SubNavItem[] = [
  { href: "/tactical", label: "OVERVIEW", short: "Home" },
  { href: "/tactical/map", label: "TAC MAP", short: "Map" },
  { href: "/tactical/grid", label: "GRID TOOL", short: "Grid" },
];

export const SUPPORT_SUB: SubNavItem[] = [
  { href: "/support", label: "SUPPORT REQUESTS", short: "Support" },
  { href: "/support/medical", label: "MEDICAL / CASEVAC", short: "Medical" },
];

export const TRAINING_SUB: SubNavItem[] = [
  { href: "/training", label: "SIGN IN SHEET", short: "Sign-in" },
  { href: "/training/awards", label: "AWARDS", short: "Awards" },
];

/** Longest-prefix match for mobile header title */
export function titleForPath(
  location: string,
  entries: { path: string; label: string }[],
): string {
  const sorted = [...entries].sort((a, b) => b.path.length - a.path.length);
  for (const e of sorted) {
    if (e.path === "/" ? location === "/" : location === e.path || location.startsWith(`${e.path}/`)) {
      return e.label;
    }
  }
  return "DASHBOARD";
}

/** Every routed screen title for the mobile top bar (most specific paths first in logic via sort). */
export const ROUTE_TITLE_ENTRIES: { path: string; label: string }[] = [
  { path: "/", label: "DASHBOARD" },
  { path: "/calendar", label: "CALENDAR" },
  { path: "/support/medical", label: "MEDICAL" },
  { path: "/support", label: "SUPPORT" },
  { path: "/operations/tasks", label: "TASK BOARD" },
  { path: "/operations/aar", label: "AFTER ACTION" },
  { path: "/operations", label: "OPERATIONS" },
  { path: "/intel/links", label: "LINK ANALYSIS" },
  { path: "/intel/vault", label: "FILE VAULT" },
  { path: "/intel", label: "INTELLIGENCE" },
  { path: "/comms/commo-card", label: "COMMO CARD" },
  { path: "/comms", label: "COMMS" },
  { path: "/personnel/perstat", label: "PERSTAT" },
  { path: "/personnel/roster", label: "ROSTER" },
  { path: "/personnel/units", label: "UNITS" },
  { path: "/personnel", label: "PERSONNEL" },
  { path: "/tactical/map", label: "TAC MAP" },
  { path: "/tactical/grid", label: "GRID TOOL" },
  { path: "/tactical", label: "TACTICAL" },
  { path: "/training/awards", label: "AWARDS" },
  { path: "/training", label: "SIGN IN SHEET" },
  { path: "/isofac", label: "ISOFAC" },
  { path: "/approvals", label: "APPROVALS" },
  { path: "/links", label: "LINK ANALYSIS" },
  { path: "/file-vault", label: "FILE VAULT" },
  { path: "/assets", label: "ASSETS" },
  { path: "/messages", label: "MESSAGES" },
  { path: "/activity", label: "ACTIVITY LOG" },
  { path: "/users/roles", label: "PERM ROLES" },
  { path: "/users", label: "USER MGMT" },
  { path: "/access-codes", label: "ACCESS CODES" },
  { path: "/broadcasts", label: "BROADCASTS" },
  { path: "/settings", label: "SETTINGS" },
  { path: "/profile", label: "PROFILE" },
];
